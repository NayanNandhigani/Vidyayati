"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getScopedDb } from "@/lib/tenant-db";
import { requireFeature } from "@/lib/feature-flags";
import { grantClassAttendanceAccess, revokeClassAttendanceAccess } from "./actions";
import { enrollStudent } from "@/lib/domain/enrollment";

async function requireAdmin() {
  const session = await auth();
  if (session!.user.role !== "SCHOOL_ADMIN") throw new Error("Only a School Admin can manage the institute.");
  return session!.user.schoolId!;
}

export async function updateClassCapacityAndBoard(classId: string, maxStrength: number | null, board: string) {
  const schoolId = await requireAdmin();
  await requireFeature(schoolId, "classes.capacityAndCurriculum");
  const sdb = await getScopedDb();
  await sdb.class.update({ where: { id: classId }, data: { maxStrength, board: board.trim() || null } });
  revalidatePath("/app/institute");
}

export async function updateSubjectDetail(subjectId: string, isElective: boolean, credits: number | null) {
  const schoolId = await requireAdmin();
  await requireFeature(schoolId, "classes.capacityAndCurriculum");
  const sdb = await getScopedDb();
  await sdb.subject.update({ where: { id: subjectId }, data: { isElective, credits } });
  revalidatePath("/app/institute");
}

export async function addCoTeacher(classId: string, staffId: string) {
  const schoolId = await requireAdmin();
  await requireFeature(schoolId, "classes.coTeacherAndReshuffle");
  const sdb = await getScopedDb();
  await sdb.class.findUniqueOrThrow({ where: { id: classId }, select: { id: true } });
  await sdb.staffProfile.findUniqueOrThrow({ where: { id: staffId }, select: { id: true } });
  await sdb.classCoTeacher.upsert({
    where: { classId_staffId: { classId, staffId } },
    update: {},
    create: { classId, staffId, schoolId },
  });
  await grantClassAttendanceAccess(sdb, staffId, classId);
  revalidatePath("/app/institute");
}

export async function removeCoTeacher(classId: string, staffId: string) {
  await requireAdmin();
  const sdb = await getScopedDb();
  await sdb.classCoTeacher.delete({ where: { classId_staffId: { classId, staffId } } });

  const cls = await sdb.class.findUnique({ where: { id: classId }, select: { classTeacherStaffId: true } });
  if (cls?.classTeacherStaffId !== staffId) await revokeClassAttendanceAccess(sdb, staffId, classId);
  revalidatePath("/app/institute");
}

export async function bulkReshuffleStudents(studentIds: string[], targetClassId: string) {
  const schoolId = await requireAdmin();
  await requireFeature(schoolId, "classes.coTeacherAndReshuffle");
  const sdb = await getScopedDb();
  await sdb.$transaction(async (tx) => {
    await tx.student.updateMany({ where: { id: { in: studentIds } }, data: { classId: targetClassId } });
    for (const studentId of studentIds) {
      await enrollStudent(studentId, targetClassId, undefined, tx);
    }
  });
  revalidatePath("/app/students");
  return { moved: studentIds.length };
}
