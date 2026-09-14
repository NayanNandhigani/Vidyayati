"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { recordPayment, type PaymentFormState } from "./actions";
import { addFeeDiscount, removeFeeDiscount, addFeeAdjustment, removeFeeAdjustment } from "./depth-actions";
import type { DiscountKind, DiscountValueType } from "@prisma/client";

type Discount = { id: string; kind: DiscountKind; valueType: DiscountValueType; value: number; note: string | null };
type Adjustment = { id: string; description: string; amount: number };
type Row = {
  id: string;
  name: string;
  className: string;
  classId: string;
  total: number;
  paid: number;
  pending: number;
  discountAmount: number;
  lateFine: number;
  adjustmentAmount: number;
  status: "PAID" | "PENDING" | "OVERDUE" | "NONE";
  recentPayments: { paidOn: string; method: string; amount: number }[];
  discounts: Discount[];
  adjustments: Adjustment[];
};

function toCsv(rows: Row[]): string {
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ["Student", "Class", "Total", "Paid", "Pending", "Status"];
  const lines = [header.map(escape).join(",")];
  for (const r of rows) lines.push([r.name, r.className, r.total, r.paid, r.pending, r.status].map(escape).join(","));
  return lines.join("\r\n");
}

const STATUS_STYLE = {
  PAID: { bg: "var(--good-tint)", fg: "var(--good)", label: "Paid" },
  PENDING: { bg: "var(--warn-tint)", fg: "var(--warn)", label: "Pending" },
  OVERDUE: { bg: "#fff", fg: "var(--critical)", label: "Overdue" },
  NONE: { bg: "var(--line)", fg: "var(--muted)", label: "No dues" },
} as const;

