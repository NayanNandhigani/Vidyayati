"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";

export type LaundryItemInput = { itemType: string; quantity: number };

export async function registerLaundry(studentId: string, items: LaundryItemInput[], collectionDate: string | null) {
  await requireModuleAccess("Hostel", "EDIT");
  if (!studentId) throw new Error("Pick a student.");
  const cleanItems = items.filter((i) => i.itemType.trim() && i.quantity > 0);
  if (cleanItems.length === 0) throw new Error("Add at least one clothing item.");

  const sdb = await getScopedDb();
  await sdb.student.findUniqueOrThrow({ where: { id: studentId }, select: { id: true } });
  const count = await sdb.laundryTicket.count();
  const tokenNo = `LT-${1000 + count + 1}`;

  const ticket = await sdb.laundryTicket.create({
    data: scopedCreateData<Prisma.LaundryTicketUncheckedCreateInput>({
      studentId,
      tokenNo,
      collectionDate: collectionDate ? new Date(collectionDate) : null,
    }),
  });
  await sdb.laundryItem.createMany({
    data: cleanItems.map((i) => scopedCreateData<Prisma.LaundryItemUncheckedCreateInput>({ ticketId: ticket.id, itemType: i.itemType.trim(), quantity: i.quantity })),
  });

  revalidatePath("/app/hostel");
  return { id: ticket.id, tokenNo: ticket.tokenNo };
}

export async function markLaundryCollected(ticketId: string) {
  await requireModuleAccess("Hostel", "EDIT");
  const sdb = await getScopedDb();
  await sdb.laundryTicket.update({ where: { id: ticketId }, data: { status: "COLLECTED", collectedAt: new Date() } });
  revalidatePath("/app/hostel");
}

export async function deleteLaundryTicket(ticketId: string) {
  await requireModuleAccess("Hostel", "EDIT");
  const sdb = await getScopedDb();
  await sdb.laundryTicket.delete({ where: { id: ticketId } });
  revalidatePath("/app/hostel");
}
