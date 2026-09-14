"use server";

import { revalidatePath } from "next/cache";
import { Prisma, DayOfWeek } from "@prisma/client";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";

export async function setTimetableSlot(
  classId: string,
  dayOfWeek: DayOfWeek,
  periodNo: number,
  subjectId: string | null,
  staffId: string | null
) {
  await requireModuleAccess("Timetable", "EDIT", classId);
  const sdb = await getScopedDb();

  if (!subjectId || !staffId) {
    await sdb.timetableSlot.deleteMany({ where: { classId, dayOfWeek, periodNo } });
    revalidatePath("/app/timetable");
    return { success: true };
  }

  await sdb.class.findUniqueOrThrow({ where: { id: classId }, select: { id: true } });
  await sdb.subject.findUniqueOrThrow({ where: { id: subjectId }, select: { id: true } });
  await sdb.staffProfile.findUniqueOrThrow({ where: { id: staffId }, select: { id: true } });

  await sdb.timetableSlot.upsert({
    where: { classId_dayOfWeek_periodNo: { classId, dayOfWeek, periodNo } },
    update: { subjectId, staffId },
    create: scopedCreateData<Prisma.TimetableSlotUncheckedCreateInput>({ classId, dayOfWeek, periodNo, subjectId, staffId }),
  });

  revalidatePath("/app/timetable");
  return { success: true };
}
