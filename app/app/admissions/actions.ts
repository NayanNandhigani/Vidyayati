"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { enrollStudent } from "@/lib/domain/enrollment";

export type EnquiryFormState = { error?: string };

export async function createEnquiry(_prevState: EnquiryFormState, formData: FormData): Promise<EnquiryFormState> {
  await requireModuleAccess("Admissions", "EDIT");
  const sdb = await getScopedDb();

  const applicantName = formData.get("applicantName");
  const parentContact = formData.get("parentContact");
  const classApplied = formData.get("classApplied");
  const parentName = formData.get("parentName");
  const address = formData.get("address");

  if (typeof applicantName !== "string" || !applicantName.trim() || typeof parentContact !== "string" || !parentContact.trim() || typeof classApplied !== "string" || !classApplied.trim()) {
    return { error: "All fields are required." };
  }

  await sdb.admissionEnquiry.create({
    data: scopedCreateData<Prisma.AdmissionEnquiryUncheckedCreateInput>({
      applicantName: applicantName.trim(),
      parentContact: parentContact.trim(),
      classApplied: classApplied.trim(),
      parentName: typeof parentName === "string" && parentName.trim() ? parentName.trim() : null,
      address: typeof address === "string" && address.trim() ? address.trim() : null,
    }),
  });

  revalidatePath("/app/admissions");
  redirect("/app/admissions");
}

export async function advanceToApplication(enquiryId: string) {
  await requireModuleAccess("Admissions", "EDIT");
  const sdb = await getScopedDb();
  await sdb.admissionEnquiry.update({ where: { id: enquiryId }, data: { stage: "APPLICATION" } });
  revalidatePath("/app/admissions");
}

export async function admitEnquiry(enquiryId: string, classId: string) {
  await requireModuleAccess("Admissions", "EDIT");
  const sdb = await getScopedDb();

  const enquiry = await sdb.admissionEnquiry.findUniqueOrThrow({ where: { id: enquiryId } });
  if (enquiry.stage === "ADMITTED") throw new Error("This application has already been admitted.");
  await sdb.class.findUniqueOrThrow({ where: { id: classId }, select: { id: true } });
  const count = await sdb.student.count();
  const admissionNo = `AD-${2000 + count + 1}`;

  // AdmissionEnquiry only has one free-text applicantName field — split on
  // the last space into first name / surname (a single-word name lands
  // entirely in firstName, matching the same fallback used to backfill
  // this split historically).
  const nameParts = enquiry.applicantName.trim().split(/\s+/);
  const surname = nameParts.length > 1 ? nameParts.pop()! : "";
  const firstName = nameParts.join(" ");

  const student = await sdb.$transaction(async (tx) => {
    const student = await tx.student.create({
      data: scopedCreateData<Prisma.StudentUncheckedCreateInput>({
        firstName,
        surname,
        admissionNo,
        classId,
        status: "ACTIVE",
      }),
    });
    await enrollStudent(student.id, classId, undefined, tx);
    await tx.admissionEnquiry.update({ where: { id: enquiryId }, data: { stage: "ADMITTED", convertedStudentId: student.id } });
    return student;
  });

  revalidatePath("/app/admissions");
  revalidatePath("/app/students");
  return { studentId: student.id };
}
