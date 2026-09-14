"use server";

import { revalidatePath } from "next/cache";
import { Prisma, MealType } from "@prisma/client";
import { auth } from "@/auth";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";

/** Logs what was actually served for a given day+meal — distinct from HostelMessMenu, the recurring weekly plan. Upserts so re-logging the same day+meal edits it rather than duplicating. */
export async function logMealServed(date: string, mealType: MealType, description: string, headcount: number | null) {
  await requireModuleAccess("Hostel", "EDIT");
  if (!description.trim()) throw new Error("Description is required.");
  const session = await auth();
  const sdb = await getScopedDb();
  await sdb.hostelMealServed.upsert({
    where: { schoolId_date_mealType: { schoolId: session!.user.schoolId!, date: new Date(date), mealType } },
    update: { description: description.trim(), headcount },
    create: scopedCreateData<Prisma.HostelMealServedUncheckedCreateInput>({ date: new Date(date), mealType, description: description.trim(), headcount }),
  });
  revalidatePath("/app/hostel");
}

export async function deleteMealServed(id: string) {
  await requireModuleAccess("Hostel", "EDIT");
  const sdb = await getScopedDb();
  await sdb.hostelMealServed.delete({ where: { id } });
  revalidatePath("/app/hostel");
}
