"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { SchoolStatus, SchoolDocumentCategory } from "@prisma/client";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { requirePlatformModuleAccess } from "@/lib/permissions";
import { saveUploadedFile, deleteUploadedFile } from "@/lib/storage";
import { readAddress, readContactAddress } from "@/lib/address";
import { FEATURE_KEYS, type FeatureKey } from "@/lib/feature-flags";
import { createPendingAccount } from "@/lib/account-setup";

const AADHAR_PATTERN = /^\d{12}$/;

function validateAadhar(formData: FormData): string | null | "INVALID" {
  const raw = formData.get("contactAadharNumber");
  if (typeof raw !== "string" || !raw.trim()) return null;
  const digitsOnly = raw.replace(/\s|-/g, "");
  return AADHAR_PATTERN.test(digitsOnly) ? digitsOnly : "INVALID";
}

const VALID_DOC_CATEGORIES: SchoolDocumentCategory[] = ["CONTRACT", "REGISTRATION", "ID_PROOF", "OTHER"];
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15MB

export type SchoolFormState = { error?: string };
export type ManageFormState = { error?: string; success?: boolean };

const VALID_STATUSES: SchoolStatus[] = ["TRIAL", "ACTIVE", "EXPIRING", "OVERDUE", "CANCELLED"];

export async function generateSchoolCode(name: string): Promise<string> {
  const initials =
    name
      .replace(/[^a-zA-Z ]/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 4) || "SCH";

  for (let attempt = 0; attempt < 8; attempt++) {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const code = `${initials}${suffix}`;
    const existing = await db.school.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique school code.");
}

export async function onboardSchool(_prevState: SchoolFormState, formData: FormData): Promise<SchoolFormState> {
  const name = formData.get("name");
  const city = formData.get("city");
  const registrationNumber = formData.get("registrationNumber");
  const adminName = formData.get("adminName");
  const adminUsername = formData.get("adminUsername");

  if (
    typeof name !== "string" || !name.trim() ||
    typeof adminName !== "string" || !adminName.trim() ||
    typeof adminUsername !== "string" || !adminUsername.trim()
  ) {
    return { error: "School name, admin name, and admin username are required." };
  }

  const username = adminUsername.trim().toLowerCase();
  const existing = await db.user.findUnique({ where: { username } });
  if (existing) return { error: "A user with this username already exists." };

  const aadhar = validateAadhar(formData);
  if (aadhar === "INVALID") return { error: "Aadhar number must be exactly 12 digits." };

  const address = readAddress(formData);
  const contactName = formData.get("contactName");
  const contactPhone = formData.get("contactPhone");
  const hasContact = typeof contactName === "string" && contactName.trim() && typeof contactPhone === "string" && contactPhone.trim();
  const sameAsSchoolAddress = formData.get("sameAsSchoolAddress") === "on";
  const contactAddress = sameAsSchoolAddress ? address : readContactAddress(formData);

  const { token, setupTokenHash, setupTokenExpiresAt, placeholderHash } = await createPendingAccount();
  const code = await generateSchoolCode(name.trim());

  let school;
  try {
    school = await db.school.create({
      data: {
        code,
        name: name.trim(),
        city: typeof city === "string" && city ? city : null,
        state: address.state,
        status: "TRIAL",
        registrationNumber: typeof registrationNumber === "string" && registrationNumber.trim() ? registrationNumber.trim() : null,
        addressLine: address.addressLine,
        mandal: address.mandal,
        district: address.district,
        country: address.country,
        postalCode: address.postalCode,
        users: {
          create: {
            name: adminName.trim(),
            username,
            passwordHash: placeholderHash,
            setupTokenHash,
            setupTokenExpiresAt,
            role: "SCHOOL_ADMIN",
          },
        },
        contactPerson: hasContact
          ? {
              create: {
                name: (contactName as string).trim(),
                phone: (contactPhone as string).trim(),
                alternatePhone: typeof formData.get("contactAlternatePhone") === "string" && (formData.get("contactAlternatePhone") as string).trim() ? (formData.get("contactAlternatePhone") as string).trim() : null,
                email: typeof formData.get("contactEmail") === "string" && (formData.get("contactEmail") as string).trim() ? (formData.get("contactEmail") as string).trim() : null,
                addressLine: contactAddress.addressLine,
                mandal: contactAddress.mandal,
                district: contactAddress.district,
                state: contactAddress.state,
                country: contactAddress.country,
                postalCode: contactAddress.postalCode,
                aadharNumber: aadhar,
              },
            }
          : undefined,
      },
    });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { error: "That registration number is already in use by another school." };
    }
    throw e;
  }

  revalidatePath("/super-admin/schools");
  redirect(`/super-admin/schools/${school.id}?setupToken=${token}`);
}

