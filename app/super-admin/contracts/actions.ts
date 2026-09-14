"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Recurrence, ContractStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { requirePlatformModuleAccess } from "@/lib/permissions";
import { buildContractTemplate, generateContractNumber } from "@/lib/contracts";

export type ContractFormState = { error?: string };
export type FormState = { error?: string; success?: boolean };

const VALID_CYCLES: Recurrence[] = ["MONTHLY", "QUARTERLY", "YEARLY"];

export async function createContract(_prevState: ContractFormState, formData: FormData): Promise<ContractFormState> {
  await requirePlatformModuleAccess("Contracts", "EDIT");
  const session = await auth();

  const schoolId = formData.get("schoolId");
  const billingCycle = formData.get("billingCycle");
  const annualFee = formData.get("annualFee");
  const startDate = formData.get("startDate");
  const endDate = formData.get("endDate");
  const termsBody = formData.get("termsBody");

  if (typeof schoolId !== "string" || !schoolId) return { error: "Select a school." };
  if (!VALID_CYCLES.includes(billingCycle as Recurrence)) return { error: "Select a billing cycle." };
  if (typeof annualFee !== "string" || !annualFee || Number(annualFee) <= 0) return { error: "Enter a valid fee." };
  if (typeof startDate !== "string" || !startDate || typeof endDate !== "string" || !endDate) return { error: "Enter both a start and end date." };
  if (new Date(endDate) <= new Date(startDate)) return { error: "End date must be after the start date." };

  const school = await db.school.findUnique({ where: { id: schoolId } });
  if (!school) return { error: "School not found." };

  const contractNumber = await generateContractNumber();
  const body =
    typeof termsBody === "string" && termsBody.trim()
      ? termsBody
      : buildContractTemplate({ schoolName: school.name, billingCycle: billingCycle as string, annualFee: Number(annualFee), startDate: new Date(startDate), endDate: new Date(endDate) });

  const contract = await db.contract.create({
    data: {
      schoolId,
      contractNumber,
      billingCycle: billingCycle as Recurrence,
      annualFee: Number(annualFee),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      termsBody: body,
      status: "DRAFT",
      createdByUserId: session?.user.id,
    },
  });

  revalidatePath("/super-admin/contracts");
  redirect(`/super-admin/contracts?contract=${contract.id}`);
}

export async function markContractSent(contractId: string): Promise<FormState> {
  await requirePlatformModuleAccess("Contracts", "EDIT");
  const contract = await db.contract.findUniqueOrThrow({ where: { id: contractId } });
  if (contract.status !== "DRAFT") return { error: "Only a draft contract can be marked as sent." };

  await db.contract.update({ where: { id: contractId }, data: { status: "SENT" } });
  revalidatePath("/super-admin/contracts");
  return { success: true };
}

export async function markContractSigned(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requirePlatformModuleAccess("Contracts", "EDIT");

  const contractId = formData.get("contractId");
  const signatoryName = formData.get("signatoryName");
  const signatoryTitle = formData.get("signatoryTitle");
  const signedDate = formData.get("signedDate");

  if (typeof contractId !== "string" || !contractId) return { error: "Missing contract." };
  if (typeof signatoryName !== "string" || !signatoryName.trim()) return { error: "Enter who signed the contract." };
  if (typeof signedDate !== "string" || !signedDate) return { error: "Enter the date it was signed." };

  const contract = await db.contract.findUniqueOrThrow({ where: { id: contractId } });
  if (contract.status === "SIGNED" || contract.status === "CANCELLED") return { error: "This contract can't be updated." };

  await db.contract.update({
    where: { id: contractId },
    data: {
      status: "SIGNED",
      signatoryName: signatoryName.trim(),
      signatoryTitle: typeof signatoryTitle === "string" && signatoryTitle.trim() ? signatoryTitle.trim() : null,
      signedDate: new Date(signedDate),
    },
  });

  revalidatePath("/super-admin/contracts");
  return { success: true };
}

export async function cancelContract(contractId: string): Promise<FormState> {
  await requirePlatformModuleAccess("Contracts", "EDIT");
  const contract = await db.contract.findUniqueOrThrow({ where: { id: contractId } });
  if (contract.status === "SIGNED" || contract.status === "CANCELLED") return { error: "This contract can't be cancelled." };

  await db.contract.update({ where: { id: contractId }, data: { status: "CANCELLED" as ContractStatus } });
  revalidatePath("/super-admin/contracts");
  return { success: true };
}
