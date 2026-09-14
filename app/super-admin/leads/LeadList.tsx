import Link from "next/link";
import { formatINR } from "@/lib/format";
import { formatAddress } from "@/lib/address";

export type LeadRow = {
  id: string;
  schoolNameProposed: string;
  contactName: string;
  contactPhone: string;
  stage: "NEW" | "CONTACTED" | "DEMO_SCHEDULED" | "DEMO_DONE" | "PROPOSAL_SENT" | "NEGOTIATION" | "WON" | "LOST";
  source: string;
  estimatedValue: number | null;
  addressLine: string | null;
  mandal: string | null;
  district: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  updatedAt: string;
};

const STAGE_STYLE: Record<LeadRow["stage"], { bg: string; fg: string; label: string }> = {
  NEW: { bg: "var(--info-tint)", fg: "var(--info)", label: "New" },
  CONTACTED: { bg: "var(--marigold-tint)", fg: "var(--marigold-deep)", label: "Contacted" },
  DEMO_SCHEDULED: { bg: "var(--teal-tint)", fg: "var(--teal)", label: "Demo Scheduled" },
  DEMO_DONE: { bg: "var(--teal-tint)", fg: "var(--teal)", label: "Demo Done" },
  PROPOSAL_SENT: { bg: "var(--clay-tint)", fg: "var(--clay)", label: "Proposal Sent" },
  NEGOTIATION: { bg: "var(--clay-tint)", fg: "var(--clay)", label: "Negotiation" },
  WON: { bg: "var(--good-tint)", fg: "var(--good)", label: "Won" },
  LOST: { bg: "var(--critical-tint)", fg: "var(--critical)", label: "Lost" },
};

export default function LeadList({ leads }: { leads: LeadRow[] }) {
  if (leads.length === 0) {
    return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 13 }}>No leads yet.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1.4fr 1.8fr 1fr 1fr 1.1fr", fontSize: 11, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.04em", paddingBottom: 10, borderBottom: "1px solid var(--line)" }}>
        <div>School</div>
        <div>Contact</div>
        <div>Address</div>
        <div>Source</div>
        <div>Est. value</div>
        <div>Status</div>
      </div>
      <div style={{ overflowY: "auto", flex: 1 }}>
        {leads.map((lead) => {
          const style = STAGE_STYLE[lead.stage];
          const address = formatAddress(lead);
          return (
            <Link
              key={lead.id}
              href={`/super-admin/leads/${lead.id}`}
              style={{ display: "grid", gridTemplateColumns: "1.6fr 1.4fr 1.8fr 1fr 1fr 1.1fr", alignItems: "center", padding: "13px 0", borderBottom: "1px solid var(--line)", fontSize: 13, textDecoration: "none", color: "inherit" }}
            >
              <div style={{ fontWeight: 600 }}>{lead.schoolNameProposed}</div>
              <div>
                <div>{lead.contactName}</div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 1 }}>
                  {lead.contactPhone}
                </div>
              </div>
              <div style={{ fontSize: 12, color: address ? "var(--muted)" : "var(--faint)" }}>{address ?? "—"}</div>
              <div style={{ color: "var(--muted)", fontSize: 12 }}>{lead.source}</div>
              <div className="mono" style={{ fontSize: 12 }}>
                {lead.estimatedValue != null ? formatINR(lead.estimatedValue) : "—"}
              </div>
              <div>
                <span className="pill" style={{ background: style.bg, color: style.fg }}>
                  {style.label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