export async function updateSchool(_prevState: ManageFormState, formData: FormData): Promise<ManageFormState> {
  const session = await auth();
  if (session?.user.role !== "SUPER_ADMIN") return { error: "Only a Super Admin can manage schools." };

  const id = formData.get("id");
  const name = formData.get("name");
  const code = formData.get("code");
  const city = formData.get("city");
  const state = formData.get("state");

  if (typeof id !== "string" || !id) return { error: "Missing school." };
  if (typeof name !== "string" || !name.trim()) return { error: "School name is required." };
  if (typeof code !== "string" || !code.trim()) return { error: "School code is required." };

  const normalizedCode = code.trim().toUpperCase();
  const codeOwner = await db.school.findUnique({ where: { code: normalizedCode } });
  if (codeOwner && codeOwner.id !== id) return { error: "Another school already uses this code." };

  await db.school.update({
    where: { id },
    data: {
      name: name.trim(),
      code: normalizedCode,
      city: typeof city === "string" && city.trim() ? city.trim() : null,
      state: typeof state === "string" && state.trim() ? state.trim() : null,
    },
  });

  revalidatePath("/super-admin/schools");
  revalidatePath(`/super-admin/schools/${id}`);
  return { success: true };
}

export async function updateSchoolStatus(_prevState: ManageFormState, formData: FormData): Promise<ManageFormState> {
  const session = await auth();
  if (session?.user.role !== "SUPER_ADMIN") return { error: "Only a Super Admin can manage schools." };

  const id = formData.get("id");
  const status = formData.get("status");
  if (typeof id !== "string" || !id) return { error: "Missing school." };

  await db.school.update({
    where: { id },
    data: {
      status: VALID_STATUSES.includes(status as SchoolStatus) ? (status as SchoolStatus) : undefined,
    },
  });

  revalidatePath("/super-admin/schools");
  revalidatePath(`/super-admin/schools/${id}`);
  return { success: true };
}

const SCHOOL_MODULES = ["Students", "Employees", "Attendance", "Exams", "Homework", "Timetable", "Fees", "Accounts", "Admissions", "Transport", "Library", "Events", "Certificates", "Communication", "Reports"];

export async function toggleSchoolModule(schoolId: string, moduleName: string): Promise<ManageFormState> {
  const session = await auth();
  if (session?.user.role !== "SUPER_ADMIN") return { error: "Only a Super Admin can manage schools." };
  if (!SCHOOL_MODULES.includes(moduleName)) return { error: "Unknown module." };

  const school = await db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { disabledModules: true } });
  const isDisabled = school.disabledModules.includes(moduleName);
  await db.school.update({
    where: { id: schoolId },
    data: {
      disabledModules: isDisabled ? school.disabledModules.filter((m) => m !== moduleName) : [...school.disabledModules, moduleName],
    },
  });

  revalidatePath(`/super-admin/schools/${schoolId}`);
  return { success: true };
}

// The finer-grained sibling of toggleSchoolModule above — see
// SchoolFeatureFlag's doc-comment in schema.prisma and lib/feature-flags.ts
// for how this differs from disabledModules.
export async function toggleSchoolFeature(schoolId: string, key: FeatureKey): Promise<ManageFormState> {
  const session = await auth();
  if (session?.user.role !== "SUPER_ADMIN") return { error: "Only a Super Admin can manage schools." };
  if (!FEATURE_KEYS.includes(key)) return { error: "Unknown feature." };

  const existing = await db.schoolFeatureFlag.findUnique({ where: { schoolId_key: { schoolId, key } } });
  await db.schoolFeatureFlag.upsert({
    where: { schoolId_key: { schoolId, key } },
    update: { enabled: !(existing?.enabled ?? false) },
    create: { schoolId, key, enabled: true },
  });

  revalidatePath(`/super-admin/schools/${schoolId}`);
  return { success: true };
}

