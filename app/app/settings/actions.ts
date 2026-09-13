"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { auth, unstable_update } from "@/auth";
import { db } from "@/lib/db";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { newPasswordSchema } from "@/lib/validation";

async function requireAdmin() {
  const session = await auth();
  if (session!.user.role !== "SCHOOL_ADMIN") throw new Error("Only a School Admin can change settings.");
}

export type FormState = { error?: string; success?: boolean };

export async function saveGeneral(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const session = await auth();

  const name = formData.get("name");
  const city = formData.get("city");
  const state = formData.get("state");

  if (typeof name !== "string" || !name.trim()) return { error: "School name is required." };

  await db.school.update({
    where: { id: session!.user.schoolId! },
    data: { name: name.trim(), city: typeof city === "string" ? city : null, state: typeof state === "string" ? state : null },
  });

  revalidatePath("/app/settings");
  revalidatePath("/app/dashboard");
  return { success: true };
}

export async function createAcademicYear(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const sdb = await getScopedDb();

  const label = formData.get("label");
  const startDate = formData.get("startDate");
  const endDate = formData.get("endDate");

  if (typeof label !== "string" || !label.trim() || typeof startDate !== "string" || !startDate || typeof endDate !== "string" || !endDate) {
    return { error: "Label and both dates are required." };
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end <= start) return { error: "End date must be after the start date." };

  // Architecture V1, Phase 4, item 40 — an academic year's own date range
  // shouldn't overlap another year already set up for this school.
  const overlapping = await sdb.academicYear.findFirst({ where: { startDate: { lt: end }, endDate: { gt: start } } });
  if (overlapping) return { error: `This date range overlaps the existing academic year "${overlapping.label}".` };

  await sdb.academicYear.create({
    data: scopedCreateData<Prisma.AcademicYearUncheckedCreateInput>({
      label: label.trim(),
      startDate: start,
      endDate: end,
      isCurrent: false,
    }),
  });

  revalidatePath("/app/settings");
  redirect("/app/settings?panel=years");
}

export async function setCurrentYear(yearId: string) {
  await requireAdmin();
  const sdb = await getScopedDb();
  await sdb.$transaction([
    sdb.academicYear.updateMany({ data: { isCurrent: false }, where: {} }),
    sdb.academicYear.update({ where: { id: yearId }, data: { isCurrent: true } }),
  ]);
  revalidatePath("/app/settings");
  revalidatePath("/app/dashboard");
}

export async function changePassword(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "Not signed in." };
  const sdb = await getScopedDb();

  const currentPassword = formData.get("currentPassword");
  const newPassword = formData.get("newPassword");
  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return { error: "Enter your current and new password." };
  }

  const user = await sdb.user.findUniqueOrThrow({ where: { id: session.user.id } });
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return { error: "Current password is incorrect." };

  const parsed = newPasswordSchema.safeParse({ newPassword, username: user.username });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid password." };

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await sdb.user.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: false } });

  // Refresh the JWT immediately so the next request's middleware check sees
  // mustChangePassword: false — otherwise it'd bounce them right back here.
  await unstable_update({ user: { mustChangePassword: false } });

  return { success: true };
}

export async function createGradeScale(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const sdb = await getScopedDb();

  const name = formData.get("name");
  if (typeof name !== "string" || !name.trim()) return { error: "Scale name is required." };

  await sdb.gradeScale.create({
    data: scopedCreateData<Prisma.GradeScaleUncheckedCreateInput>({ name: name.trim(), isActive: false }),
  });

  revalidatePath("/app/settings");
  return { success: true };
}

// One active GradeScale per school — same "unset all, then set one" shape
// as setCurrentYear() above, applied to GradeScale.isActive. Also points
// the current AcademicYear at this scale, since that's what
// ExamMarksGrid/ParentExamsView actually read to compute a grade.
export async function setActiveGradeScale(scaleId: string) {
  await requireAdmin();
  const sdb = await getScopedDb();

  await sdb.$transaction([
    sdb.gradeScale.updateMany({ data: { isActive: false }, where: {} }),
    sdb.gradeScale.update({ where: { id: scaleId }, data: { isActive: true } }),
    sdb.academicYear.updateMany({ where: { isCurrent: true }, data: { gradeScaleId: scaleId } }),
  ]);

  revalidatePath("/app/settings");
  revalidatePath("/app/exams");
}

export async function createGradeBand(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const sdb = await getScopedDb();

  const scaleId = formData.get("scaleId");
  const label = formData.get("label");
  const minPercent = formData.get("minPercent");
  const maxPercent = formData.get("maxPercent");
  const remark = formData.get("remark");

  if (typeof scaleId !== "string" || !scaleId) return { error: "Missing grade scale." };
  if (typeof label !== "string" || !label.trim()) return { error: "Band label is required." };
  if (typeof minPercent !== "string" || !minPercent || typeof maxPercent !== "string" || !maxPercent) {
    return { error: "Enter both a minimum and maximum percentage." };
  }
  const min = Number(minPercent);
  const max = Number(maxPercent);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max > 100 || min > max) {
    return { error: "Enter a valid percentage range (0–100, min ≤ max)." };
  }

  const scale = await sdb.gradeScale.findUnique({ where: { id: scaleId }, select: { id: true } });
  if (!scale) return { error: "That grade scale could not be found." };

  await sdb.gradeBand.create({
    data: scopedCreateData<Prisma.GradeBandUncheckedCreateInput>({
      scaleId,
      label: label.trim(),
      minPercent: min,
      maxPercent: max,
      remark: typeof remark === "string" && remark.trim() ? remark.trim() : null,
    }),
  });

  revalidatePath("/app/settings");
  revalidatePath("/app/exams");
  return { success: true };
}

export async function deleteGradeBand(bandId: string) {
  await requireAdmin();
  const sdb = await getScopedDb();
  await sdb.gradeBand.delete({ where: { id: bandId } }).catch(() => {});
  revalidatePath("/app/settings");
  revalidatePath("/app/exams");
}
