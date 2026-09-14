"use server";

import { revalidatePath } from "next/cache";
import { Prisma, AudienceType } from "@prisma/client";
import { auth } from "@/auth";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";

export type AnnouncementFormState = { error?: string; success?: boolean };

async function requireAdmin() {
  const session = await auth();
  if (session!.user.role !== "SCHOOL_ADMIN") throw new Error("Only a School Admin can approve announcements.");
}

// Every announcement — composed by Staff or School Admin alike — starts
// PENDING and stays invisible to recipients until an explicit School-Admin
// approval; see approveAnnouncement below. "Publish" here just means
// "submit," not "go live."
export async function publishAnnouncement(_prevState: AnnouncementFormState, formData: FormData): Promise<AnnouncementFormState> {
  await requireModuleAccess("Communication", "EDIT");
  const sdb = await getScopedDb();

  const title = formData.get("title");
  const body = formData.get("body");
  const audienceType = formData.get("audienceType");
  const audienceTarget = formData.get("audienceTarget");
  const scheduleDate = formData.get("scheduleDate");

  if (typeof title !== "string" || !title.trim() || typeof body !== "string" || !body.trim() || typeof audienceType !== "string") {
    return { error: "Title, message, and audience are required." };
  }
  if ((audienceType === "SPECIFIC_CLASS" || audienceType === "SPECIFIC_STUDENT") && (typeof audienceTarget !== "string" || !audienceTarget)) {
    return { error: "Select the target for this audience." };
  }

  const scheduled = typeof scheduleDate === "string" && scheduleDate ? new Date(scheduleDate) : null;

  await sdb.announcement.create({
    data: scopedCreateData<Prisma.AnnouncementUncheckedCreateInput>({
      title: title.trim(),
      body: body.trim(),
      audienceType: audienceType as AudienceType,
      audienceTarget: typeof audienceTarget === "string" && audienceTarget ? audienceTarget : null,
      publishedOn: null,
      scheduledFor: scheduled,
      approvalStatus: "PENDING",
    }),
  });

  revalidatePath("/app/communication");
  return { success: true };
}

export async function approveAnnouncement(id: string) {
  await requireAdmin();
  const sdb = await getScopedDb();
  await sdb.announcement.update({ where: { id }, data: { approvalStatus: "APPROVED", publishedOn: new Date() } });
  revalidatePath("/app/communication");
}

export async function rejectAnnouncement(id: string) {
  await requireAdmin();
  const sdb = await getScopedDb();
  await sdb.announcement.update({ where: { id }, data: { approvalStatus: "REJECTED" } });
  revalidatePath("/app/communication");
}
