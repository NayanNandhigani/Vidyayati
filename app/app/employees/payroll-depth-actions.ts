"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { requireFeature } from "@/lib/feature-flags";
import type { Prisma } from "@prisma/client";

async function schoolId() {
  const session = await auth();
  return session!.user.schoolId!;
}

export async function addSalaryComponent(staffId: string, name: string, amount: number) {
  const sid = await schoolId();
  await requireModuleAccess("Employees", "EDIT");
  await requireFeature(sid, "payroll.structuredSalary");
  const sdb = await getScopedDb();
  await sdb.salaryComponent.create({ data: scopedCreateData<Prisma.SalaryComponentUncheckedCreateInput>({ staffId, name: name.trim(), amount }) });
  revalidatePath(`/app/employees/${staffId}`);
}

export async function removeSalaryComponent(id: string) {
  await requireModuleAccess("Employees", "EDIT");
  const sdb = await getScopedDb();
  const component = await sdb.salaryComponent.delete({ where: { id } });
  revalidatePath(`/app/employees/${component.staffId}`);
}

export async function updateStatutoryRates(pfPercent: number | null, esiPercent: number | null, ptFixedAmount: number | null, tdsPercent: number | null) {
  const sid = await schoolId();
  await requireModuleAccess("Employees", "EDIT");
  const sdb = await getScopedDb();
  await sdb.school.update({ where: { id: sid }, data: { pfPercent, esiPercent, ptFixedAmount, tdsPercent } });
  revalidatePath("/app/employees");
}

/**
 * The structured sibling of employees/actions.ts's runPayroll — computes
 * gross from SalaryComponents and applies the school's statutory rates.
 * Kept as a separate action rather than modifying runPayroll, so a school
 * without this feature keeps that flow's exact current behavior (a plain
 * admin-entered amount, no breakdown).
 */
export async function runStructuredPayroll(staffId: string, month: string) {
  const sid = await schoolId();
  await requireModuleAccess("Employees", "EDIT");
  await requireFeature(sid, "payroll.structuredSalary");
  const sdb = await getScopedDb();

  const [components, staff, school] = await Promise.all([
    sdb.salaryComponent.findMany({ where: { staffId } }),
    sdb.staffProfile.findUniqueOrThrow({ where: { id: staffId }, include: { user: true } }),
    sdb.school.findUniqueOrThrow({ where: { id: sid } }),
  ]);

  const gross = components.reduce((s, c) => s + Number(c.amount), 0);
  const pf = school.pfPercent ? (gross * Number(school.pfPercent)) / 100 : 0;
  const esi = school.esiPercent ? (gross * Number(school.esiPercent)) / 100 : 0;
  const tds = school.tdsPercent ? (gross * Number(school.tdsPercent)) / 100 : 0;
  const pt = school.ptFixedAmount ? Number(school.ptFixedAmount) : 0;

  // LOP only applies once Batch 11's staff-leave feature is on — a school
  // without it simply gets lop = 0, identical to before that feature existed.
  const leaveEnabled = await requireFeature(sid, "employees.leave").then(() => true).catch(() => false);
  const lopDays = leaveEnabled ? await (await import("./hr-depth-actions")).getLopDaysForMonth(staffId, month) : 0;
  const lop = lopDays > 0 ? (gross / 30) * lopDays : 0;

  const net = Math.max(0, gross - pf - esi - tds - pt - lop);

  await sdb.$transaction([
    sdb.payrollRun.upsert({
      where: { staffId_month: { staffId, month } },
      update: { amount: net, status: "PAID", paidOn: new Date(), grossAmount: gross, pfAmount: pf, esiAmount: esi, tdsAmount: tds, ptAmount: pt, lopAmount: lop || null },
      create: scopedCreateData<Prisma.PayrollRunUncheckedCreateInput>({
        staffId,
        month,
        amount: net,
        status: "PAID",
        paidOn: new Date(),
        grossAmount: gross,
        pfAmount: pf,
        esiAmount: esi,
        tdsAmount: tds,
        ptAmount: pt,
        lopAmount: lop || null,
      }),
    }),
    sdb.accountsTransaction.create({
      data: scopedCreateData<Prisma.AccountsTransactionUncheckedCreateInput>({
        date: new Date(),
        description: `Staff salary — ${staff.user.name} (${month})`,
        category: "Payroll",
        source: "AUTO_PAYROLL",
        type: "EXPENSE",
        amount: net,
      }),
    }),
  ]);

  revalidatePath(`/app/employees/${staffId}`);
  revalidatePath("/app/accounts");
  revalidatePath("/app/dashboard");
  return { gross, pf, esi, tds, pt, lop, net };
}
