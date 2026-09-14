"use client";

import { useState } from "react";

type Row = { id: string; name: string; admissionNo: string };

export default function HallTicketPanel({ examId, examApproved, rows }: { examId: string; examApproved: boolean; rows: Row[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (!examApproved) {
    return (
      <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
        Hall tickets are available once this exam has been approved by a School Admin.
      </div>
    );
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  }

  const selectedUrl = selected.size > 0 ? `/api/exams/${examId}/hall-ticket/pdf?studentIds=${[...selected].join(",")}` : null;

  return (
    <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>Hall tickets</div>
        <div style={{ display: "flex", gap: 10 }}>
          {selectedUrl && (
            <a
              href={selectedUrl}
              target="_blank"
              rel="noreferrer"
              style={{ background: "var(--card)", border: "1px solid var(--marigold)", color: "var(--marigold-deep)", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}
            >
              Download selected ({selected.size}) ↓
            </a>
          )}
          <a
            href={`/api/exams/${examId}/hall-ticket/pdf`}
            target="_blank"
            rel="noreferrer"
            style={{ background: "var(--marigold)", color: "#fff", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}
          >
            Download all (class) ↓
          </a>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "auto 1.8fr 1fr auto", padding: "11px 20px", borderBottom: "1px solid var(--line)", fontSize: 10, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        <input type="checkbox" checked={rows.length > 0 && selected.size === rows.length} onChange={toggleAll} />
        <div>Student</div>
        <div>Admission no.</div>
        <div />
      </div>

      {rows.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>No students in this class.</div>}

      {rows.map((r) => (
        <div key={r.id} style={{ display: "grid", gridTemplateColumns: "auto 1.8fr 1fr auto", alignItems: "center", padding: "11px 20px", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
          <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
          <div style={{ fontWeight: 600 }}>{r.name}</div>
          <div className="mono" style={{ color: "var(--muted)" }}>{r.admissionNo}</div>
          <a href={`/api/exams/${examId}/hall-ticket/pdf?studentId=${r.id}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 700, color: "var(--marigold-deep)", textDecoration: "none", whiteSpace: "nowrap" }}>
            Download
          </a>
        </div>
      ))}
    </div>
  );
}
