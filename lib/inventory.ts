// Pure helpers for the Inventory & Assets module (Batch 14). Lives outside
// any "use server" file since these are plain sync computations, needed by
// both server actions/pages and client components — see the Homework-batch
// lesson: every export in a "use server" file must itself be async.

/**
 * Straight-line depreciation, computed at read time from purchase cost,
 * useful life, and elapsed time — never stored, so it's always correct
 * as of "now" with nothing to keep in sync. Fully depreciates (floors at
 * a nominal ₹1 residual, not ₹0, since a fully-written-off asset still
 * physically exists) once its useful life has elapsed.
 */
export function currentAssetValue(purchaseCost: number, usefulLifeYears: number, purchaseDate: Date | string): number {
  if (usefulLifeYears <= 0) return purchaseCost;
  const yearsElapsed = (Date.now() - new Date(purchaseDate).getTime()) / (365.25 * 86400000);
  const annualDepreciation = purchaseCost / usefulLifeYears;
  const value = purchaseCost - annualDepreciation * yearsElapsed;
  return Math.max(1, Math.round(value));
}
