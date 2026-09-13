"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";

/** Marks a student picked up or dropped off, right now, for the given route/date — upserts on the (studentId, date) unique key so pickup and drop can be marked independently, in either order, without clobbering each other. */
export async function markTransportEvent(studentId: string, routeId: string, date: string, event: "pickup" | "drop") {
  await requireModuleAccess("Transport", "EDIT");
  const sdb = await getScopedDb();
  await sdb.student.findUniqueOrThrow({ where: { id: studentId }, select: { id: true } });
  await sdb.transportRoute.findUniqueOrThrow({ where: { id: routeId }, select: { id: true } });
  const now = new Date();
  const field = event === "pickup" ? "pickupAt" : "dropAt";

  await sdb.transportAttendance.upsert({
    where: { studentId_date: { studentId, date: new Date(date) } },
    update: { [field]: now, routeId },
    create: scopedCreateData<Prisma.TransportAttendanceUncheckedCreateInput>({ studentId, routeId, date: new Date(date), [field]: now }),
  });

  revalidatePath("/app/transport");
}

export async function unmarkTransportEvent(studentId: string, date: string, event: "pickup" | "drop") {
  await requireModuleAccess("Transport", "EDIT");
  const sdb = await getScopedDb();
  const field = event === "pickup" ? "pickupAt" : "dropAt";
  await sdb.transportAttendance.update({ where: { studentId_date: { studentId, date: new Date(date) } }, data: { [field]: null } }).catch(() => {});
  revalidatePath("/app/transport");
}
