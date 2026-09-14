"use server";

import { revalidatePath } from "next/cache";
import { Prisma, HostelAttendanceSession, HostelAttendanceStatus } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { studentName } from "@/lib/format";

/** Mirrors app/app/attendance/actions.ts's saveAttendance, scoped to hostel residents (via HostelAllocation) instead of a class roster. */
export async function saveHostelAttendance(date: string, session: HostelAttendanceSession, marks: Record<string, HostelAttendanceStatus>) {
  await requireModuleAccess("Hostel", "EDIT");
  const authSession = await auth();
  const sdb = await getScopedDb();

  const staffProfile =
    authSession!.user.role === "STAFF" ? await db.staffProfile.findUnique({ where: { userId: authSession!.user.id } }) : null;

  const d = new Date(`${date}T00:00:00`);

  // studentId keys come from client-submitted marks — restrict writes to
  // students who actually have an active hostel allocation (residents).
  const validResidents = await sdb.student.findMany({
    where: { id: { in: Object.keys(marks) }, hostelAllocations: { some: {} } },
    select: { id: true },
  });
  const validResidentIds = new Set(validResidents.map((s) => s.id));
  const validMarks = Object.entries(marks).filter(([studentId]) => validResidentIds.has(studentId));

  await sdb.$transaction(
    validMarks.map(([studentId, status]) =>
      sdb.hostelAttendance.upsert({
        where: { studentId_date_session: { studentId, date: d, session } },
        update: { status, markedByStaffId: staffProfile?.id ?? null },
        create: scopedCreateData<Prisma.HostelAttendanceUncheckedCreateInput>({
          studentId,
          date: d,
          session,
          status,
          markedByStaffId: staffProfile?.id ?? null,
        }),
      })
    )
  );

  revalidatePath("/app/hostel");
  return { success: true, savedCount: validMarks.length };
}

/** Today's absentees (any session) + a 30-day present % per resident — feeds the Attendance tab's reports panel. */
export async function getHostelAttendanceSummary() {
  const sdb = await getScopedDb();

  const residents = await sdb.student.findMany({
    where: { hostelAllocations: { some: {} } },
    include: { hostelAttendance: { orderBy: { date: "desc" }, take: 90 } },
  });

  const todayKey = new Date().toISOString().slice(0, 10);

  const absentToday: { id: string; name: string; session: HostelAttendanceSession }[] = [];
  const summary: { id: string; name: string; pct: number; marked: number }[] = [];

  for (const s of residents) {
    const todaysMarks = s.hostelAttendance.filter((a) => a.date.toISOString().slice(0, 10) === todayKey);
    for (const m of todaysMarks) {
      if (m.status === "ABSENT") absentToday.push({ id: s.id, name: studentName(s), session: m.session });
    }

    const recent = s.hostelAttendance.slice(0, 90);
    const present = recent.filter((a) => a.status !== "ABSENT").length;
    const pct = recent.length ? Math.round((present / recent.length) * 100) : 100;
    summary.push({ id: s.id, name: studentName(s), pct, marked: recent.length });
  }

  return { absentToday, summary };
}
