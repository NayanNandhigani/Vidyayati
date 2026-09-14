export function gradeFor(pct: number): string {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B+";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C";
  return "D";
}

export function gradeColor(grade: string): string {
  if (grade === "A+" || grade === "A") return "var(--good)";
  if (grade === "B+" || grade === "B") return "var(--warn)";
  return "var(--critical)";
}

export type GradeBand = { label: string; minPercent: number; maxPercent: number };

/**
 * Maps a percentage to a school's configured GradeScale, if it has one —
 * pure function, no storage (grade is never denormalized onto Mark). Returns
 * null when no band's range contains pct, so callers fall back to gradeFor()
 * for schools that haven't configured a scale, e.g. `gradeForScale(pct,
 * bands) ?? gradeFor(pct)`.
 */
export function gradeForScale(pct: number, bands: GradeBand[]): string | null {
  const band = bands.find((b) => pct >= b.minPercent && pct <= b.maxPercent);
  return band?.label ?? null;
}

export type FeeStatus = "PAID" | "PENDING" | "OVERDUE" | "NONE";

export function feeStatusFor(totalDue: number, totalPaid: number, hasOverdueUnpaid: boolean): FeeStatus {
  if (totalDue === 0) return "NONE";
  if (totalPaid >= totalDue) return "PAID";
  return hasOverdueUnpaid ? "OVERDUE" : "PENDING";
}

export const FEE_STATUS_STYLE: Record<FeeStatus, { bg: string; fg: string; label: string }> = {
  PAID: { bg: "var(--good-tint)", fg: "var(--good)", label: "Paid" },
  PENDING: { bg: "var(--warn-tint)", fg: "var(--warn)", label: "Pending" },
  OVERDUE: { bg: "var(--critical-tint)", fg: "var(--critical)", label: "Overdue" },
  NONE: { bg: "var(--line)", fg: "var(--muted)", label: "No dues set" },
};

const AVATAR_COLORS = ["var(--marigold)", "var(--teal)", "var(--clay)", "#8A6FD1", "#D16F8A", "#4C8FBF", "#3F9B7A", "#C2884A"];

export function avatarColorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

const SUBJECT_PALETTE = [
  { bg: "var(--marigold-tint)", fg: "var(--marigold-deep)" },
  { bg: "var(--teal-tint)", fg: "var(--teal)" },
  { bg: "var(--clay-tint)", fg: "var(--clay)" },
  { bg: "var(--good-tint)", fg: "var(--good)" },
  { bg: "var(--info-tint)", fg: "var(--info)" },
  { bg: "var(--warn-tint)", fg: "var(--warn)" },
];

export function subjectStyleFor(name: string): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return SUBJECT_PALETTE[hash % SUBJECT_PALETTE.length];
}
