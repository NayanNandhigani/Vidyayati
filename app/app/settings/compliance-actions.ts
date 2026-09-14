"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { requireFeature } from "@/lib/feature-flags";
import { saveUploadedFile, deleteUploadedFile } from "@/lib/storage";
import { buildCsv } from "@/lib/csv";

async function requireAdmin() {
  const session = await auth();
  if (session!.user.role !== "SCHOOL_ADMIN") throw new Error("Only a School Admin can manage compliance settings.");
  return session!.user.schoolId!;
}

export async function updateUdiseFields(udiseCode: string, affiliationBoard: string, affiliationNumber: string) {
  const schoolId = await requireAdmin();
  await requireFeature(schoolId, "compliance.udise");
  const sdb = await getScopedDb();
  await sdb.school.update({
    where: { id: schoolId },
    data: {
      udiseCode: udiseCode.trim() || null,
      affiliationBoard: affiliationBoard.trim() || null,
      affiliationNumber: affiliationNumber.trim() || null,
    },
  });
  revalidatePath("/app/settings");
}

export async function uploadComplianceDocument(formData: FormData) {
  const schoolId = await requireAdmin();
  await requireFeature(schoolId, "compliance.udise");

  const documentType = formData.get("documentType");
  const documentNo = formData.get("documentNo");
  const issuedDate = formData.get("issuedDate");
  const expiryDate = formData.get("expiryDate");
  const file = formData.get("file");

  if (typeof documentType !== "string" || !documentType.trim()) throw new Error("Document type is required.");

  let filePath: string | null = null;
  if (file instanceof File && file.size > 0) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const saved = await saveUploadedFile(`documents/${schoolId}`, file.name, bytes);
    filePath = saved.storagePath;
  }

  const sdb = await getScopedDb();
  await sdb.schoolComplianceDocument.create({
    data: scopedCreateData<Prisma.SchoolComplianceDocumentUncheckedCreateInput>({
      documentType: documentType.trim(),
      documentNo: typeof documentNo === "string" && documentNo ? documentNo : null,
      issuedDate: typeof issuedDate === "string" && issuedDate ? new Date(issuedDate) : null,
      expiryDate: typeof expiryDate === "string" && expiryDate ? new Date(expiryDate) : null,
      filePath,
    }),
  });
  revalidatePath("/app/settings");
}

export async function deleteComplianceDocument(docId: string) {
  const schoolId = await requireAdmin();
  await requireFeature(schoolId, "compliance.udise");
  const sdb = await getScopedDb();
  const doc = await sdb.schoolComplianceDocument.findUniqueOrThrow({ where: { id: docId } });
  if (doc.filePath) await deleteUploadedFile(doc.filePath);
  await sdb.schoolComplianceDocument.delete({ where: { id: docId } });
  revalidatePath("/app/settings");
}

/**
 * A UDISE+-shaped export — school profile + section-wise enrolment/RTE
 * quota. Field mapping is a best-effort layout, not certified against
 * the current year's official UDISE+ spec; verify before filing.
 */
export async function exportUdiseCsv(): Promise<string> {
  const schoolId = await requireAdmin();
  await requireFeature(schoolId, "compliance.udise");
  const sdb = await getScopedDb();

  const [school, classes] = await Promise.all([
    sdb.school.findUniqueOrThrow({ where: { id: schoolId } }),
    sdb.class.findMany({ include: { _count: { select: { students: true } } }, orderBy: [{ grade: "asc" }, { section: "asc" }] }),
  ]);

  const header = ["UDISE Code", "School Name", "Affiliation Board", "Affiliation Number", "Grade", "Section", "Enrolment", "RTE Quota Seats"];
  const rows = classes.map((c) => [school.udiseCode ?? "", school.name, school.affiliationBoard ?? "", school.affiliationNumber ?? "", c.grade, c.section, c._count.students, c.rteQuotaSeats ?? ""]);
  return buildCsv(header, rows);
}
