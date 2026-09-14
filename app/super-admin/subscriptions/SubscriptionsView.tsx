"use client";

import { useState } from "react";
import { formatINR } from "@/lib/format";
import RecordPaymentPanel from "./RecordPaymentPanel";

type Row = {
  invoiceId: string;
  schoolId: string;
  schoolName: string;
  billingPeriod: string;
  amount: number;
  paidAmount: number;
  status: string;
  dueDate: string;
  lastPaymentDate: string | null;
};

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  PAID: { bg: "var(--good-tint)", fg: "var(--good)", label: "Active" },
  PENDING_SOON: { bg: "var(--warn-tint)", fg: "var(--warn)", label: "Expiring soon" },
  OVERDUE: { bg: "var(--critical-tint)", fg: "var(--critical)", label: "Overdue" },
  PENDING: { bg: "var(--info-tint)", fg: "var(--info)", label: "Pending" },
};

function rowStatus(r: Row): keyof typeof STATUS_STYLE {
  if (r.status === "PAID") return "PAID";
  const overdue = new Date(r.dueDate) < new Date();
  if (overdue) return "OVERDUE";
  const daysLeft = Math.ceil((new Date(r.dueDate).getTime() - Date.now()) / 86400000);
  if (daysLeft <= 30) return "PENDING_SOON";
  return "PENDING";
}

export default function SubscriptionsView({ rows }: { rows: Row[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(rows.find((r) => rowStatus(r) === "OVERDUE")?.invoiceId ?? null);
  const selected = rows.find((r) => r.invoiceId === selectedId);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 18, flex: 1, minHeight: 0 }}>
      <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Subscription ledger</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{rows.length} invoices</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2.4fr 1fr 1.05fr 0.95fr 0.95fr 0.95fr", fontSize: 11, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.04em", paddingBottom: 10, borderBottom: "1px solid var(--line)" }}>
        <div>School</div>
        <div>Amount / yr</div>
        <div>Status</div>
        <div>Due date</div>
        <div>Last payment</div>
        <div>Paid</div>
      </div>
      <div style={{ overflowY: "auto", flex: 1 }}>
        {rows.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>No invoices yet.</div>}
        {rows.map((r) => {
          const status = rowStatus(r);
          const style = STATUS_STYLE[status];
          const isSelected = r.invoiceId === selectedId;
          const isOverdue = status === "OVERDUE";
          return (
            <div
              key={r.invoiceId}
              onClick={() => setSelectedId(r.invoiceId)}
              style={{
                display: "grid",
                gridTemplateColumns: "2.4fr 1fr 1.05fr 0.95fr 0.95fr 0.95fr",
                alignItems: "center",
                padding: "12px 0",
                borderBottom: "1px solid var(--line)",
                fontSize: 13,
                cursor: "pointer",
                background: isSelected ? "var(--marigold-tint)" : isOverdue ? "var(--critical-tint)" : "transparent",
              }}
            >
              <div style={{ fontWeight: 600 }}>{r.schoolName}</div>
              <div className="mono" style={{ color: isOverdue ? "var(--critical)" : undefined, fontWeight: isOverdue ? 600 : 400 }}>
                {formatINR(r.amount)}
              </div>
              <div>
                <span className="pill" style={{ background: style.bg, color: style.fg }}>
                  {style.label}
                </span>
              </div>
              <div className="mono" style={{ color: isOverdue ? "var(--critical)" : "var(--muted)", fontWeight: isOverdue ? 600 : 400 }}>
                {new Date(r.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              </div>
              <div className="mono" style={{ color: "var(--muted)" }}>
                {r.lastPaymentDate ? new Date(r.lastPaymentDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
              </div>
              <div className="mono" style={{ color: "var(--muted)" }}>
                {formatINR(r.paidAmount)}
              </div>
            </div>
          );
        })}
      </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, minHeight: 0 }}>
        <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
          {selected ? (
            <RecordPaymentPanel
              invoice={{ id: selected.invoiceId, schoolName: selected.schoolName, billingPeriod: selected.billingPeriod, amount: selected.amount, dueDate: selected.dueDate, status: selected.status, paidAmount: selected.paidAmount }}
            />
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Select a school from the ledger to record a payment.</div>
          )}
        </div>
      </div>
    </div>
  );
}
