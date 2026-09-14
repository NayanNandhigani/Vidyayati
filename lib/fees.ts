// Plain calculation helpers — not server actions, just pure functions
// shared between the Fees pages' data-loading code, so they live outside
// any "use server" file (which requires every export to be async).

export type DiscountRow = { valueType: "PERCENT" | "FLAT"; value: number };

/** Total discount amount for a student, given their base fee total — percent discounts computed against that total, capped so a discount never exceeds the total owed. */
export function computeDiscountAmount(total: number, discounts: DiscountRow[]): number {
  const sum = discounts.reduce((s, d) => s + (d.valueType === "PERCENT" ? (total * d.value) / 100 : d.value), 0);
  return Math.min(sum, total);
}

/** Flat per-day fine across every overdue, still-outstanding fee structure. */
export function computeLateFine(
  structures: { amount: number; dueDate: Date; paid: number }[],
  perDay: number | null,
  graceDays: number | null
): number {
  if (!perDay) return 0;
  const now = new Date();
  let fine = 0;
  for (const s of structures) {
    if (s.paid >= s.amount) continue;
    const daysOverdue = Math.floor((now.getTime() - s.dueDate.getTime()) / 86400000);
    const billable = daysOverdue - (graceDays ?? 0);
    if (billable > 0) fine += billable * perDay;
  }
  return fine;
}
