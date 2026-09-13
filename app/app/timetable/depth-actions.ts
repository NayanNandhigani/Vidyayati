"use server";

import { revalidatePath } from "next/cache";
import { Prisma, DayOfWeek } from "@prisma/client";
import { auth } from "@/auth";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { requireFeature } from "@/lib/feature-flags";

async function schoolId() {
  const session = await auth();
  return session!.user.schoolId!;
}

export async function listRooms() {
  const sdb = await getScopedDb();
  return sdb.room.findMany({ orderBy: { name: "asc" } });
}

export async function createRoom(name: string, capacity: number | null, equipmentNote: string) {
  const sid = await schoolId();
  await requireFeature(sid, "timetable.roomsAndConflicts");
  const sdb = await getScopedDb();
  await sdb.room.create({ data: scopedCreateData<Prisma.RoomUncheckedCreateInput>({ name: name.trim(), capacity, equipmentNote: equipmentNote.trim() || null }) });
  revalidatePath("/app/timetable");
}

export async function deleteRoom(roomId: string) {
  await requireFeature(await schoolId(), "timetable.roomsAndConflicts");
  const sdb = await getScopedDb();
  await sdb.room.delete({ where: { id: roomId } });
  revalidatePath("/app/timetable");
}

/**
 * The room-and-conflict-aware sibling of actions.ts's setTimetableSlot —
 * kept as a separate action rather than modifying the original, so a
 * school without this feature keeps exactly today's behavior (silent
 * overwrite, no room). Returns an error string instead of throwing so the
 * UI can show it inline without losing the admin's in-progress edit.
 */
export async function setTimetableSlotWithRoom(
  classId: string,
  dayOfWeek: DayOfWeek,
  periodNo: number,
  subjectId: string | null,
  staffId: string | null,
  roomId: string | null
): Promise<{ error?: string }> {
  await requireModuleAccess("Timetable", "EDIT", classId);
  const sid = await schoolId();
  await requireFeature(sid, "timetable.roomsAndConflicts");
  const sdb = await getScopedDb();

  if (!subjectId || !staffId) {
    await sdb.timetableSlot.deleteMany({ where: { classId, dayOfWeek, periodNo } });
    revalidatePath("/app/timetable");
    return {};
  }

  await sdb.class.findUniqueOrThrow({ where: { id: classId }, select: { id: true } });
  await sdb.subject.findUniqueOrThrow({ where: { id: subjectId }, select: { id: true } });
  await sdb.staffProfile.findUniqueOrThrow({ where: { id: staffId }, select: { id: true } });
  if (roomId) await sdb.room.findUniqueOrThrow({ where: { id: roomId }, select: { id: true } });

  const [teacherConflict, roomConflict] = await Promise.all([
    sdb.timetableSlot.findFirst({
      where: { staffId, dayOfWeek, periodNo, classId: { not: classId } },
      include: { class: true },
    }),
    roomId
      ? sdb.timetableSlot.findFirst({ where: { roomId, dayOfWeek, periodNo, classId: { not: classId } }, include: { class: true } })
      : Promise.resolve(null),
  ]);

  if (teacherConflict) {
    return { error: `This teacher is already scheduled in Class ${teacherConflict.class.grade}-${teacherConflict.class.section} at this time.` };
  }
  if (roomConflict) {
    return { error: `This room is already booked by Class ${roomConflict.class.grade}-${roomConflict.class.section} at this time.` };
  }

  await sdb.timetableSlot.upsert({
    where: { classId_dayOfWeek_periodNo: { classId, dayOfWeek, periodNo } },
    update: { subjectId, staffId, roomId },
    create: scopedCreateData<Prisma.TimetableSlotUncheckedCreateInput>({ classId, dayOfWeek, periodNo, subjectId, staffId, roomId }),
  });

  revalidatePath("/app/timetable");
  return {};
}

/** Periods-per-week per teacher, for a simple workload view — no schema needed, just a group-by. */
export async function getTeacherWorkload() {
  const sdb = await getScopedDb();
  const slots = await sdb.timetableSlot.findMany({ include: { staff: { include: { user: true } } } });
  const byStaff = new Map<string, { name: string; count: number }>();
  for (const s of slots) {
    const entry = byStaff.get(s.staffId) ?? { name: s.staff.user.name, count: 0 };
    entry.count += 1;
    byStaff.set(s.staffId, entry);
  }
  return [...byStaff.values()].sort((a, b) => b.count - a.count);
}
