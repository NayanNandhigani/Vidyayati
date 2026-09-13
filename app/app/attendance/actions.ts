"use server";

import { revalidatePath } from "next/cache";
import { Prisma, AttendanceStatus } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";

export async function saveAttendance(classId: string, date: string, marks: Record<string, AttendanceStatus>) {
  await requireModuleAccess("Attendance", "EDIT", classId);
  const session = await auth();
  const sdb = await getScopedDb();

  const staffProfile =
    session!.user.role === "STAFF" ? await db.staffProfile.findUnique({ where: { userId: session!.user.id } }) : null;

  const d = new Date(`${date}T00:00:00`);

  // studentId keys come from client-submitted marks — restrict writes to
  // students who actually belong to this class/school.
  const validStudents = await sdb.student.findMany({ where: { classId, id: { in: Object.keys(marks) } }, select: { id: true } });
  const validStudentIds = new Set(validStudents.map((s) => s.id));
  const validMarks = Object.entries(marks).filter(([studentId]) => validStudentIds.has(studentId));

  await sdb.$transaction(
    validMarks.map(([studentId, status]) =>
      sdb.attendance.upsert({
        where: { studentId_date: { studentId, date: d } },
        update: { status, markedByStaffId: staffProfile?.id ?? null, classId },
        create: scopedCreateData<Prisma.AttendanceUncheckedCreateInput>({
          studentId,
          date: d,
          status,
          markedByStaffId: staffProfile?.id ?? null,
          classId,
        }),
      })
    )
  );

  revalidatePath("/app/attendance");
  return { success: true, savedCount: validMarks.length };
}
