"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { LeadSource, LeadStage, SalesActivityType } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePlatformModuleAccess } from "@/lib/permissions";
import { generateSchoolCode } from "@/app/super-admin/schools/actions";
import { readAddress, readContactAddress } from "@/lib/address";
import { createPendingAccount } from "@/lib/account-setup";

const AADHAR_PATTERN = /^\d{12}$/;
function validateAadhar(formData: FormData): string | null | "INVALID" {
  const raw = formData.get("contactAadharNumber");
  if (typeof raw !== "string" || !raw.trim()) return null;
  const digitsOnly = raw.replace(/\s|-/g, "");
  return AADHAR_PATTERN.test(digitsOnly) ? digitsOnly : "INVALID";
}

export type LeadFormState = { error?: string };
export type FormState = { error?: string; success?: boolean };

const VALID_SOURCES: LeadSource[] = ["REFERRAL", "WEBSITE", "COLD_OUTREACH", "EVENT", "OTHER"];
// Forward path a lead moves through via "Move ->" — LOST is a separate
// terminal action (markLeadLost), not part of this sequence.
const STAGE_ORDER: LeadStage[] = ["NEW", "CONTACTED", "DEMO_SCHEDULED", "DEMO_DONE", "PROPOSAL_SENT", "NEGOTIATION", "WON"];
const VALID_ACTIVITY_TYPES: SalesActivityType[] = ["CALL", "MEETING", "EMAIL", "TASK"];

export async function createLead(_prevState: LeadFormState, formData: FormData): Promise<LeadFormState> {
  await requirePlatformModuleAccess("Leads", "EDIT");

  const schoolNameProposed = formData.get("schoolNameProposed");
  const contactName = formData.get("contactName");
  const contactPhone = formData.get("contactPhone");
  const contactEmail = formData.get("contactEmail");
  const source = formData.get("source");
  const estimatedValueRaw = formData.get("estimatedValue");
  const expectedCloseDateRaw = formData.get("expectedCloseDate");
  const relationshipManager = formData.get("relationshipManager");

  if (typeof schoolNameProposed !== "string" || !schoolNameProposed.trim()) return { error: "School name is required." };
  if (typeof contactName !== "string" || !contactName.trim()) return { error: "Contact name is required." };
  if (typeof contactPhone !== "string" || !contactPhone.trim()) return { error: "Contact phone is required." };
  if (typeof source !== "string" || !VALID_SOURCES.includes(source as LeadSource)) return { error: "Choose a lead source." };

  const address = readAddress(formData);

  const lead = await db.salesLead.create({
    data: {
      schoolNameProposed: schoolNameProposed.trim(),
      contactName: contactName.trim(),
      contactPhone: contactPhone.trim(),
      contactEmail: typeof contactEmail === "string" && contactEmail.trim() ? contactEmail.trim() : null,
      addressLine: address.addressLine,
      mandal: address.mandal,
      district: address.district,
      state: address.state,
      country: address.country,
      postalCode: address.postalCode,
      source: source as LeadSource,
      estimatedValue: typeof estimatedValueRaw === "string" && estimatedValueRaw ? Number(estimatedValueRaw) : null,
      expectedCloseDate: typeof expectedCloseDateRaw === "string" && expectedCloseDateRaw ? new Date(expectedCloseDateRaw) : null,
      relationshipManager: typeof relationshipManager === "string" && relationshipManager.trim() ? relationshipManager.trim() : null,
    },
  });

  revalidatePath("/super-admin/leads");
  redirect(`/super-admin/leads/${lead.id}`);
}

export async function advanceStage(leadId: string) {
  await requirePlatformModuleAccess("Leads", "EDIT");
  const lead = await db.salesLead.findUniqueOrThrow({ where: { id: leadId } });
  const idx = STAGE_ORDER.indexOf(lead.stage);
  if (idx === -1 || idx === STAGE_ORDER.length - 1) return; // already WON, or LOST (not in the forward sequence)

  await db.salesLead.update({ where: { id: leadId }, data: { stage: STAGE_ORDER[idx + 1] } });
  revalidatePath("/super-admin/leads");
  revalidatePath(`/super-admin/leads/${leadId}`);
}

export async function markLeadLost(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requirePlatformModuleAccess("Leads", "EDIT");
  const leadId = formData.get("leadId");
  const reason = formData.get("reason");
  if (typeof leadId !== "string" || !leadId) return { error: "Missing lead." };

  await db.salesLead.update({ where: { id: leadId }, data: { stage: "LOST", lostReason: typeof reason === "string" && reason.trim() ? reason.trim() : null } });
  revalidatePath("/super-admin/leads");
  revalidatePath(`/super-admin/leads/${leadId}`);
  return { success: true };
}

