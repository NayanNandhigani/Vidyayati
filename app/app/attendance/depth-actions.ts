"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { requireFeature, hasFeature } from "@/lib/feature-flags";
import type { Prisma } from "@prisma/client";

async function schoolId() {
  const session = await auth();
  return session!.user.schoolId!;
}

/** Parent applies for their child's leave — no module-access check, a parent isn't Staff/Admin. */
export async function applyForLeave(studentId: string, dateFrom: string, dateTo: string, reason: string) {
  const sid = await schoolId();
  await requireFeature(sid, "attendance.studentLeave");
  const session = await auth();
  if (session!.user.role !== "PARENT") throw new Error("Only a parent can submit a leave request.");

  const sdb = await getScopedDb();
  // Confirm this parent is actually linked to the student before letting them file on their behalf.
  const parent = await sdb.parent.findUnique({ where: { userId: session!.user.id }, include: { studentLinks: true } });
  if (!parent?.studentLinks.some((l) => l.studentId === studentId)) throw new Error("Not your child.");

  await sdb.studentLeaveRequest.create({
    data: scopedCreateData<Prisma.StudentLeaveRequestUncheckedCreateInput>({
      studentId,
      dateFrom: new Date(dateFrom),
      dateTo: new Date(dateTo),
      reason: reason.trim(),
    }),
  });
  revalidatePath("/app/attendance");
}

export async function classTeacherActOnLeave(requestId: string, approve: boolean, note?: string) {
  const sdb = await getScopedDb();
  const req = await sdb.studentLeaveRequest.findUniqueOrThrow({ where: { id: requestId }, include: { student: true } });
  await requireModuleAccess("Attendance", "EDIT", req.student.classId);
  await requireFeature(await schoolId(), "attendance.studentLeave");

  await sdb.studentLeaveRequest.update({
    where: { id: requestId },
    data: {
      stage: approve ? "CLASS_TEACHER_APPROVED" : "REJECTED",
      classTeacherActionAt: new Date(),
      rejectionNote: approve ? null : note?.trim() || "Rejected by class teacher.",
    },
  });
  revalidatePath("/app/attendance");
}

export async function adminActOnLeave(requestId: string, approve: boolean, note?: string) {
  const session = await auth();
  if (session!.user.role !== "SCHOOL_ADMIN") throw new Error("Only a School Admin can give final approval.");
  await requireFeature(session!.user.schoolId!, "attendance.studentLeave");

  const sdb = await getScopedDb();
  await sdb.studentLeaveRequest.update({
    where: { id: requestId },
    data: {
      stage: approve ? "ADMIN_APPROVED" : "REJECTED",
      adminActionAt: new Date(),
      rejectionNote: approve ? null : note?.trim() || "Rejected by admin.",
    },
  });
  revalidatePath("/app/attendance");
}

export async function updateAttendanceThresholds(defaulterPct: number | null, consecutiveDays: number | null) {
  const sid = await schoolId();
  await requireModuleAccess("Attendance", "EDIT");
  const sdb = await getScopedDb();
  await sdb.school.update({ where: { id: sid }, data: { attendanceDefaulterThresholdPct: defaulterPct, consecutiveAbsenceAlertDays: consecutiveDays } });
  revalidatePath("/app/attendance");
}

/** Students below the configured attendance % threshold, or with N+ consecutive absences ending today. */
export async function getAttendanceFlags(classId?: string) {
  const sid = await schoolId();
  const enabled = await hasFeature(sid, "attendance.defaulterAlerts");
  if (!enabled) return { defaulters: [], consecutiveAbsentees: [] };

  const sdb = await getScopedDb();
  const school = await sdb.school.findUniqueOrThrow({ where: { id: sid } });
  const students = await sdb.student.findMany({
    where: { status: "ACTIVE", ...(classId ? { classId } : {}) },
    include: { attendance: { orderBy: { date: "desc" } }, class: true },
  });

  const defaulters: { id: string; name: string; className: string; pct: number }[] = [];
  const consecutiveAbsentees: { id: string; name: string; className: string; streak: number }[] = [];

  for (const s of students) {
    const total = s.attendance.length;
    const present = s.attendance.filter((a) => a.status === "PRESENT").length;
    const pct = total ? Math.round((present / total) * 100) : 100;

    if (school.attendanceDefaulterThresholdPct != null && total > 0 && pct < school.attendanceDefaulterThresholdPct) {
      defaulters.push({ id: s.id, name: `${s.firstName} ${s.surname}`, className: `${s.class.grade}-${s.class.section}`, pct });
    }

    if (school.consecutiveAbsenceAlertDays != null) {
      let streak = 0;
      for (const a of s.attendance) {
        if (a.status === "ABSENT") streak++;
        else break;
      }
      if (streak >= school.consecutiveAbsenceAlertDays) {
        consecutiveAbsentees.push({ id: s.id, name: `${s.firstName} ${s.surname}`, className: `${s.class.grade}-${s.class.section}`, streak });
      }
    }
  }

  return { defaulters, consecutiveAbsentees };
}
