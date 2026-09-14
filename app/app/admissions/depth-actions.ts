"use server";

import { revalidatePath } from "next/cache";
import { Prisma, Gender } from "@prisma/client";
import { auth } from "@/auth";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { requireFeature } from "@/lib/feature-flags";
import { enrollStudent } from "@/lib/domain/enrollment";

async function schoolId() {
  const session = await auth();
  return session!.user.schoolId!;
}

export type ApplicationFields = {
  photoPath: string | null;
  dob: string | null;
  gender: Gender | null;
  bloodGroup: string | null;
  nationality: string | null;
  caste: string | null;
  religionCategory: string | null;
  motherTongue: string | null;
  studentAadhaarNumber: string | null;
  fatherName: string | null;
  motherName: string | null;
  guardianName: string | null;
  fatherOccupation: string | null;
  motherOccupation: string | null;
  contactNumber2: string | null;
  annualIncome: string | null;
  email: string | null;
  parentAadhaarNumber: string | null;
  permanentAddress: string | null;
  currentAddress: string | null;
  pincode: string | null;
  allergiesConditions: string | null;
  emergencyContactName: string | null;
  emergencyContactNumber: string | null;
  familyDoctorContact: string | null;
  udiseNumber: string | null;
  penNumber: string | null;
};

export async function updateApplicationDetails(enquiryId: string, fields: ApplicationFields) {
  await requireModuleAccess("Admissions", "EDIT");
  await requireFeature(await schoolId(), "admissions.detailedForm");
  const sdb = await getScopedDb();
  await sdb.admissionEnquiry.update({
    where: { id: enquiryId },
    data: { ...fields, dob: fields.dob ? new Date(fields.dob) : null },
  });
  revalidatePath("/app/admissions");
  revalidatePath(`/app/admissions/${enquiryId}`);
}

/** The "Admit" button on a filled-in Application — flags it to the School Admin instead of creating the student immediately. */
export async function submitForAdmitApproval(enquiryId: string) {
  await requireModuleAccess("Admissions", "EDIT");
  await requireFeature(await schoolId(), "admissions.detailedForm");
  const sdb = await getScopedDb();
  await sdb.admissionEnquiry.update({
    where: { id: enquiryId },
    data: { approvalStatus: "PENDING", submittedForApprovalAt: new Date() },
  });
  revalidatePath("/app/admissions");
  revalidatePath(`/app/admissions/${enquiryId}`);
}

/**
 * The School Admin's approval step — picks the real Class (the Enquiry
 * only ever held a free-text classApplied) and, optionally, an opening
 * fee for the new student (reuses FeeAdjustment, same mechanism as the
 * Fees module's own "additional charge", rather than inventing a second
 * one). Creates the Student exactly as the existing, untouched
 * admitEnquiry does for schools without this feature.
 */
export async function approveAdmissionWithFee(
  enquiryId: string,
  classId: string,
  openingFeeDescription: string | null,
  openingFeeAmount: number | null,
  chargedFee: number | null
) {
  await requireModuleAccess("Admissions", "EDIT");
  await requireFeature(await schoolId(), "admissions.detailedForm");
  const session = await auth();
  if (session!.user.role !== "SCHOOL_ADMIN") throw new Error("Only a School Admin can approve an admission.");
  const sdb = await getScopedDb();

  const enquiry = await sdb.admissionEnquiry.findUniqueOrThrow({ where: { id: enquiryId } });
  if (enquiry.approvalStatus !== "PENDING") throw new Error("This application isn't pending approval.");

  const targetClass = await sdb.class.findUniqueOrThrow({ where: { id: classId }, select: { grade: true, yearId: true } });

  if (chargedFee != null) {
    const feeDefault = await sdb.classFeeDefault.findUnique({ where: { yearId_grade: { yearId: targetClass.yearId, grade: targetClass.grade } } });
    if (feeDefault && chargedFee > Number(feeDefault.actualFee)) {
      throw new Error("Charged fee can't be more than the actual fee.");
    }
  }

  const count = await sdb.student.count();
  const admissionNo = `AD-${2000 + count + 1}`;
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
        dob: enquiry.dob,
        gender: enquiry.gender,
        chargedFee,
      }),
    });
    await enrollStudent(student.id, classId, undefined, tx);

    if (openingFeeAmount && openingFeeAmount > 0) {
      await tx.feeAdjustment.create({
        data: scopedCreateData<Prisma.FeeAdjustmentUncheckedCreateInput>({
          studentId: student.id,
          description: openingFeeDescription?.trim() || "Admission fee",
          amount: openingFeeAmount,
        }),
      });
    }

    await tx.admissionEnquiry.update({
      where: { id: enquiryId },
      data: { stage: "ADMITTED", convertedStudentId: student.id, approvalStatus: "APPROVED", approvalActionAt: new Date() },
    });

    return student;
  });

  revalidatePath("/app/admissions");
  revalidatePath("/app/students");
  revalidatePath("/app/fees");
  return { studentId: student.id };
}

export async function rejectAdmission(enquiryId: string) {
  await requireModuleAccess("Admissions", "EDIT");
  await requireFeature(await schoolId(), "admissions.detailedForm");
  const session = await auth();
  if (session!.user.role !== "SCHOOL_ADMIN") throw new Error("Only a School Admin can reject an admission.");
  const sdb = await getScopedDb();
  await sdb.admissionEnquiry.update({
    where: { id: enquiryId },
    data: { approvalStatus: "REJECTED", approvalActionAt: new Date() },
  });
  revalidatePath("/app/admissions");
  revalidatePath(`/app/admissions/${enquiryId}`);
}
