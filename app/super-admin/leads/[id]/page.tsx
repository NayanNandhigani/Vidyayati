import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/format";
import { requirePlatformModuleAccess } from "@/lib/permissions";
import { formatAddress } from "@/lib/address";
import LeadStageControls from "../LeadStageControls";
import ActivityFeed, { type Activity } from "../ActivityFeed";
import ConvertLeadForm from "../ConvertLeadForm";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requirePlatformModuleAccess("Leads", "VIEW");
  const canEdit = access === "EDIT";

  const { id } = await params;
  const lead = await db.salesLead.findUnique({ where: { id }, include: { activities: { orderBy: { createdAt: "desc" } }, convertedSchool: { select: { id: true, name: true } } } });
  if (!lead) notFound();

  const plans = canEdit && lead.stage === "WON" && !lead.convertedSchoolId ? await db.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }) : [];

  const address = formatAddress(lead);

  const activities: Activity[] = lead.activities.map((a) => ({
    id: a.id,
    type: a.type,
    notes: a.notes,
    dueAt: a.dueAt?.toISOString() ?? null,
    completedAt: a.completedAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <div style={{ padding: "28px 36px", display: "flex", flexDirection: "column", gap: 18, height: "100dvh", boxSizing: "border-box", overflowY: "auto" }}>
      <Link href="/super-admin/leads" style={{ fontSize: 12.5, color: "var(--muted)", textDecoration: "none" }}>
        ← Back to board
      </Link>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 18, alignItems: "start" }}>
        <div className="card" style={{ padding: 24 }}>
          <div className="disp" style={{ fontSize: 19 }}>
            {lead.schoolNameProposed}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4, marginBottom: 16 }}>
            Lead source: {lead.source[0] + lead.source.slice(1).toLowerCase().replace(/_/g, " ")}
          </div>

          <LeadStageControls leadId={lead.id} stage={lead.stage} canEdit={canEdit} />

          {lead.stage === "LOST" && lead.lostReason && (
            <div style={{ marginTop: 12, fontSize: 12.5, color: "var(--critical)" }}>
              <b>Lost reason:</b> {lead.lostReason}
            </div>
          )}

          {lead.convertedSchool && (
            <div style={{ marginTop: 12, background: "var(--good-tint)", borderRadius: 8, padding: "10px 12px", fontSize: 12.5 }}>
              Converted to{" "}
              <Link href={`/super-admin/schools/${lead.convertedSchool.id}`} style={{ color: "var(--good)", fontWeight: 700 }}>
                {lead.convertedSchool.name} →
              </Link>
            </div>
          )}

          <div style={{ marginTop: 20, background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
            <DetailRow label="Contact" value={lead.contactName} />
            <DetailRow label="Phone" value={lead.contactPhone} mono />
            {lead.contactEmail && <DetailRow label="Email" value={lead.contactEmail} mono />}
            {lead.estimatedValue != null && <DetailRow label="Estimated value" value={`${formatINR(Number(lead.estimatedValue))}/yr`} mono />}
            {lead.expectedCloseDate && <DetailRow label="Expected close" value={lead.expectedCloseDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} mono />}
            {lead.relationshipManager && <DetailRow label="Relationship manager" value={lead.relationshipManager} />}
            <DetailRow label="Address" value={address ?? "—"} last />
          </div>

          {lead.stage === "WON" && !lead.convertedSchoolId && canEdit && (
            <div style={{ marginTop: 20 }}>
              <ConvertLeadForm leadId={lead.id} plans={plans.map((p) => ({ id: p.id, name: p.name, price: Number(p.price) }))} />
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Activity</div>
          <ActivityFeed leadId={lead.id} activities={activities} canEdit={canEdit} />
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono, last }: { label: string; value: string; mono?: boolean; last?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, paddingBottom: last ? 0 : 6, borderBottom: last ? undefined : "1px solid var(--line)" }}>
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span className={mono ? "mono" : undefined} style={{ color: "var(--ink)", textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}
