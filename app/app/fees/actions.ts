"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { studentName } from "@/lib/format";

export type PaymentFormState = { error?: string; success?: boolean };

export async function recordPayment(_prevState: PaymentFormState, formData: FormData): Promise<PaymentFormState> {
  await requireModuleAccess("Fees", "EDIT");
  const sdb = await getScopedDb();

  const studentId = formData.get("studentId");
  const amountRaw = formData.get("amount");
  const method = formData.get("method");
  const referenceNo = formData.get("referenceNo");
  const paidOnRaw = formData.get("paidOn");

  if (typeof studentId !== "string" || !studentId || typeof amountRaw !== "string" || !amountRaw || typeof method !== "string" || !method) {
    return { error: "Amount and method are required." };
  }
  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter a valid amount." };
  }
  const paidOn = typeof paidOnRaw === "string" && paidOnRaw ? new Date(paidOnRaw) : new Date();

  const student = await sdb.student.findUniqueOrThrow({ where: { id: studentId }, include: { class: true } });
  const currentYear = await sdb.academicYear.findFirst({ where: { isCurrent: true } });
  if (!currentYear) return { error: "No current academic year is set." };

  const structures = await sdb.feeStructure.findMany({
    where: { classId: student.classId, yearId: currentYear.id },
    include: { payments: { where: { studentId } } },
    orderBy: { dueDate: "asc" },
  });

  const target = structures.find((fs) => fs.payments.reduce((s, p) => s + Number(p.amount), 0) < Number(fs.amount));
  if (!target) {
    return { error: "This student has no outstanding fee installments to apply a payment to." };
  }

  const alreadyPaid = target.payments.reduce((s, p) => s + Number(p.amount), 0);
  const remaining = Number(target.amount) - alreadyPaid;
  if (amount > remaining) {
    return { error: `This payment exceeds the outstanding balance for this installment (₹${remaining.toFixed(2)} remaining).` };
  }
  const status = alreadyPaid + amount >= Number(target.amount) ? "PAID" : "PARTIAL";

  await sdb.$transaction([
    sdb.feePayment.create({
      data: scopedCreateData<Prisma.FeePaymentUncheckedCreateInput>({
        studentId,
        feeStructureId: target.id,
        amount,
        method,
        referenceNo: typeof referenceNo === "string" && referenceNo ? referenceNo : null,
        paidOn,
        status,
      }),
    }),
    sdb.accountsTransaction.create({
      data: scopedCreateData<Prisma.AccountsTransactionUncheckedCreateInput>({
        date: paidOn,
        description: `Fee payment — ${studentName(student)} (${student.class.grade}-${student.class.section})`,
        category: "Fees",
        source: "AUTO_FEES",
        type: "INCOME",
        amount,
      }),
    }),
  ]);

  revalidatePath("/app/fees");
  revalidatePath("/app/accounts");
  revalidatePath("/app/dashboard");
  return { success: true };
}
