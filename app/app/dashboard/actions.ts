"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";

async function requireAdmin() {
  const session = await auth();
  if (session!.user.role !== "SCHOOL_ADMIN") throw new Error("Only a School Admin can manage the dashboard.");
}

export async function addReminder(title: string, content: string, remindAt: string) {
  await requireAdmin();
  if (!title.trim()) throw new Error("A title is required.");
  if (!remindAt) throw new Error("Pick a date to schedule this reminder for.");
  const sdb = await getScopedDb();
  await sdb.dashboardReminder.create({
    data: scopedCreateData<Prisma.DashboardReminderUncheckedCreateInput>({
      title: title.trim(),
      content: content.trim(),
      remindAt: new Date(remindAt),
    }),
  });
  revalidatePath("/app/dashboard");
}

export async function removeReminder(id: string) {
  await requireAdmin();
  const sdb = await getScopedDb();
  await sdb.dashboardReminder.delete({ where: { id } });
  revalidatePath("/app/dashboard");
}

export async function addNote(content: string) {
  await requireAdmin();
  if (!content.trim()) throw new Error("Write something before saving the note.");
  const sdb = await getScopedDb();
  await sdb.dashboardNote.create({
    data: scopedCreateData<Prisma.DashboardNoteUncheckedCreateInput>({ content: content.trim() }),
  });
  revalidatePath("/app/dashboard");
}

export async function removeNote(id: string) {
  await requireAdmin();
  const sdb = await getScopedDb();
  await sdb.dashboardNote.delete({ where: { id } });
  revalidatePath("/app/dashboard");
}