function formatINR(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

const initialState: PaymentFormState = {};

export default function FeesView({
  rows,
  canEdit,
  showDiscounts,
  showGst,
  gstNumber,
  gstRatePercent,
}: {
  rows: Row[];
  canEdit: boolean;
  showDiscounts: boolean;
  showGst: boolean;
  gstNumber: string | null;
  gstRatePercent: number | null;
}) {
  // Storing the id (not the whole Row object) and deriving `selected` fresh
  // from the `rows` prop on every render means a server action that
  // changes this student's data (discounts, payments) shows up immediately
  // once Next re-fetches `rows` — no stale snapshot frozen at selection time.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const [state, formAction, pending] = useActionState(recordPayment, initialState);
  const [, startTransition] = useTransition();
  const [discountKind, setDiscountKind] = useState<DiscountKind>("SCHOLARSHIP" as DiscountKind);
  const [discountType, setDiscountType] = useState<DiscountValueType>("PERCENT" as DiscountValueType);
  const [discountValue, setDiscountValue] = useState("");
  const [chargeDesc, setChargeDesc] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);

  useEffect(() => {
    if (state.success) setSelectedId(null);
  }, [state.success]);

  function addDiscount() {
    if (!selected || !discountValue) return;
    startTransition(() => addFeeDiscount(selected.id, discountKind, discountType, Number(discountValue), ""));
    setDiscountValue("");
  }

  function addCharge() {
    if (!selected || !chargeDesc.trim() || !chargeAmount) return;
    startTransition(() => addFeeAdjustment(selected.id, chargeDesc, Number(chargeAmount)));
    setChargeDesc("");
    setChargeAmount("");
  }

  const classOptions = Array.from(new Map(rows.map((r) => [r.classId, r.className])).entries()).sort((a, b) => a[1].localeCompare(b[1]));
  const filteredRows = rows.filter((r) => (!classFilter || r.classId === classFilter) && (!pendingOnly || r.pending > 0));

  function exportCsv() {
    const blob = new Blob([toCsv(filteredRows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = pendingOnly ? "pending-fees.csv" : "fees.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 16, flex: 1, minHeight: 0 }}>
      <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} style={{ fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--line)" }}>
            <option value="">All classes</option>
            {classOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--muted)", cursor: "pointer" }}>
            <input type="checkbox" checked={pendingOnly} onChange={(e) => setPendingOnly(e.target.checked)} />
            Pending only
          </label>
          <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--faint)" }}>
            {filteredRows.length} of {rows.length} students
          </span>
          <span onClick={exportCsv} style={{ fontSize: 12, fontWeight: 700, color: "var(--marigold-deep)", cursor: "pointer" }}>
            Export CSV ↓
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr", padding: "13px 20px", borderBottom: "1px solid var(--line)", fontSize: 10.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          <div>Student</div>
          <div>Class</div>
          <div>Total</div>
          <div>Paid</div>
          <div>Pending</div>
          <div>Status</div>
        </div>
        <div style={{ overflowY: "auto" }}>
          {filteredRows.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>No students found.</div>}
          {filteredRows.map((r) => {
            const style = STATUS_STYLE[r.status];
            const isSelected = selectedId === r.id;
            return (
              <div
                key={r.id}
                onClick={() => canEdit && setSelectedId(r.id)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr",
                  alignItems: "center",
                  padding: "12px 20px",
                  borderBottom: "1px solid var(--line)",
                  fontSize: 13,
                  cursor: canEdit ? "pointer" : "default",
                  boxShadow: isSelected ? "inset 3px 0 0 var(--marigold)" : undefined,
                  background: r.status === "OVERDUE" ? "var(--critical-tint)" : "transparent",
                }}
              >
                <div style={{ fontWeight: isSelected ? 700 : 600 }}>{r.name}</div>
                <div style={{ color: "var(--muted)" }}>{r.className}</div>
                <div className="mono">{formatINR(r.total)}</div>
                <div className="mono" style={{ color: r.paid > 0 ? "var(--good)" : undefined }}>
                  {formatINR(r.paid)}
                </div>
                <div className="mono" style={{ color: r.pending > 0 ? style.fg : "var(--faint)", fontWeight: r.status === "OVERDUE" ? 700 : 400 }}>
                  {formatINR(r.pending)}
                </div>
                <div>
                  <span className="pill" style={{ background: style.bg, color: style.fg }}>
                    {style.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {canEdit && (
        <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16, position: "relative" }}>
          {selected ? (
            <>
              <span onClick={() => setSelectedId(null)} style={{ position: "absolute", top: 14, right: 14, width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, color: "var(--muted)", cursor: "pointer" }}>
                ×
              </span>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 2 }}>Record a payment</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  {selected.name} · {selected.className} · {formatINR(selected.pending)} pending
                </div>
                {(selected.discountAmount > 0 || selected.lateFine > 0) && (
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                    {selected.discountAmount > 0 && <span style={{ color: "var(--good)" }}>−{formatINR(selected.discountAmount)} discount</span>}
                    {selected.discountAmount > 0 && selected.lateFine > 0 && " · "}
                    {selected.lateFine > 0 && <span style={{ color: "var(--critical)" }}>+{formatINR(selected.lateFine)} late fine</span>}
                  </div>
                )}
                {showGst && gstRatePercent != null && (
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                    Incl. GST @ {gstRatePercent}%{gstNumber && ` · GSTIN ${gstNumber}`} — tax component ≈ {formatINR((selected.pending * gstRatePercent) / (100 + gstRatePercent))}
                  </div>
                )}
              </div>

              {showDiscounts && (
                <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                  <div style={{ fontSize: 11.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Discounts</div>
                  {selected.discounts.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                      {selected.discounts.map((d) => (
                        <div key={d.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                          <span>
                            {d.kind[0] + d.kind.slice(1).toLowerCase()} — {d.valueType === "PERCENT" ? `${d.value}%` : formatINR(d.value)}
                          </span>
                          <span onClick={() => startTransition(() => removeFeeDiscount(d.id))} style={{ color: "var(--critical)", cursor: "pointer", fontWeight: 700 }}>
                            Remove
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <select value={discountKind} onChange={(e) => setDiscountKind(e.target.value as DiscountKind)} style={{ fontSize: 11.5, padding: "4px 6px" }}>
                      <option value="SCHOLARSHIP">Scholarship</option>
                      <option value="SIBLING">Sibling</option>
                      <option value="OTHER">Other</option>
                    </select>
                    <select value={discountType} onChange={(e) => setDiscountType(e.target.value as DiscountValueType)} style={{ fontSize: 11.5, padding: "4px 6px" }}>
                      <option value="PERCENT">%</option>
                      <option value="FLAT">₹ flat</option>
                    </select>
                    <input className="in" type="number" min={0} value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder="Value" style={{ width: 70, fontSize: 11.5, padding: "4px 6px" }} />
                    <button type="button" onClick={addDiscount} style={{ fontSize: 11.5, fontWeight: 700, background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>
                      Add
                    </button>
                  </div>
                </div>
              )}

              {showDiscounts && (
                <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                  <div style={{ fontSize: 11.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Additional charges</div>
                  {selected.adjustments.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                      {selected.adjustments.map((a) => (
                        <div key={a.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                          <span>
                            {a.description} — {formatINR(a.amount)}
                          </span>
                          <span onClick={() => startTransition(() => removeFeeAdjustment(a.id))} style={{ color: "var(--critical)", cursor: "pointer", fontWeight: 700 }}>
                            Remove
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <input className="in" value={chargeDesc} onChange={(e) => setChargeDesc(e.target.value)} placeholder="e.g. Lab breakage charge" style={{ flex: 1, minWidth: 130, fontSize: 11.5, padding: "4px 6px" }} />
                    <input className="in mono" type="number" min={0} value={chargeAmount} onChange={(e) => setChargeAmount(e.target.value)} placeholder="₹" style={{ width: 80, fontSize: 11.5, padding: "4px 6px" }} />
                    <button type="button" onClick={addCharge} style={{ fontSize: 11.5, fontWeight: 700, background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>
                      Add charge
                    </button>
                  </div>
                </div>
              )}

              <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <input type="hidden" name="studentId" value={selected.id} />
                <label className="field">
                  Amount received
                  <input className="in mono" name="amount" type="number" min={0} step={1} placeholder="0" required />
                </label>
                <label className="field">
                  Payment method
                  <select className="in" name="method" defaultValue="Bank Transfer">
                    <option>Bank Transfer</option>
                    <option>UPI</option>
                    <option>Cash</option>
                    <option>Cheque</option>
                    <option>Card</option>
                  </select>
                </label>
                <label className="field">
                  Reference / receipt no.
                  <input className="in mono" name="referenceNo" type="text" placeholder="TXN-88213" />
                </label>
                <label className="field">
                  Date received
                  <input className="in mono" name="paidOn" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
                </label>
                {state.error && (
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--critical)", background: "var(--critical-tint)", border: "1px solid var(--critical-border)", borderRadius: 8, padding: "8px 11px" }}>
                    {state.error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={pending}
                  style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: 10, textAlign: "center", fontSize: 13.5, fontWeight: 700, cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1 }}
                >
                  {pending ? "Recording…" : "Record Payment"}
                </button>
              </form>
              <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14, marginTop: 2 }}>
                <div style={{ fontSize: 11.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Recent payments</div>
                {selected.recentPayments.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: "var(--muted)" }}>No payments recorded yet.</div>
                ) : (
                  selected.recentPayments.map((p, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 8 }}>
                      <span style={{ color: "var(--muted)" }}>
                        {new Date(p.paidOn).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} · {p.method}
                      </span>
                      <span className="mono" style={{ fontWeight: 600 }}>
                        {formatINR(p.amount)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div style={{ color: "var(--muted)", fontSize: 13.5, display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>Select a student to record a payment.</div>
          )}
        </div>
      )}
    </div>
  );
}
