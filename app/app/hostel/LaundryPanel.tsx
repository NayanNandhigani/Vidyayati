"use client";

import { useState, useTransition } from "react";
import { registerLaundry, markLaundryCollected, deleteLaundryTicket, type LaundryItemInput } from "./laundry-actions";

export type LaundryStudentOption = { id: string; name: string; roomNo: string };
export type LaundryTicketRow = {
  id: string;
  tokenNo: string;
  studentName: string;
  roomNo: string;
  submittedAt: string;
  collectionDate: string | null;
  collectedAt: string | null;
  status: "PENDING" | "COLLECTED";
  items: { itemType: string; quantity: number }[];
};

const ITEM_SUGGESTIONS = ["Shirt", "Pant", "T-Shirt", "Trousers", "Towel", "Bedsheet", "Undergarments", "Socks"];

function emptyRow(): LaundryItemInput {
  return { itemType: "", quantity: 1 };
}

export default function LaundryPanel({ students, tickets, canEdit }: { students: LaundryStudentOption[]; tickets: LaundryTicketRow[]; canEdit: boolean }) {
  const [pending, startTransition] = useTransition();
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [rows, setRows] = useState<LaundryItemInput[]>([emptyRow()]);
  const [collectionDate, setCollectionDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<LaundryTicketRow | null>(null);

  function updateRow(i: number, patch: Partial<LaundryItemInput>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }
  function removeRow(i: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  function submit() {
    if (!studentId) {
      setError("Pick a student.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const result = await registerLaundry(studentId, rows, collectionDate || null);
        const student = students.find((s) => s.id === studentId);
        setReceipt({
          id: result.id,
          tokenNo: result.tokenNo,
          studentName: student?.name ?? "",
          roomNo: student?.roomNo ?? "",
          submittedAt: new Date().toISOString(),
          collectionDate: collectionDate || null,
          collectedAt: null,
          status: "PENDING",
          items: rows.filter((r) => r.itemType.trim() && r.quantity > 0),
        });
        setRows([emptyRow()]);
        setCollectionDate("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not register laundry.");
      }
    });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 16, flex: 1, minHeight: 0 }}>
      <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>Register laundry</div>

        {students.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 12.5 }}>No students currently allocated to a hostel room.</div>
        ) : (
          <>
            <label className="field">
              Student
              <select className="in" value={studentId} onChange={(e) => setStudentId(e.target.value)} disabled={!canEdit}>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — Room {s.roomNo}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ fontSize: 11, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 4 }}>Items submitted</div>
            <datalist id="laundry-item-suggestions">
              {ITEM_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            {rows.map((row, i) => (
              <div key={i} style={{ display: "flex", gap: 6 }}>
                <input
                  className="in"
                  list="laundry-item-suggestions"
                  placeholder="Shirt"
                  value={row.itemType}
                  onChange={(e) => updateRow(i, { itemType: e.target.value })}
                  disabled={!canEdit}
                  style={{ flex: 1, fontSize: 12.5 }}
                />
                <input
                  className="in mono"
                  type="number"
                  min={1}
                  value={row.quantity}
                  onChange={(e) => updateRow(i, { quantity: Number(e.target.value) })}
                  disabled={!canEdit}
                  style={{ width: 64, fontSize: 12.5 }}
                />
                {canEdit && (
                  <span onClick={() => removeRow(i)} style={{ color: "var(--critical)", cursor: "pointer", fontWeight: 700, padding: "0 4px" }}>
                    ×
                  </span>
                )}
              </div>
            ))}
            {canEdit && (
              <span onClick={addRow} style={{ fontSize: 12, fontWeight: 700, color: "var(--marigold-deep)", cursor: "pointer" }}>
                + Add item
              </span>
            )}

            <label className="field">
              Collection date
              <input className="in mono" type="date" value={collectionDate} onChange={(e) => setCollectionDate(e.target.value)} disabled={!canEdit} />
            </label>

            {error && <div style={{ color: "var(--critical)", fontSize: 12 }}>{error}</div>}
            {canEdit && (
              <button
                type="button"
                onClick={submit}
                disabled={pending}
                style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 0", fontSize: 13, fontWeight: 700, cursor: pending ? "default" : "pointer" }}
              >
                {pending ? "Registering…" : "Register & generate token"}
              </button>
            )}
          </>
        )}

        {receipt && <Receipt ticket={receipt} onClose={() => setReceipt(null)} />}
      </div>

      <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1.2fr 1.4fr 0.9fr 0.9fr 0.9fr auto", padding: "13px 20px", borderBottom: "1px solid var(--line)", fontSize: 10.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          <div>Token</div>
          <div>Student</div>
          <div>Items</div>
          <div>Submitted</div>
          <div>Collect by</div>
          <div>Status</div>
          <div />
        </div>
        <div style={{ overflowY: "auto" }}>
          {tickets.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>No laundry submissions logged yet.</div>}
          {tickets.map((t) => (
            <div key={t.id} style={{ display: "grid", gridTemplateColumns: "0.8fr 1.2fr 1.4fr 0.9fr 0.9fr 0.9fr auto", alignItems: "center", padding: "11px 20px", borderBottom: "1px solid var(--line)", fontSize: 12.5 }}>
              <div className="mono" style={{ fontWeight: 700 }}>{t.tokenNo}</div>
              <div>
                {t.studentName}
                <div style={{ fontSize: 10.5, color: "var(--faint)" }}>Room {t.roomNo}</div>
              </div>
              <div style={{ color: "var(--muted)", fontSize: 11.5 }}>{t.items.map((i) => `${i.itemType} ×${i.quantity}`).join(", ")}</div>
              <div className="mono" style={{ fontSize: 11 }}>{new Date(t.submittedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</div>
              <div className="mono" style={{ fontSize: 11 }}>{t.collectionDate ? new Date(t.collectionDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}</div>
              <div>
                <span className="pill" style={{ background: t.status === "COLLECTED" ? "var(--good-tint)" : "var(--warn-tint)", color: t.status === "COLLECTED" ? "var(--good)" : "var(--warn)" }}>
                  {t.status === "COLLECTED" ? "Collected" : "Pending"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span onClick={() => setReceipt(t)} style={{ fontSize: 11.5, fontWeight: 700, color: "var(--marigold-deep)", cursor: "pointer" }}>
                  Receipt
                </span>
                {canEdit && t.status === "PENDING" && (
                  <span onClick={() => startTransition(() => markLaundryCollected(t.id))} style={{ fontSize: 11.5, fontWeight: 700, color: "var(--good)", cursor: pending ? "default" : "pointer" }}>
                    Mark collected
                  </span>
                )}
                {canEdit && (
                  <span onClick={() => startTransition(() => deleteLaundryTicket(t.id))} style={{ color: "var(--critical)", cursor: "pointer", fontWeight: 700 }}>
                    ×
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Receipt({ ticket, onClose }: { ticket: LaundryTicketRow; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: 380, padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 14.5, fontWeight: 700 }}>Laundry Receipt</div>
          <span onClick={onClose} style={{ cursor: "pointer", fontSize: 16, color: "var(--muted)" }}>
            ×
          </span>
        </div>
        <div style={{ textAlign: "center", padding: "12px 0", background: "var(--marigold-tint)", borderRadius: 8 }}>
          <div style={{ fontSize: 10.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Token No.</div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: "var(--marigold-deep)" }}>
            {ticket.tokenNo}
          </div>
        </div>
        <div style={{ fontSize: 13 }}>
          <div>
            <b>{ticket.studentName}</b> · Room {ticket.roomNo}
          </div>
          <div style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 2 }}>
            Submitted {new Date(ticket.submittedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          </div>
          <div style={{ color: "var(--muted)", fontSize: 11.5 }}>
            Collection date: {ticket.collectionDate ? new Date(ticket.collectionDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Not set"}
          </div>
        </div>
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
          <div style={{ fontSize: 11, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Items submitted</div>
          {ticket.items.map((i, idx) => (
            <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
              <span>{i.itemType}</span>
              <span className="mono">×{i.quantity}</span>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 0", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          Print receipt
        </button>
      </div>
    </div>
  );
}
