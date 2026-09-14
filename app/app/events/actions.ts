"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";

export type FormState = { error?: string };

export async function createEvent(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireModuleAccess("Events", "EDIT");
  const sdb = await getScopedDb();

  const title = formData.get("title");
  const type = formData.get("type");
  const date = formData.get("date");
  const venue = formData.get("venue");
  const expectedAttendance = formData.get("expectedAttendance");
  const budgetEstimate = formData.get("budgetEstimate");

  if (typeof title !== "string" || !title.trim() || typeof date !== "string" || !date) {
    return { error: "Title and date are required." };
  }

  const event = await sdb.event.create({
    data: scopedCreateData<Prisma.EventUncheckedCreateInput>({
      title: title.trim(),
      type: typeof type === "string" && type ? type : null,
      date: new Date(date),
      venue: typeof venue === "string" && venue ? venue : null,
      expectedAttendance: typeof expectedAttendance === "string" && expectedAttendance ? Number(expectedAttendance) : null,
      budgetEstimate: typeof budgetEstimate === "string" && budgetEstimate ? Number(budgetEstimate) : null,
    }),
  });

  revalidatePath("/app/events");
  redirect(`/app/events?event=${event.id}`);
}

export async function addChecklistItem(eventId: string, task: string) {
  await requireModuleAccess("Events", "EDIT");
  const sdb = await getScopedDb();
  await sdb.event.findUniqueOrThrow({ where: { id: eventId }, select: { id: true } });
  await sdb.eventChecklistItem.create({
    data: scopedCreateData<Prisma.EventChecklistItemUncheckedCreateInput>({ eventId, task }),
  });
  revalidatePath("/app/events");
}

export async function toggleChecklistItem(itemId: string) {
  await requireModuleAccess("Events", "EDIT");
  const sdb = await getScopedDb();
  const item = await sdb.eventChecklistItem.findUniqueOrThrow({ where: { id: itemId } });
  await sdb.eventChecklistItem.update({ where: { id: itemId }, data: { status: item.status === "DONE" ? "PENDING" : "DONE" } });
  revalidatePath("/app/events");
}

export async function sendEventReminder(eventId: string) {
  await requireModuleAccess("Events", "EDIT");
  const sdb = await getScopedDb();
  const event = await sdb.event.findUniqueOrThrow({ where: { id: eventId } });

  await sdb.announcement.create({
    data: scopedCreateData<Prisma.AnnouncementUncheckedCreateInput>({
      title: `Reminder: ${event.title}`,
      body: `This is a reminder about "${event.title}" on ${event.date.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}${event.venue ? ` at ${event.venue}` : ""}.`,
      audienceType: "ALL_PARENTS",
      publishedOn: new Date(),
    }),
  });

  revalidatePath("/app/events");
  return { success: true };
}
