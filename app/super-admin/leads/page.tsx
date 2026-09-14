import { db } from "@/lib/db";
import { formatINR } from "@/lib/format";
import { requirePlatformModuleAccess } from "@/lib/permissions";
import NewLeadForm from "./NewLeadForm";
import LeadList, { type LeadRow } from "./LeadList";

export default async function LeadsPage() {
  const access = await requirePlatformModuleAccess("Leads", "VIEW");
  const canEdit = access === "EDIT";

  const leadsRaw = await db.salesLead.findMany({ orderBy: { updatedAt: "desc" } });

  const leads: LeadRow[] = leadsRaw.map((l) => ({
    id: l.id,
    schoolNameProposed: l.schoolNameProposed,
    contactName: l.contactName,
    contactPhone: l.contactPhone,
    stage: l.stage,
    source: l.source,
    estimatedValue: l.estimatedValue ? Number(l.estimatedValue) : null,
    addressLine: l.addressLine,
    mandal: l.mandal,
    district: l.district,
    state: l.state,
    country: l.country,
    postalCode: l.postalCode,
    updatedAt: l.updatedAt.toISOString(),
  }));

  const total = leads.length;
  const won = leads.filter((l) => l.stage === "WON").length;
  const lost = leads.filter((l) => l.stage === "LOST").length;
  const open = total - won - lost;
  const conversion = total ? Math.round((won / total) * 100) : 0;
  const pipelineValue = leads.filter((l) => l.stage !== "WON" && l.stage !== "LOST").reduce((s, l) => s + (l.estimatedValue ?? 0), 0);

  return (
    <div style={{ padding: "28px 36px", display: "flex", flexDirection: "column", gap: 18, height: "100dvh", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div className="disp" style={{ fontSize: 22 }}>
            Leads
          </div>
          <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 2 }}>Prospective schools, nurtured before they ever become an onboarded school</div>
        </div>
        {canEdit && <NewLeadForm />}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14 }}>
        <Stat label="Total leads" value={total} />
        <Stat label="Open" value={open} color="var(--info)" />
        <Stat label="Won" value={won} color="var(--good)" />
        <Stat label="Lost" value={lost} color="var(--critical)" />
        <Stat label="Conversion rate" value={`${conversion}%`} color="var(--marigold-deep)" />
      </div>

      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
        Open pipeline value: <span className="mono" style={{ color: "var(--ink)", fontWeight: 700 }}>{formatINR(pipelineValue)}</span>/yr
      </div>

      <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
        <LeadList leads={leads} />
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 6 }}>{label}</div>
      <div className="mono" style={{ fontSize: 20, fontWeight: 600, color: color ?? "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}
