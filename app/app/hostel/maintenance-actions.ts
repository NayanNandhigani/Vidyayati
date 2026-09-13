"use server";

import { revalidatePath } from "next/cache";
import { Prisma, HostelLogType, HostelLogStatus } from "@prisma/client";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";

/** Exactly one of roomId/facilityId should be set — logging against the room itself, or one of its toilets/showers. */
export async function addMaintenanceLog(target: { roomId?: string; facilityId?: string }, type: HostelLogType, date: string, description: string) {
  await requireModuleAccess("Hostel", "EDIT");
  if (!target.roomId && !target.facilityId) throw new Error("Pick a room or a facility.");
  if (!description.trim()) throw new Error("Description is required.");
  const sdb = await getScopedDb();
  if (target.roomId) await sdb.hostelRoom.findUniqueOrThrow({ where: { id: target.roomId }, select: { id: true } });
  if (target.facilityId) await sdb.hostelFacility.findUniqueOrThrow({ where: { id: target.facilityId }, select: { id: true } });
  await sdb.hostelMaintenanceLog.create({
    data: scopedCreateData<Prisma.HostelMaintenanceLogUncheckedCreateInput>({
      roomId: target.roomId ?? null,
      facilityId: target.facilityId ?? null,
      type,
      date: new Date(date),
      description: description.trim(),
    }),
  });
  revalidatePath("/app/hostel");
}

export async function updateMaintenanceStatus(logId: string, status: HostelLogStatus) {
  await requireModuleAccess("Hostel", "EDIT");
  const sdb = await getScopedDb();
  await sdb.hostelMaintenanceLog.update({ where: { id: logId }, data: { status } });
  revalidatePath("/app/hostel");
}

export async function deleteMaintenanceLog(logId: string) {
  await requireModuleAccess("Hostel", "EDIT");
  const sdb = await getScopedDb();
  await sdb.hostelMaintenanceLog.delete({ where: { id: logId } });
  revalidatePath("/app/hostel");
}
