"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { renderCertificateBody } from "@/lib/certificates";
import { saveUploadedFile, deleteUploadedFile } from "@/lib/storage";

async function requireAdmin() {
  const session = await auth();
  if (session!.user.role !== "SCHOOL_ADMIN") throw new Error("Only a School Admin can manage certificate templates.");
}

export type FormState = { error?: string; success?: boolean };

export async function issueCertificate(templateId: string, studentId: string) {
  await requireModuleAccess("Certificates", "EDIT");
  const session = await auth();
  const sdb = await getScopedDb();

  const staffProfile =
    session!.user.role === "STAFF" ? await db.staffProfile.findUnique({ where: { userId: session!.user.id } }) : null;

  const [template, student, school, currentYear] = await Promise.all([
    sdb.certificateTemplate.findUniqueOrThrow({ where: { id: templateId } }),
    sdb.student.findUniqueOrThrow({ where: { id: studentId }, include: { class: true } }),
    db.school.findUniqueOrThrow({ where: { id: session!.user.schoolId! } }),
    sdb.academicYear.findFirst({ where: { isCurrent: true } }),
  ]);

  const renderedBody = renderCertificateBody(template.bodyText, {
    name: `${student.firstName} ${student.surname}`,
    admissionNo: student.admissionNo,
    school: school.name,
    class: `Class ${student.class.grade}, Section ${student.class.section}`,
    year: currentYear?.label ?? "—",
  });

  const issued = await sdb.certificateIssued.create({
    data: scopedCreateData<Prisma.CertificateIssuedUncheckedCreateInput>({
      studentId,
      templateId,
      issuedDate: new Date(),
      issuedByStaffId: staffProfile?.id ?? null,
      renderedBody,
    }),
  });

  revalidatePath("/app/certificates");
  return { id: issued.id };
}

export async function updateCertificateTemplate(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const sdb = await getScopedDb();

  const id = formData.get("id");
  const label = formData.get("label");
  const title = formData.get("title");
  const bodyText = formData.get("bodyText");
  if (typeof id !== "string" || !id) return { error: "Missing template." };
  if (typeof label !== "string" || !label.trim()) return { error: "Label is required." };
  if (typeof title !== "string" || !title.trim()) return { error: "Printed title is required." };
  if (typeof bodyText !== "string" || !bodyText.trim()) return { error: "Certificate text is required." };

  const session = await auth();
  const schoolId = session!.user.schoolId!;
  const existing = await sdb.certificateTemplate.findUnique({ where: { id } });

  let logoPath = existing?.logoPath ?? null;
  const logoFile = formData.get("logo");
  if (logoFile instanceof File && logoFile.size > 0) {
    const bytes = Buffer.from(await logoFile.arrayBuffer());
    const { storagePath } = await saveUploadedFile(`certificates/${schoolId}`, logoFile.name, bytes);
    if (existing?.logoPath) await deleteUploadedFile(existing.logoPath);
    logoPath = storagePath;
  }

  await sdb.certificateTemplate.update({
    where: { id },
    data: { label: label.trim(), title: title.trim(), bodyText: bodyText.trim(), logoPath },
  });

  revalidatePath("/app/settings");
  revalidatePath("/app/certificates");
  return { success: true };
}

export async function removeCertificateTemplateLogo(id: string) {
  await requireAdmin();
  const sdb = await getScopedDb();

  const existing = await sdb.certificateTemplate.findUnique({ where: { id } });
  if (!existing?.logoPath) return;

  await deleteUploadedFile(existing.logoPath);
  await sdb.certificateTemplate.update({ where: { id }, data: { logoPath: null } });

  revalidatePath("/app/settings");
  revalidatePath("/app/certificates");
}

export async function createCustomCertificateTemplate(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const sdb = await getScopedDb();

  const label = formData.get("label");
  if (typeof label !== "string" || !label.trim()) return { error: "Name is required." };

  await sdb.certificateTemplate.create({
    data: scopedCreateData<Prisma.CertificateTemplateUncheckedCreateInput>({
      type: "CUSTOM",
      label: label.trim(),
      title: label.trim(),
      bodyText: "This is to certify that {{name}}, Admission No. {{admissionNo}}, a student of {{class}}, {{school}}, ...",
    }),
  });

  revalidatePath("/app/settings");
  revalidatePath("/app/certificates");
  return { success: true };
}

export async function deleteCertificateTemplate(id: string): Promise<{ error?: string }> {
  await requireAdmin();
  const sdb = await getScopedDb();

  const issuedCount = await sdb.certificateIssued.count({ where: { templateId: id } });
  if (issuedCount > 0) {
    return { error: `Cannot delete — ${issuedCount} certificate${issuedCount === 1 ? "" : "s"} already issued from this template.` };
  }

  const existing = await sdb.certificateTemplate.findUnique({ where: { id } });
  if (existing?.logoPath) await deleteUploadedFile(existing.logoPath);
  await sdb.certificateTemplate.delete({ where: { id } });

  revalidatePath("/app/settings");
  revalidatePath("/app/certificates");
  return {};
}
