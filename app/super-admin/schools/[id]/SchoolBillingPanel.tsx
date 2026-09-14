"use client";

import { useState } from "react";
import Link from "next/link";
import { formatINR } from "@/lib/format";
import RecordPaymentPanel from "../../subscriptions/RecordPaymentPanel";

export type SchoolInvoiceRow = {
  id: string;
  schoolName: string;
  plan: string | null;
  billingPeriod: string;
  amount: number;
  paidAmount: number;
  status: string;
  dueDate: string;
  lastPaymentDate: string | null;
};

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  PAID: { bg: "var(--good-tint)", fg: "var(--good)", label: "Paid" },
  PENDING_SOON: { bg: "var(--warn-tint)", fg: "var(--warn)", label: "Due soon" },
  OVERDUE: { bg: "var(--critical-tint)", fg: "var(--critical)", label: "Overdue" },
  PENDING: { bg: "var(--info-tint)", fg: "var(--info)", label: "Pending" },
};

function rowStatus(r: SchoolInvoiceRow): keyof typeof STATUS_STYLE {
  if (r.status === "PAID") return "PAID";
  const overdue = new Date(r.dueDate) < new Date();
  if (overdue) return "OVERDUE";
  const daysLeft = Math.ceil((new Date(r.dueDate).getTime() - Date.now()) / 86400000);
  if (daysLeft <= 30) return "PENDING_SOON";
  return "PENDING";
}

export default function SchoolBillingPanel({ schoolId, invoices }: { schoolId: string; invoices: SchoolInvoiceRow[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(invoices.find((r) => rowStatus(r) !== "PAID")?.id ?? null);
  const selected = invoices.find((r) => r.id === selectedId);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>Invoices</div>
          <Link href={`/super-admin/subscriptions/new?school=${schoolId}`} style={{ fontSize: 12, fontWeight: 600, color: "var(--marigold-deep)", textDecoration: "none" }}>
            + New invoice
          </Link>
        </div>
        {invoices.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "var(--faint)", padding: "10px 0" }}>No invoices yet for this school.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {invoices.map((r) => {
              const status = rowStatus(r);
              const style = STATUS_STYLE[status];
              const isSelected = r.id === selectedId;
              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 0.8fr 0.9fr 0.9fr",
                    alignItems: "center",
                    padding: "9px 10px",
                    borderRadius: 8,
                    fontSize: 12.5,
                    cursor: "pointer",
                    background: isSelected ? "var(--marigold-tint)" : "var(--paper)",
                    border: "1px solid " + (isSelected ? "var(--marigold)" : "var(--line)"),
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{r.billingPeriod}</div>
                  <div className="mono">{formatINR(r.amount)}</div>
                  <div>
                    <span className="pill" style={{ background: style.bg, color: style.fg }}>
                      {style.label}
                    </span>
                  </div>
                  <div className="mono" style={{ color: "var(--muted)", textAlign: "right" }}>
                    {new Date(r.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 16 }}>
        {selected ? (
          <RecordPaymentPanel invoice={{ id: selected.id, schoolName: selected.schoolName, billingPeriod: selected.billingPeriod, amount: selected.amount, dueDate: selected.dueDate, status: selected.status, paidAmount: selected.paidAmount }} />
        ) : (
          <div style={{ fontSize: 12.5, color: "var(--faint)", textAlign: "center", padding: "20px 0" }}>Select an invoice to record a payment.</div>
        )}
      </div>
    </div>
  );
}