export async function addActivity(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requirePlatformModuleAccess("Leads", "EDIT");

  const leadId = formData.get("leadId");
  const type = formData.get("type");
  const notes = formData.get("notes");
  const dueAt = formData.get("dueAt");

  if (typeof leadId !== "string" || !leadId) return { error: "Missing lead." };
  if (typeof type !== "string" || !VALID_ACTIVITY_TYPES.includes(type as SalesActivityType)) return { error: "Choose an activity type." };
  if (typeof notes !== "string" || !notes.trim()) return { error: "Enter a note." };

  await db.salesActivity.create({
    data: {
      leadId,
      type: type as SalesActivityType,
      notes: notes.trim(),
      dueAt: typeof dueAt === "string" && dueAt ? new Date(dueAt) : null,
    },
  });

  revalidatePath(`/super-admin/leads/${leadId}`);
  return { success: true };
}

export async function completeActivity(activityId: string, leadId: string) {
  await requirePlatformModuleAccess("Leads", "EDIT");
  await db.salesActivity.update({ where: { id: activityId }, data: { completedAt: new Date() } });
  revalidatePath(`/super-admin/leads/${leadId}`);
}

export async function convertToSchool(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requirePlatformModuleAccess("Leads", "EDIT");

  const leadId = formData.get("leadId");
  const adminName = formData.get("adminName");
  const adminUsername = formData.get("adminUsername");
  const planId = formData.get("planId");
  const registrationNumber = formData.get("registrationNumber");

  if (typeof leadId !== "string" || !leadId) return { error: "Missing lead." };
  if (typeof adminName !== "string" || !adminName.trim() || typeof adminUsername !== "string" || !adminUsername.trim()) {
    return { error: "Admin name and username are required." };
  }

  const lead = await db.salesLead.findUniqueOrThrow({ where: { id: leadId } });
  if (lead.stage !== "WON") return { error: "Only a Won lead can be converted." };
  if (lead.convertedSchoolId) return { error: "This lead has already been converted." };

  const username = adminUsername.trim().toLowerCase();
  const existingUser = await db.user.findUnique({ where: { username } });
  if (existingUser) return { error: "A user with this username already exists." };

  const aadhar = validateAadhar(formData);
  if (aadhar === "INVALID") return { error: "Aadhar number must be exactly 12 digits." };

  // The lead's own address becomes the school's registered address —
  // nothing to re-enter. Contact defaults to "same as school" too, but the
  // form can override it (a different personal address for the contact).
  const sameAsSchoolAddress = formData.get("sameAsSchoolAddress") === "on";
  const contactAddress = sameAsSchoolAddress ? lead : readContactAddress(formData);

  const { token, setupTokenHash, setupTokenExpiresAt, placeholderHash } = await createPendingAccount();
  const code = await generateSchoolCode(lead.schoolNameProposed);

  let school;
  try {
    school = await db.school.create({
      data: {
        code,
        name: lead.schoolNameProposed,
        relationshipManager: lead.relationshipManager,
        status: "TRIAL",
        registrationNumber: typeof registrationNumber === "string" && registrationNumber.trim() ? registrationNumber.trim() : null,
        addressLine: lead.addressLine,
        mandal: lead.mandal,
        district: lead.district,
        state: lead.state,
        country: lead.country,
        postalCode: lead.postalCode,
        users: { create: { name: adminName.trim(), username, passwordHash: placeholderHash, setupTokenHash, setupTokenExpiresAt, role: "SCHOOL_ADMIN" } },
        contactPerson: {
          create: {
            name: lead.contactName,
            phone: lead.contactPhone,
            alternatePhone: typeof formData.get("contactAlternatePhone") === "string" && (formData.get("contactAlternatePhone") as string).trim() ? (formData.get("contactAlternatePhone") as string).trim() : null,
            email: lead.contactEmail,
            addressLine: contactAddress.addressLine,
            mandal: contactAddress.mandal,
            district: contactAddress.district,
            state: contactAddress.state,
            country: contactAddress.country,
            postalCode: contactAddress.postalCode,
            aadharNumber: aadhar,
          },
        },
      },
    });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { error: "That registration number is already in use by another school." };
    }
    throw e;
  }

  await db.salesLead.update({ where: { id: leadId }, data: { convertedSchoolId: school.id } });

  if (typeof planId === "string" && planId) {
    const plan = await db.subscriptionPlan.findUnique({ where: { id: planId } });
    if (plan) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      const fyStart = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1;
      await db.subscriptionInvoice.create({
        data: {
          schoolId: school.id,
          planId: plan.id,
          amount: plan.price,
          billingPeriod: `${fyStart}-${String(fyStart + 1).slice(2)}`,
          dueDate,
          status: "PENDING",
        },
      });
    }
  }

  revalidatePath("/super-admin/leads");
  revalidatePath("/super-admin/schools");
  redirect(`/super-admin/schools/${school.id}?setupToken=${token}`);
}
