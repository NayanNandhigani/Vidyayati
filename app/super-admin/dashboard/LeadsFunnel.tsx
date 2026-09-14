const STAGES: { key: string; label: string }[] = [
  { key: "NEW", label: "New" },
  { key: "CONTACTED", label: "Contacted" },
  { key: "DEMO_SCHEDULED", label: "Demo scheduled" },
  { key: "DEMO_DONE", label: "Demo done" },
  { key: "PROPOSAL_SENT", label: "Proposal sent" },
  { key: "NEGOTIATION", label: "Negotiation" },
  { key: "WON", label: "Won" },
];

// Distinct from SalesPipelineFunnel (which reads School.salesStage, a
// lighter-weight stage tracked directly on School) — this reads the
// separate SalesLead pipeline's LeadStage. LOST isn't part of the forward
// funnel visual; it's called out as a count alongside it instead.
export default function LeadsFunnel({ counts, lostCount }: { counts: Record<string, number>; lostCount: number }) {
  const max = Math.max(1, ...STAGES.map((s) => counts[s.key] ?? 0));
  const total = STAGES.reduce((sum, s) => sum + (counts[s.key] ?? 0), 0);

  if (total === 0 && lostCount === 0) {
    return <div style={{ fontSize: 12.5, color: "var(--muted)" }}>No leads yet.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {STAGES.map((s) => {
        const count = counts[s.key] ?? 0;
        const widthPct = Math.max((count / max) * 100, count > 0 ? 6 : 0);
        return (
          <div key={s.key} style={{ display: "grid", gridTemplateColumns: "120px 1fr 30px", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{s.label}</div>
            <div style={{ height: 18, background: "var(--paper)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${widthPct}%`, height: "100%", background: s.key === "WON" ? "var(--good)" : "var(--teal)", borderRadius: 4 }} />
            </div>
            <div className="mono" style={{ fontSize: 12.5, fontWeight: 600, textAlign: "right" }}>
              {count}
            </div>
          </div>
        );
      })}
      {lostCount > 0 && (
        <div style={{ fontSize: 11.5, color: "var(--critical)", marginTop: 2 }}>
          <span className="mono" style={{ fontWeight: 700 }}>
            {lostCount}
          </span>{" "}
          lost
        </div>
      )}
    </div>
  );
}
