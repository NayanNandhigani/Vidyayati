"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma, Gender } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { requireFeature } from "@/lib/feature-flags";
import { createPendingAccount } from "@/lib/account-setup";
import type { StaffFormState } from "./actions";

function str(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** A full teaching/non-teaching application form in one submit — same account-creation flow as createStaff, plus every detailed-profile field. */
export async function createStaffDetailed(_prevState: StaffFormState, formData: FormData): Promise<StaffFormState> {
  const session = await auth();
  if (session!.user.role !== "SCHOOL_ADMIN") return { error: "Only a School Admin can add staff." };
  await requireFeature(session!.user.schoolId, "employees.detailedProfile");
  const sdb = await getScopedDb();

  const name = str(formData, "name");
  const username = str(formData, "username");
  if (!name || !username) return { error: "Name and username are required." };

  const normalizedUsername = username.toLowerCase();
  const existing = await db.user.findUnique({ where: { username: normalizedUsername } });
  if (existing) return { error: "A user with this username already exists." };

  const school = await db.school.findUnique({ where: { id: session!.user.schoolId! }, select: { maxStaff: true } });
  if (school?.maxStaff != null) {
    const staffCount = await sdb.user.count({ where: { role: "STAFF" } });
    if (staffCount >= school.maxStaff) {
      return { error: `This school's staff limit (${school.maxStaff}) has been reached. Contact Vidya Yati to raise it.` };
    }
  }

  const { token, setupTokenHash, setupTokenExpiresAt, placeholderHash } = await createPendingAccount();
  const gender = str(formData, "gender");
  const dob = str(formData, "dob");
  const yearsOfExperience = str(formData, "yearsOfExperience");

  const user = await sdb.user.create({
    data: scopedCreateData<Prisma.UserUncheckedCreateInput>({
      name,
      username: normalizedUsername,
      phone: str(formData, "mobilePrimary"),
      role: "STAFF",
      passwordHash: placeholderHash,
      setupTokenHash,
      setupTokenExpiresAt,
    }),
  });

  const staff = await sdb.staffProfile.create({
    data: scopedCreateData<Prisma.StaffProfileUncheckedCreateInput>({
      userId: user.id,
      designation: str(formData, "designation"),
      department: str(formData, "department"),
      staffCategory: str(formData, "staffCategory") === "NON_TEACHING" ? "NON_TEACHING" : "TEACHING",
      dateJoined: new Date(),
      employeeId: str(formData, "employeeId"),
      dob: dob ? new Date(dob) : null,
      gender: gender ? (gender as Gender) : null,
      bloodGroup: str(formData, "bloodGroup"),
      maritalStatus: str(formData, "maritalStatus"),
      nationality: str(formData, "nationality"),
      aadhaarNumber: str(formData, "aadhaarNumber"),
      panNumber: str(formData, "panNumber"),
      mobilePrimary: str(formData, "mobilePrimary"),
      mobileAlternate: str(formData, "mobileAlternate"),
      personalEmail: str(formData, "personalEmail"),
      currentAddress: str(formData, "currentAddress"),
      permanentAddress: str(formData, "permanentAddress"),
      emergencyContactName: str(formData, "emergencyContactName"),
      emergencyContactPhone: str(formData, "emergencyContactPhone"),
      employmentType: str(formData, "employmentType"),
      workLocation: str(formData, "workLocation"),
      reportingManagerId: str(formData, "reportingManagerId"),
      driversLicenseNo: str(formData, "driversLicenseNo"),
      teachingCertification: str(formData, "teachingCertification"),
      yearsOfExperience: yearsOfExperience ? Number(yearsOfExperience) : null,
      previousEmployerName: str(formData, "previousEmployerName"),
      previousDesignation: str(formData, "previousDesignation"),
      qualifications: str(formData, "qualifications"),
      specialization: str(formData, "specialization"),
      salaryPayGrade: str(formData, "salaryPayGrade"),
      bankAccountNumber: str(formData, "bankAccountNumber"),
      ifscCode: str(formData, "ifscCode"),
      bankName: str(formData, "bankName"),
      pfNumber: str(formData, "pfNumber"),
      uanNumber: str(formData, "uanNumber"),
      esiNumber: str(formData, "esiNumber"),
    }),
  });

  revalidatePath("/app/employees");
  redirect(`/app/employees/${staff.id}?setupToken=${token}`);
}

export async function suggestEmployeeId(): Promise<string> {
  const session = await auth();
  await requireModuleAccess("Employees", "EDIT");
  const sdb = await getScopedDb();
  const count = await sdb.staffProfile.count();
  return `EMP-${String(count + 1).padStart(4, "0")}`;
}

export type DetailedProfileFields = {
  employeeId: string | null;
  dob: string | null;
  gender: Gender | null;
  bloodGroup: string | null;
  maritalStatus: string | null;
  nationality: string | null;
  aadhaarNumber: string | null;
  panNumber: string | null;
  mobilePrimary: string | null;
  mobileAlternate: string | null;
  personalEmail: string | null;
  currentAddress: string | null;
  permanentAddress: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  employmentType: string | null;
  workLocation: string | null;
  reportingManagerId: string | null;
  driversLicenseNo: string | null;
  teachingCertification: string | null;
  yearsOfExperience: number | null;
  previousEmployerName: string | null;
  previousDesignation: string | null;
  salaryPayGrade: string | null;
  bankAccountNumber: string | null;
  ifscCode: string | null;
  bankName: string | null;
  pfNumber: string | null;
  uanNumber: string | null;
  esiNumber: string | null;
};

/** Editing the detailed profile after creation, from the staff detail view. */
export async function updateStaffDetailedProfile(staffId: string, fields: DetailedProfileFields) {
  await requireModuleAccess("Employees", "EDIT");
  const session = await auth();
  await requireFeature(session!.user.schoolId, "employees.detailedProfile");
  const sdb = await getScopedDb();
  await sdb.staffProfile.update({
    where: { id: staffId },
    data: {
      ...fields,
      dob: fields.dob ? new Date(fields.dob) : null,
    },
  });
  revalidatePath(`/app/employees/${staffId}`);
}
