// Plain utility, not a server action — kept out of app/app/homework/depth-actions.ts
// because a "use server" file requires every export to be an async function.

/** Purely a display computation — never writes to the stored status. */
export function effectiveStatus(
  status: "PENDING" | "SUBMITTED" | "LATE",
  dueDate: Date,
  graceDays: number | null
): "PENDING" | "SUBMITTED" | "LATE" {
  if (status !== "PENDING" || graceDays == null) return status;
  const graceDeadline = new Date(dueDate);
  graceDeadline.setDate(graceDeadline.getDate() + graceDays);
  return new Date() > graceDeadline ? "LATE" : "PENDING";
}
