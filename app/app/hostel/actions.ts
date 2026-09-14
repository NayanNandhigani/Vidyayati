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

  const room = await sdb.$transaction(async (tx) => {
    const room = await tx.hostelRoom.create({
      data: scopedCreateData<Prisma.HostelRoomUncheckedCreateInput>({
        roomNo: roomNo.trim(),
        capacity: Number(capacity),
        roomSize: typeof roomSize === "string" && roomSize ? roomSize : null,
        roomType: typeof roomType === "string" && roomType ? roomType : null,
      }),
    });
    await tx.hostelBed.createMany({
      data: Array.from({ length: Number(capacity) }, (_, i) =>
        scopedCreateData<Prisma.HostelBedUncheckedCreateInput>({ roomId: room.id, bedNo: String(i + 1) })
      ),
    });
    return room;
  });

  revalidatePath("/app/hostel");
  redirect(`/app/hostel?tab=rooms&room=${room.id}`);
}

export async function updateRoomDetails(roomId: string, roomNo: string, roomSize: string, capacity: number) {
  await requireModuleAccess("Hostel", "EDIT");
  if (!roomNo.trim() || capacity <= 0) throw new Error("Room number and a positive capacity are required.");
  const sdb = await getScopedDb();

  const beds = await sdb.hostelBed.findMany({ where: { roomId }, include: { allocation: true } });
  const bedNumbers = beds.map((b) => Number(b.bedNo)).filter((n) => Number.isFinite(n));
  const highestBedNo = bedNumbers.length > 0 ? Math.max(...bedNumbers) : 0;

  if (capacity > beds.length) {
    // Growing — add matching new beds, numbered after the highest existing one.
    const toAdd = capacity - beds.length;
    await sdb.hostelBed.createMany({
      data: Array.from({ length: toAdd }, (_, i) =>
        scopedCreateData<Prisma.HostelBedUncheckedCreateInput>({ roomId, bedNo: String(highestBedNo + i + 1) })
      ),
    });
  } else if (capacity < beds.length) {
    // Shrinking — remove the highest-numbered beds first, but never one
    // that's currently occupied (mirrors deleteClass's "can't delete
    // what's still in use" guard in app/app/institute/actions.ts).
    const toRemove = beds.length - capacity;
    const removable = [...beds].sort((a, b) => Number(b.bedNo) - Number(a.bedNo)).slice(0, toRemove);
    const occupiedAmongRemovable = removable.filter((b) => b.allocation);
    if (occupiedAmongRemovable.length > 0) {
      throw new Error(`Can't reduce capacity — bed${occupiedAmongRemovable.length === 1 ? "" : "s"} ${occupiedAmongRemovable.map((b) => b.bedNo).join(", ")} still occupied.`);
    }
    await sdb.hostelBed.deleteMany({ where: { id: { in: removable.map((b) => b.id) } } });
  }

  await sdb.hostelRoom.update({ where: { id: roomId }, data: { roomNo: roomNo.trim(), roomSize: roomSize.trim() || null, capacity } });
  revalidatePath("/app/hostel");
}

export async function allocateRoom(roomId: string, studentId: string, bedId?: string) {
  await requireModuleAccess("Hostel", "EDIT");
  const sdb = await getScopedDb();

  const [room, allocatedCount] = await Promise.all([
    sdb.hostelRoom.findUniqueOrThrow({ where: { id: roomId } }),
    sdb.hostelAllocation.count({ where: { roomId } }),
    sdb.student.findUniqueOrThrow({ where: { id: studentId }, select: { id: true } }),
  ]);
  if (allocatedCount >= room.capacity) throw new Error("Room is at full capacity.");

  let resolvedBedId: string | null = null;
  if (bedId) {
    const bed = await sdb.hostelBed.findUniqueOrThrow({ where: { id: bedId }, include: { allocation: true } });
    if (bed.roomId !== roomId) throw new Error("That bed doesn't belong to this room.");
    if (bed.allocation) throw new Error("That bed is already occupied.");
    resolvedBedId = bed.id;
  } else {
    // bedNo is free text (usually numeric strings) — sort numerically in
    // JS rather than relying on Prisma's lexicographic orderBy, so bed
    // "2" sorts before bed "10".
    const availableBeds = await sdb.hostelBed.findMany({ where: { roomId, allocation: null } });
    availableBeds.sort((a, b) => Number(a.bedNo) - Number(b.bedNo) || a.bedNo.localeCompare(b.bedNo));
    resolvedBedId = availableBeds[0]?.id ?? null;
  }

  await sdb.hostelAllocation.create({
    data: scopedCreateData<Prisma.HostelAllocationUncheckedCreateInput>({ roomId, studentId, bedId: resolvedBedId, dateFrom: new Date() }),
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
