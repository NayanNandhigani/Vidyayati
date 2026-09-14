"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma, AccessLevel } from "@prisma/client";
import { db } from "@/lib/db";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { auth } from "@/auth";
import { createPendingAccount } from "@/lib/account-setup";

export type StaffFormState = { error?: string };

export async function createStaff(_prevState: StaffFormState, formData: FormData): Promise<StaffFormState> {
  const session = await auth();
  if (session!.user.role !== "SCHOOL_ADMIN") return { error: "Only a School Admin can add staff." };
  const sdb = await getScopedDb();

  const name = formData.get("name");
  const username = formData.get("username");
  const phone = formData.get("phone");
  const designation = formData.get("designation");
  const department = formData.get("department");
  const staffCategory = formData.get("staffCategory");

  if (typeof name !== "string" || !name.trim() || typeof username !== "string" || !username.trim()) {
    return { error: "Name and username are required." };
  }

  const normalizedUsername = username.trim().toLowerCase();
  const existing = await db.user.findUnique({ where: { username: normalizedUsername } });
  if (existing) return { error: "A user with this username already exists." };

  const school = await db.school.findUnique({ where: { id: session!.user.schoolId! }, select: { maxStaff: true } });
  if (school?.maxStaff != null) {
    const staffCount = await sdb.user.count({ where: { role: "STAFF" } });
    if (staffCount >= school.maxStaff) {
      return { error: `This school's staff limit (${school.maxStaff}) has been reached. Contact Vidya Yati to raise it.` };
    }
  }

  const { token, setupTokenHash, setupTokenExpiresAt, placeholderHash } = await createPendingAccount();

  const user = await sdb.user.create({
    data: scopedCreateData<Prisma.UserUncheckedCreateInput>({
      name: name.trim(),
      username: normalizedUsername,
      phone: typeof phone === "string" && phone ? phone : null,
      role: "STAFF",
      passwordHash: placeholderHash,
      setupTokenHash,
      setupTokenExpiresAt,
    }),
  });

  const staff = await sdb.staffProfile.create({
    data: scopedCreateData<Prisma.StaffProfileUncheckedCreateInput>({
      userId: user.id,
      designation: typeof designation === "string" && designation ? designation : null,
      department: typeof department === "string" && department ? department : null,
      staffCategory: staffCategory === "NON_TEACHING" ? "NON_TEACHING" : "TEACHING",
      dateJoined: new Date(),
    }),
  });

  revalidatePath("/app/employees");
  redirect(`/app/employees/${staff.id}?setupToken=${token}`);
}

export async function cyclePermission(staffId: string, moduleName: string, classId: string | null = null) {
  const session = await auth();
  if (session!.user.role !== "SCHOOL_ADMIN") throw new Error("Only a School Admin can change permissions.");
  const sdb = await getScopedDb();
  await sdb.staffProfile.findUniqueOrThrow({ where: { id: staffId }, select: { id: true } });
  if (classId !== null) await sdb.class.findUniqueOrThrow({ where: { id: classId }, select: { id: true } });

  const CYCLE: AccessLevel[] = ["NONE", "VIEW", "EDIT"];

  // Prisma's compound-unique-key lookup type requires a non-null classId
  // (it can't express "classId IS NULL" through that path, even though the
  // column itself is nullable) — so the school-wide row (classId: null)
  // has to be resolved through a regular where-filter + explicit
  // create/update instead of upsert() on the compound key.
  if (classId === null) {
    const existing = await sdb.staffPermission.findFirst({ where: { staffId, moduleName, classId: null } });
    const next = CYCLE[(CYCLE.indexOf(existing?.accessLevel ?? "NONE") + 1) % CYCLE.length];
    if (existing) {
      await sdb.staffPermission.update({ where: { id: existing.id }, data: { accessLevel: next } });
    } else {
      await sdb.staffPermission.create({ data: scopedCreateData<Prisma.StaffPermissionUncheckedCreateInput>({ staffId, moduleName, classId: null, accessLevel: next }) });
    }
    revalidatePath(`/app/employees/${staffId}`);
    return { accessLevel: next };
  }

  const existing = await sdb.staffPermission.findUnique({ where: { staffId_moduleName_classId: { staffId, moduleName, classId } } });
  const next = CYCLE[(CYCLE.indexOf(existing?.accessLevel ?? "NONE") + 1) % CYCLE.length];

  await sdb.staffPermission.upsert({
    where: { staffId_moduleName_classId: { staffId, moduleName, classId } },
    update: { accessLevel: next },
    create: scopedCreateData<Prisma.StaffPermissionUncheckedCreateInput>({ staffId, moduleName, classId, accessLevel: next }),
  });

  revalidatePath(`/app/employees/${staffId}`);
  return { accessLevel: next };
}

export async function removeClassPermission(staffId: string, moduleName: string, classId: string) {
  const session = await auth();
  if (session!.user.role !== "SCHOOL_ADMIN") throw new Error("Only a School Admin can change permissions.");
  const sdb = await getScopedDb();

  await sdb.staffPermission.delete({ where: { staffId_moduleName_classId: { staffId, moduleName, classId } } }).catch(() => {});
  revalidatePath(`/app/employees/${staffId}`);
}

export async function runPayroll(staffId: string, month: string, amount: number) {
  await requireModuleAccess("Employees", "EDIT");
  const sdb = await getScopedDb();

  const staff = await sdb.staffProfile.findUniqueOrThrow({ where: { id: staffId }, include: { user: true } });

  const [run] = await sdb.$transaction([
    sdb.payrollRun.upsert({
      where: { staffId_month: { staffId, month } },
      update: { amount, status: "PAID", paidOn: new Date() },
      create: scopedCreateData<Prisma.PayrollRunUncheckedCreateInput>({ staffId, month, amount, status: "PAID", paidOn: new Date() }),
    }),
    sdb.accountsTransaction.create({
      data: scopedCreateData<Prisma.AccountsTransactionUncheckedCreateInput>({
        date: new Date(),
        description: `Staff salary — ${staff.user.name} (${month})`,
        category: "Payroll",
        source: "AUTO_PAYROLL",
        type: "EXPENSE",
        amount,
      }),
    }),
  ]);

  revalidatePath(`/app/employees/${staffId}`);
  revalidatePath("/app/accounts");
  revalidatePath("/app/dashboard");
  return { runId: run.id };
}
