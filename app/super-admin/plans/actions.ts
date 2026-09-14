"use server";

import { revalidatePath } from "next/cache";
import type { BillingCycle } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePlatformModuleAccess } from "@/lib/permissions";

export type PlansFormState = { error?: string; success?: boolean };

const VALID_CYCLES: BillingCycle[] = ["MONTHLY", "ANNUAL"];

export async function createPlan(_prevState: PlansFormState, formData: FormData): Promise<PlansFormState> {
  await requirePlatformModuleAccess("Plans", "EDIT");

  const name = formData.get("name");
  const billingCycle = formData.get("billingCycle");
  const priceRaw = formData.get("price");
  const currency = formData.get("currency");

  if (typeof name !== "string" || !name.trim()) return { error: "Plan name is required." };
  if (typeof billingCycle !== "string" || !VALID_CYCLES.includes(billingCycle as BillingCycle)) return { error: "Choose a billing cycle." };
  if (typeof priceRaw !== "string" || !priceRaw) return { error: "Enter a price." };
  const price = Number(priceRaw);
  if (!Number.isFinite(price) || price <= 0) return { error: "Enter a valid price." };

  const existing = await db.subscriptionPlan.findUnique({ where: { name: name.trim() } });
  if (existing) return { error: "A plan with this name already exists." };

  await db.subscriptionPlan.create({
    data: {
      name: name.trim(),
      billingCycle: billingCycle as BillingCycle,
      price,
      currency: typeof currency === "string" && currency.trim() ? currency.trim().toUpperCase() : "INR",
    },
  });

  revalidatePath("/super-admin/plans");
  revalidatePath("/super-admin/subscriptions");
  return { success: true };
}

export async function togglePlanActive(planId: string) {
  await requirePlatformModuleAccess("Plans", "EDIT");

  const plan = await db.subscriptionPlan.findUniqueOrThrow({ where: { id: planId } });
  await db.subscriptionPlan.update({ where: { id: planId }, data: { isActive: !plan.isActive } });

  revalidatePath("/super-admin/plans");
  revalidatePath("/super-admin/subscriptions");
}
