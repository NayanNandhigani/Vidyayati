import { Prisma } from "@prisma/client";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";

/**
 * Ensures a student has an ACTIVE Enrollment row for the academic year
 * `classId` belongs to — creates one if none exists for that year, or
 * updates classId in place if one already does (correcting a placement,
 * or a same-year reshuffle). Does not touch Student.classId itself —
 * callers still own that write, same as before Architecture V1
 * Milestone 4; Enrollment is an additive parallel history, not (yet) the
 * source of truth.
 */
export async function enrollStudent(studentId: string, classId: string, rollNumber?: string | null) {
  const sdb = await getScopedDb();
  const cls = await sdb.class.findUniqueOrThrow({ where: { id: classId }, select: { yearId: true } });

  const existing = await sdb.enrollment.findUnique({
    where: { studentId_academicYearId: { studentId, academicYearId: cls.yearId } },
  });

  if (existing) {
    return sdb.enrollment.update({
      where: { id: existing.id },
      data: { classId, rollNumber: rollNumber ?? existing.rollNumber, status: "ACTIVE" },
    });
  }

  return sdb.enrollment.create({
    data: scopedCreateData<Prisma.EnrollmentUncheckedCreateInput>({
      studentId,
      academicYearId: cls.yearId,
      classId,
      rollNumber: rollNumber ?? null,
      status: "ACTIVE",
    }),
  });
}

/**
 * Moves a student into a new class. If the new class belongs to a
 * different academic year than their current active enrollment, this
 * closes out the old one (given `status`, `endedOn` now) and opens a new
 * enrollment for the new year — preserving history rather than
 * overwriting it. If the new class is in the *same* year (an ordinary
 * same-year reshuffle), it just updates the existing enrollment's class
 * in place — same as calling enrollStudent() directly.
 */
export async function promoteStudent(studentId: string, toClassId: string, status: "PROMOTED" | "TRANSFERRED" | "WITHDRAWN" = "PROMOTED") {
  const sdb = await getScopedDb();
  const toClass = await sdb.class.findUniqueOrThrow({ where: { id: toClassId }, select: { yearId: true } });

  const current = await sdb.enrollment.findFirst({ where: { studentId, status: "ACTIVE" }, orderBy: { enrolledOn: "desc" } });
  if (current && current.academicYearId !== toClass.yearId) {
    await sdb.enrollment.update({ where: { id: current.id }, data: { status, endedOn: new Date() } });
  }

  return enrollStudent(studentId, toClassId);
}
