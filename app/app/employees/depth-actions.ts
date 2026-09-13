"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getScopedDb } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { requireFeature } from "@/lib/feature-flags";
import { saveUploadedFile } from "@/lib/storage";

async function schoolId() {
  const session = await auth();
  return session!.user.schoolId!;
}

// updateStaffQualifications (Batch 11 — HR depth) will live here once
// StaffProfile grows qualification/specialization fields; not yet added.

export async function addStaffDocument(staffId: string, category: string, formData: FormData) {
  const sdb = await getScopedDb();
  await requireModuleAccess("Employees", "EDIT");
  await requireFeature(await schoolId(), "employees.documents");
  await sdb.staffProfile.findUniqueOrThrow({ where: { id: staffId }, select: { id: true } });

  const file = formData.get("file");
  const expiryDate = formData.get("expiryDate");
  if (!(file instanceof File) || file.size === 0) return;

  const bytes = Buffer.from(await file.arrayBuffer());
  const { storagePath } = await saveUploadedFile(`documents/${await schoolId()}`, file.name, bytes);

  await sdb.personDocument.create({
    data: {
      schoolId: await schoolId(),
      subjectType: "STAFF",
      staffId,
      category,
      label: file.name,
      filePath: storagePath,
      expiryDate: typeof expiryDate === "string" && expiryDate ? new Date(expiryDate) : null,
    },
  });
  revalidatePath(`/app/employees/${staffId}`);
}
