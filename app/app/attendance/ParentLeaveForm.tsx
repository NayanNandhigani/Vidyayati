"use client";

import { useState, useTransition } from "react";
import { applyForLeave } from "./depth-actions";

type Req = { id: string; dateFrom: string; dateTo: string; reason: string; stage: string; rejectionNote: string | null };

const STAGE_LABEL: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Awaiting class teacher", color: "var(--warn)" },
  CLASS_TEACHER_APPROVED: { label: "Awaiting admin", color: "var(--info)" },
  ADMIN_APPROVED: { label: "Approved", color: "var(--good)" },
  REJECTED: { label: "Rejected", color: "var(--critical)" },
};

export default function ParentLeaveForm({ studentId, requests }: { studentId: string; requests: Req[] }) {
  const [, startTransition] = useTransition();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [reason, setReason] = useState("");
  const [showForm, setShowForm] = useState(false);

  function submit() {
    if (!dateFrom || !dateTo || !reason.trim()) return;
    startTransition(async () => {
      await applyForLeave(studentId, dateFrom, dateTo, reason);
      setDateFrom("");
      setDateTo("");
      setReason("");
      setShowForm(false);
    });
  }

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>Leave requests</div>
        <span onClick={() => setShowForm((v) => !v)} style={{ fontSize: 11.5, fontWeight: 700, color: "var(--marigold-deep)", cursor: "pointer" }}>
          {showForm ? "Cancel" : "+ Apply for leave"}
        </span>
      </div>
      {showForm && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, alignItems: "flex-end" }}>
          <label className="field" style={{ margin: 0 }}>
            From
            <input className="in" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label className="field" style={{ margin: 0 }}>
            To
            <input className="in" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
          <label className="field" style={{ margin: 0, flex: 1, minWidth: 160 }}>
            Reason
            <input className="in" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Family function" />
          </label>
          <button type="button" onClick={submit} style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
            Submit
          </button>
        </div>
      )}
      {requests.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--muted)" }}>No leave requests submitted yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {requests.map((r) => {
            const stage = STAGE_LABEL[r.stage];
            return (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 10px", background: "var(--paper)", borderRadius: 6 }}>
                <span>
                  {new Date(r.dateFrom).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} – {new Date(r.dateTo).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} · {r.reason}
                </span>
                <span style={{ fontWeight: 700, color: stage.color }}>{stage.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
