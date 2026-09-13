"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma, HostelFacilityType } from "@prisma/client";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";

export type FormState = { error?: string };

export async function createRoom(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireModuleAccess("Hostel", "EDIT");
  const sdb = await getScopedDb();

  const roomNo = formData.get("roomNo");
  const capacity = formData.get("capacity");
  const roomSize = formData.get("roomSize");
  const roomType = formData.get("roomType");

  if (typeof roomNo !== "string" || !roomNo.trim() || typeof capacity !== "string" || !capacity) {
    return { error: "Room number and capacity are required." };
  }

  const room = await sdb.hostelRoom.create({
    data: scopedCreateData<Prisma.HostelRoomUncheckedCreateInput>({
      roomNo: roomNo.trim(),
      capacity: Number(capacity),
      roomSize: typeof roomSize === "string" && roomSize ? roomSize : null,
      roomType: typeof roomType === "string" && roomType ? roomType : null,
    }),
  });

  revalidatePath("/app/hostel");
  redirect(`/app/hostel?tab=rooms&room=${room.id}`);
}

export async function updateRoomDetails(roomId: string, roomNo: string, roomSize: string, capacity: number) {
  await requireModuleAccess("Hostel", "EDIT");
  if (!roomNo.trim() || capacity <= 0) throw new Error("Room number and a positive capacity are required.");
  const sdb = await getScopedDb();
  await sdb.hostelRoom.update({ where: { id: roomId }, data: { roomNo: roomNo.trim(), roomSize: roomSize.trim() || null, capacity } });
  revalidatePath("/app/hostel");
}

export async function allocateRoom(roomId: string, studentId: string) {
  await requireModuleAccess("Hostel", "EDIT");
  const sdb = await getScopedDb();

  const [room, allocatedCount] = await Promise.all([
    sdb.hostelRoom.findUniqueOrThrow({ where: { id: roomId } }),
    sdb.hostelAllocation.count({ where: { roomId } }),
    sdb.student.findUniqueOrThrow({ where: { id: studentId }, select: { id: true } }),
  ]);
  if (allocatedCount >= room.capacity) throw new Error("Room is at full capacity.");

  await sdb.hostelAllocation.create({
    data: scopedCreateData<Prisma.HostelAllocationUncheckedCreateInput>({ roomId, studentId, dateFrom: new Date() }),
  });

  revalidatePath("/app/hostel");
}

export async function removeAllocation(studentId: string) {
  await requireModuleAccess("Hostel", "EDIT");
  const sdb = await getScopedDb();
  await sdb.hostelAllocation.deleteMany({ where: { studentId } });
  revalidatePath("/app/hostel");
}

// -------------------------------------------------------------- Facilities

export async function addFacility(roomId: string, type: HostelFacilityType, label: string | null) {
  await requireModuleAccess("Hostel", "EDIT");
  const sdb = await getScopedDb();
  await sdb.hostelRoom.findUniqueOrThrow({ where: { id: roomId }, select: { id: true } });
  await sdb.hostelFacility.create({
    data: scopedCreateData<Prisma.HostelFacilityUncheckedCreateInput>({ roomId, type, label: label?.trim() || null }),
  });
  revalidatePath("/app/hostel");
}

export async function updateFacilityCondition(facilityId: string, condition: string) {
  await requireModuleAccess("Hostel", "EDIT");
  const sdb = await getScopedDb();
  await sdb.hostelFacility.update({ where: { id: facilityId }, data: { condition: condition.trim() || null } });
  revalidatePath("/app/hostel");
}

export async function removeFacility(facilityId: string) {
  await requireModuleAccess("Hostel", "EDIT");
  const sdb = await getScopedDb();
  await sdb.hostelFacility.delete({ where: { id: facilityId } });
  revalidatePath("/app/hostel");
}
