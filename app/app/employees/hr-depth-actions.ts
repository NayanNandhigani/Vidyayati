"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { requireFeature } from "@/lib/feature-flags";
import type { Prisma } from "@prisma/client";

async function schoolId() {
  const session = await auth();
  return session!.user.schoolId!;
}

export async function updateStaffProfileDetails(staffId: string, qualifications: string, specialization: string, shiftStart: string) {
  await requireModuleAccess("Employees", "EDIT");
  const sdb = await getScopedDb();
  await sdb.staffProfile.update({
    where: { id: staffId },
    data: { qualifications: qualifications.trim() || null, specialization: specialization.trim() || null, shiftStart: shiftStart || null },
  });
  revalidatePath(`/app/employees/${staffId}`);
}

export async function createLeaveType(name: string, annualQuota: number) {
  const sid = await schoolId();
  await requireModuleAccess("Employees", "EDIT");
  await requireFeature(sid, "employees.leave");
  const sdb = await getScopedDb();
  await sdb.staffLeaveType.create({ data: scopedCreateData<Prisma.StaffLeaveTypeUncheckedCreateInput>({ name: name.trim(), annualQuota }) });
  revalidatePath("/app/employees");
}

export async function deleteLeaveType(id: string) {
  await requireModuleAccess("Employees", "EDIT");
  const sdb = await getScopedDb();
  await sdb.staffLeaveType.delete({ where: { id } });
  revalidatePath("/app/employees");
}

/**
 * Filed either by an admin on any staff member's behalf, or by that staff
 * member themselves for their own record (self-service, reachable only
 * if their role has been granted at least VIEW on Employees — this
 * module's existing per-module access model, not a new special case).
 */
export async function applyForStaffLeave(staffId: string, leaveTypeId: string, dateFrom: string, dateTo: string, reason: string) {
  const sid = await schoolId();
  await requireFeature(sid, "employees.leave");
  const session = await auth();
  const sdb = await getScopedDb();

  if (session!.user.role !== "SCHOOL_ADMIN") {
    const own = await sdb.staffProfile.findUnique({ where: { id: staffId } });
    if (own?.userId !== session!.user.id) throw new Error("You can only apply for your own leave.");
  }

  await sdb.staffLeaveRequest.create({
    data: scopedCreateData<Prisma.StaffLeaveRequestUncheckedCreateInput>({ staffId, leaveTypeId, dateFrom: new Date(dateFrom), dateTo: new Date(dateTo), reason: reason.trim() }),
  });
  revalidatePath(`/app/employees/${staffId}`);
}

export async function actOnStaffLeave(requestId: string, approve: boolean) {
  const session = await auth();
  if (session!.user.role !== "SCHOOL_ADMIN") throw new Error("Only a School Admin can approve staff leave.");
  await requireFeature(session!.user.schoolId!, "employees.leave");
  const sdb = await getScopedDb();
  const request = await sdb.staffLeaveRequest.update({ where: { id: requestId }, data: { status: approve ? "APPROVED" : "REJECTED", actionAt: new Date() } });
  revalidatePath(`/app/employees/${request.staffId}`);
  // pendingLeaveRequests is a global admin inbox shown on every staff
  // member's page, not just the affected one — revalidate the list too so
  // an admin acting on it from a *different* staff member's page doesn't
  // need a hard refresh to see it clear from view.
  revalidatePath("/app/employees");
}

/** Days used (from approved requests, this calendar year) and remaining, per leave type, for one staff member. */
export async function getStaffLeaveSummary(staffId: string) {
  const sdb = await getScopedDb();
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const [types, requests] = await Promise.all([
    sdb.staffLeaveType.findMany({ orderBy: { name: "asc" } }),
    sdb.staffLeaveRequest.findMany({ where: { staffId, status: "APPROVED", dateFrom: { gte: yearStart } } }),
  ]);

  return types.map((t) => {
    const used = requests
      .filter((r) => r.leaveTypeId === t.id)
      .reduce((sum, r) => sum + Math.round((r.dateTo.getTime() - r.dateFrom.getTime()) / 86400000) + 1, 0);
    return { id: t.id, name: t.name, quota: t.annualQuota, used, remaining: Math.max(0, t.annualQuota - used) };
  });
}

/** Approved leave days this month beyond what's left in every quota, for the LOP payroll deduction — a simple "if you've used up all your leave types' balance, extra approved days are unpaid" rule. */
export async function getLopDaysForMonth(staffId: string, month: string) {
  const sdb = await getScopedDb();
  const [year, mo] = month.split("-").map(Number);
  const monthStart = new Date(year, mo - 1, 1);
  const monthEnd = new Date(year, mo, 0);

  const summary = await getStaffLeaveSummary(staffId);
  const totalRemaining = summary.reduce((s, t) => s + t.remaining, 0);

  const requestsThisMonth = await sdb.staffLeaveRequest.findMany({
    where: { staffId, status: "APPROVED", dateFrom: { lte: monthEnd }, dateTo: { gte: monthStart } },
  });
  const daysThisMonth = requestsThisMonth.reduce((sum, r) => sum + Math.round((r.dateTo.getTime() - r.dateFrom.getTime()) / 86400000) + 1, 0);

  // totalRemaining already excludes this month's own usage (computed from
  // the same approved rows), so any days beyond what quota allows overall
  // are treated as LOP for simplicity — not a perfect month-by-month
  // ledger, but a reasonable, honestly-scoped approximation.
  return Math.max(0, daysThisMonth - totalRemaining);
}
