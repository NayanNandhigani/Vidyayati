export function formatINR(amount: number): string {
  if (Math.abs(amount) >= 1e7) return `₹${(amount / 1e7).toFixed(2)}Cr`;
  if (Math.abs(amount) >= 1e5) return `₹${(amount / 1e5).toFixed(1)}L`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function daysUntil(date: Date): number {
  const ms = date.getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function studentName(s: { firstName: string; surname: string }): string {
  return `${s.firstName} ${s.surname}`;
}