export async function updateSchoolCaps(_prevState: ManageFormState, formData: FormData): Promise<ManageFormState> {
  const session = await auth();
  if (session?.user.role !== "SUPER_ADMIN") return { error: "Only a Super Admin can manage schools." };

  const id = formData.get("id");
  const maxStudentsRaw = formData.get("maxStudents");
  const maxStaffRaw = formData.get("maxStaff");
  if (typeof id !== "string" || !id) return { error: "Missing school." };

  const maxStudents = typeof maxStudentsRaw === "string" && maxStudentsRaw.trim() ? Number(maxStudentsRaw) : null;
  const maxStaff = typeof maxStaffRaw === "string" && maxStaffRaw.trim() ? Number(maxStaffRaw) : null;
  if ((maxStudents != null && (!Number.isFinite(maxStudents) || maxStudents < 0)) || (maxStaff != null && (!Number.isFinite(maxStaff) || maxStaff < 0))) {
    return { error: "Caps must be positive numbers, or blank for uncapped." };
  }

  await db.school.update({ where: { id }, data: { maxStudents, maxStaff } });

  revalidatePath(`/super-admin/schools/${id}`);
  return { success: true };
}

export async function setSchoolLoginBlock(schoolId: string, blocked: boolean): Promise<ManageFormState> {
  const session = await auth();
  if (session?.user.role !== "SUPER_ADMIN") return { error: "Only a Super Admin can manage schools." };

  await db.school.update({ where: { id: schoolId }, data: { loginBlocked: blocked } });

  revalidatePath(`/super-admin/schools/${schoolId}`);
  return { success: true };
}

export async function updateSchoolAdminAccount(_prevState: ManageFormState, formData: FormData): Promise<ManageFormState> {
  const session = await auth();
  if (session?.user.role !== "SUPER_ADMIN") return { error: "Only a Super Admin can manage schools." };

  const userId = formData.get("userId");
  const schoolId = formData.get("schoolId");
  const name = formData.get("name");
  const username = formData.get("username");
  if (typeof userId !== "string" || !userId || typeof schoolId !== "string" || !schoolId) return { error: "Missing account." };
  if (typeof name !== "string" || !name.trim()) return { error: "Admin name is required." };
  if (typeof username !== "string" || !username.trim()) return { error: "Username is required." };

  const normalizedUsername = username.trim().toLowerCase();
  const existing = await db.user.findUnique({ where: { username: normalizedUsername } });
  if (existing && existing.id !== userId) return { error: "A user with this username already exists." };

  await db.user.update({ where: { id: userId }, data: { name: name.trim(), username: normalizedUsername } });

  revalidatePath(`/super-admin/schools/${schoolId}`);
  return { success: true };
}

export async function updateSchoolAddress(_prevState: ManageFormState, formData: FormData): Promise<ManageFormState> {
  const session = await auth();
  if (session?.user.role !== "SUPER_ADMIN") return { error: "Only a Super Admin can manage schools." };

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing school." };

  const registrationNumber = formData.get("registrationNumber");
  const address = readAddress(formData);

  try {
    await db.school.update({
      where: { id },
      data: {
        registrationNumber: typeof registrationNumber === "string" && registrationNumber.trim() ? registrationNumber.trim() : null,
        addressLine: address.addressLine,
        mandal: address.mandal,
        district: address.district,
        state: address.state,
        country: address.country,
        postalCode: address.postalCode,
      },
    });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { error: "That registration number is already in use by another school." };
    }
    throw e;
  }

  revalidatePath("/super-admin/schools");
  revalidatePath(`/super-admin/schools/${id}`);
  return { success: true };
}

