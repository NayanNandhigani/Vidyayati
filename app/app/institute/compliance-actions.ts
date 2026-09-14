"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getScopedDb } from "@/lib/tenant-db";
import { requireFeature } from "@/lib/feature-flags";

async function requireAdmin() {
  const session = await auth();
  if (session!.user.role !== "SCHOOL_ADMIN") throw new Error("Only a School Admin can manage the institute.");
  return session!.user.schoolId!;
}

export async function updateClassRteQuota(classId: string, rteQuotaSeats: number | null) {
  const schoolId = await requireAdmin();
  await requireFeature(schoolId, "compliance.udise");
  const sdb = await getScopedDb();
  await sdb.class.update({ where: { id: classId }, data: { rteQuotaSeats } });
  revalidatePath("/app/institute");
}
