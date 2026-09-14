// Pure helpers shared between server actions and client components for the
// Library depth features (Batch 13). Lives outside any "use server" file —
// every export in a "use server" file must itself be async, and these are
// plain sync computations (see the Homework-batch lesson: effectiveStatus()).

/** Days between the due date and the (actual or as-of-now) return date, floored at 0. */
export function overdueDaysAt(dueDate: Date | string, asOf: Date | string): number {
  const ms = new Date(asOf).getTime() - new Date(dueDate).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

/** The fine that would be charged for a return, given the school's rate/grace configuration. */
export function computeLibraryFine(dueDate: Date | string, asOf: Date | string, ratePerDay: number | null | undefined, graceDays: number | null | undefined): number {
  if (!ratePerDay || ratePerDay <= 0) return 0;
  const overdue = overdueDaysAt(dueDate, asOf);
  const chargeableDays = Math.max(0, overdue - (graceDays ?? 0));
  return chargeableDays * ratePerDay;
}