export async function upsertSchoolContact(_prevState: ManageFormState, formData: FormData): Promise<ManageFormState> {
  const session = await auth();
  if (session?.user.role !== "SUPER_ADMIN") return { error: "Only a Super Admin can manage schools." };

  const schoolId = formData.get("schoolId");
  const name = formData.get("contactName");
  const phone = formData.get("contactPhone");
  if (typeof schoolId !== "string" || !schoolId) return { error: "Missing school." };
  if (typeof name !== "string" || !name.trim() || typeof phone !== "string" || !phone.trim()) {
    return { error: "Contact name and phone are required." };
  }

  const aadhar = validateAadhar(formData);
  if (aadhar === "INVALID") return { error: "Aadhar number must be exactly 12 digits." };

  const sameAsSchoolAddress = formData.get("sameAsSchoolAddress") === "on";
  let contactAddress = readContactAddress(formData);
  if (sameAsSchoolAddress) {
    const school = await db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { addressLine: true, mandal: true, district: true, state: true, country: true, postalCode: true } });
    contactAddress = school;
  }

  const alternatePhone = formData.get("contactAlternatePhone");
  const email = formData.get("contactEmail");

  await db.schoolContact.upsert({
    where: { schoolId },
    update: {
      name: name.trim(),
      phone: phone.trim(),
      alternatePhone: typeof alternatePhone === "string" && alternatePhone.trim() ? alternatePhone.trim() : null,
      email: typeof email === "string" && email.trim() ? email.trim() : null,
      ...contactAddress,
      aadharNumber: aadhar,
    },
    create: {
      schoolId,
      name: name.trim(),
      phone: phone.trim(),
      alternatePhone: typeof alternatePhone === "string" && alternatePhone.trim() ? alternatePhone.trim() : null,
      email: typeof email === "string" && email.trim() ? email.trim() : null,
      ...contactAddress,
      aadharNumber: aadhar,
    },
  });

  revalidatePath("/super-admin/schools");
  revalidatePath(`/super-admin/schools/${schoolId}`);
  return { success: true };
}

export async function updateRelationshipManager(_prevState: ManageFormState, formData: FormData): Promise<ManageFormState> {
  const session = await auth();
  if (session?.user.role !== "SUPER_ADMIN") return { error: "Only a Super Admin can manage schools." };

  const id = formData.get("id");
  const relationshipManager = formData.get("relationshipManager");
  if (typeof id !== "string" || !id) return { error: "Missing school." };

  await db.school.update({
    where: { id },
    data: { relationshipManager: typeof relationshipManager === "string" && relationshipManager.trim() ? relationshipManager.trim() : null },
  });

  revalidatePath("/super-admin/schools");
  revalidatePath(`/super-admin/schools/${id}`);
  return { success: true };
}

export async function addSchoolNote(_prevState: ManageFormState, formData: FormData): Promise<ManageFormState> {
  const session = await auth();
  if (session?.user.role !== "SUPER_ADMIN") return { error: "Only a Super Admin can add notes." };

  const id = formData.get("id");
  const body = formData.get("body");
  if (typeof id !== "string" || !id) return { error: "Missing school." };
  if (typeof body !== "string" || !body.trim()) return { error: "Note can't be empty." };

  await db.schoolNote.create({
    data: { schoolId: id, authorId: session.user.id, body: body.trim() },
  });

  revalidatePath("/super-admin/schools");
  revalidatePath(`/super-admin/schools/${id}`);
  return { success: true };
}

export async function uploadSchoolDocument(_prevState: ManageFormState, formData: FormData): Promise<ManageFormState> {
  await requirePlatformModuleAccess("Schools", "EDIT");
  const session = await auth();

  const schoolId = formData.get("schoolId");
  const category = formData.get("category");
  const name = formData.get("name");
  const file = formData.get("file");

  if (typeof schoolId !== "string" || !schoolId) return { error: "Missing school." };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "File is too large (15MB max)." };

  const school = await db.school.findUnique({ where: { id: schoolId } });
  if (!school) return { error: "School not found." };

  const bytes = Buffer.from(await file.arrayBuffer());
  const { storagePath, fileName } = await saveUploadedFile(`schools/${schoolId}`, file.name, bytes);

  await db.schoolDocument.create({
    data: {
      schoolId,
      name: typeof name === "string" && name.trim() ? name.trim() : file.name,
      category: VALID_DOC_CATEGORIES.includes(category as SchoolDocumentCategory) ? (category as SchoolDocumentCategory) : "OTHER",
      fileName,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      storagePath,
      uploadedById: session?.user.id,
    },
  });

  revalidatePath("/super-admin/schools");
  revalidatePath(`/super-admin/schools/${schoolId}`);
  return { success: true };
}

export async function deleteSchoolDocument(documentId: string): Promise<ManageFormState> {
  await requirePlatformModuleAccess("Schools", "EDIT");

  const doc = await db.schoolDocument.findUnique({ where: { id: documentId } });
  if (!doc) return { error: "Document not found." };

  await db.schoolDocument.delete({ where: { id: documentId } });
  await deleteUploadedFile(doc.storagePath);

  revalidatePath("/super-admin/schools");
  revalidatePath(`/super-admin/schools/${doc.schoolId}`);
  return { success: true };
}
