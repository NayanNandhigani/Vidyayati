import Link from "next/link";

export type SchoolHealth = { schoolId: string; schoolName: string; tier: "green" | "amber" | "red"; reason: string };

const TIER_COLOR: Record<SchoolHealth["tier"], string> = {
  green: "var(--good)",
  amber: "var(--warn)",
  red: "var(--critical)",
};

export default function AccountHealthPanel({ schools }: { schools: SchoolHealth[] }) {
  if (schools.length === 0) {
    return <div style={{ fontSize: 12.5, color: "var(--muted)" }}>No active schools yet.</div>;
  }

  const counts = { green: 0, amber: 0, red: 0 };
  schools.forEach((s) => counts[s.tier]++);
  const needsAttention = schools.filter((s) => s.tier !== "green").sort((a, b) => (a.tier === "red" ? -1 : 1));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 18 }}>
        <HealthCount label="Healthy" color={TIER_COLOR.green} value={counts.green} />
        <HealthCount label="Needs attention" color={TIER_COLOR.amber} value={counts.amber} />
        <HealthCount label="At risk" color={TIER_COLOR.red} value={counts.red} />
      </div>

      {needsAttention.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--good)", fontWeight: 600 }}>✓ Every school is healthy.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 150, overflowY: "auto" }}>
          {needsAttention.map((s) => (
            <div key={s.schoolId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: TIER_COLOR[s.tier], flex: "none" }} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>{s.schoolName}</span>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>— {s.reason}</span>
              </div>
              <Link href={`/super-admin/schools/${s.schoolId}`} style={{ fontSize: 11.5, fontWeight: 700, color: "var(--marigold-deep)", textDecoration: "none", flex: "none" }}>
                View →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HealthCount({ label, color, value }: { label: string; color: string; value: number }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: 20, fontWeight: 600, color }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: "var(--muted)" }}>{label}</div>
    </div>
  );
}
