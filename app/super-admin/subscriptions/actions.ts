"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export type PaymentFormState = { error?: string; success?: boolean };

export async function recordSubscriptionPayment(_prevState: PaymentFormState, formData: FormData): Promise<PaymentFormState> {
  const invoiceId = formData.get("invoiceId");
  const amountRaw = formData.get("amount");
  const method = formData.get("method");
  const paidOnRaw = formData.get("paidOn");
  const referenceNo = formData.get("referenceNo");

  if (typeof invoiceId !== "string" || !invoiceId || typeof amountRaw !== "string" || !amountRaw || typeof method !== "string" || !method) {
    return { error: "Amount and method are required." };
  }
  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter a valid amount." };

  const invoice = await db.subscriptionInvoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { payments: true, school: true } });
  const paidOn = typeof paidOnRaw === "string" && paidOnRaw ? new Date(paidOnRaw) : new Date();
  const normalizedReferenceNo = typeof referenceNo === "string" && referenceNo ? referenceNo : null;

  const alreadyPaid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0);
  const remaining = Number(invoice.amount) - alreadyPaid;
  if (amount > remaining) {
    return { error: `This payment exceeds the outstanding balance on this invoice (₹${remaining.toFixed(2)} remaining).` };
  }
  const newStatus = alreadyPaid + amount >= Number(invoice.amount) ? "PAID" : "PENDING";

  // The payment row's id feeds the ledger entry below, so this needs the
  // interactive transaction form rather than the array form — otherwise a
  // failure after the payment insert would leave an orphaned
  // SubscriptionPayment with no invoice-status update and no ledger entry.
  await db.$transaction(async (tx) => {
    const payment = await tx.subscriptionPayment.create({
      data: { invoiceId, amount, method, referenceNo: normalizedReferenceNo, paidOn },
    });
    await tx.subscriptionInvoice.update({ where: { id: invoiceId }, data: { status: newStatus } });
    if (newStatus === "PAID") {
      await tx.school.update({ where: { id: invoice.schoolId }, data: { status: "ACTIVE" as const } });
    }
    // Mirrors into the platform ledger so subscription income shows up in
    // Accounts without the Super Admin having to enter it twice — same
    // pattern as AccountsTransaction.source: AUTO_FEES at the school level.
    await tx.ledgerEntry.create({
      data: {
        entryType: "INCOME",
        ledgerAccountId: "la-subscription-revenue",
        amount,
        date: paidOn,
        description: `Subscription payment — ${invoice.school.name} (${invoice.billingPeriod})`,
        method,
        referenceNo: normalizedReferenceNo,
        source: "AUTO_SUBSCRIPTION",
        subscriptionPaymentId: payment.id,
      },
    });
  });

  revalidatePath("/super-admin/subscriptions");
  revalidatePath("/super-admin/schools");
  revalidatePath("/super-admin/dashboard");
  revalidatePath("/super-admin/accounts");
  return { success: true };
}

export type InvoiceFormState = { error?: string };

export async function createInvoice(_prevState: InvoiceFormState, formData: FormData): Promise<InvoiceFormState> {
  const schoolId = formData.get("schoolId");
  const planId = formData.get("planId");
  const amountRaw = formData.get("amount");
  const billingPeriod = formData.get("billingPeriod");
  const dueDate = formData.get("dueDate");

  if (typeof schoolId !== "string" || !schoolId || typeof amountRaw !== "string" || !amountRaw || typeof billingPeriod !== "string" || !billingPeriod.trim() || typeof dueDate !== "string" || !dueDate) {
    return { error: "All fields are required." };
  }

  await db.subscriptionInvoice.create({
    data: {
      schoolId,
      planId: typeof planId === "string" && planId ? planId : null,
      amount: Number(amountRaw),
      billingPeriod: billingPeriod.trim(),
      dueDate: new Date(dueDate),
      status: "PENDING",
    },
  });

  revalidatePath("/super-admin/subscriptions");
  revalidatePath("/super-admin/plans");
  return {};
}
