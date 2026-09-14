"use client";

import { useState, useTransition } from "react";
import { updateLibraryFineSettings, issueBookByAccession, returnBookByAccession } from "./depth-actions";

export function LibraryFineSettings({ ratePerDay, graceDays }: { ratePerDay: number | null; graceDays: number | null }) {
  const [, startTransition] = useTransition();
  const [rate, setRate] = useState(ratePerDay?.toString() ?? "");
  const [grace, setGrace] = useState(graceDays?.toString() ?? "");

  function save() {
    startTransition(() => updateLibraryFineSettings(rate ? Number(rate) : null, grace ? Number(grace) : null));
  }

  return (
    <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--muted)" }}>
      Fine ₹
      <input className="in" type="number" min={0} value={rate} onChange={(e) => setRate(e.target.value)} onBlur={save} style={{ width: 50, fontSize: 11.5, padding: "3px 6px" }} />
      /day after
      <input className="in" type="number" min={0} value={grace} onChange={(e) => setGrace(e.target.value)} onBlur={save} style={{ width: 40, fontSize: 11.5, padding: "3px 6px" }} />
      grace days
    </label>
  );
}

export function ScanCirculation({ students }: { students: { id: string; name: string }[] }) {
  const [pending, startTransition] = useTransition();
  const [studentId, setStudentId] = useState("");
  const [issueAcc, setIssueAcc] = useState("");
  const [returnAcc, setReturnAcc] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  function doIssue() {
    if (!studentId || !issueAcc.trim()) return;
    setMsg(null);
    startTransition(async () => {
      try {
        await issueBookByAccession(studentId, issueAcc.trim());
        setMsg({ text: `Issued "${issueAcc.trim()}".`, ok: true });
        setIssueAcc("");
      } catch (e) {
        setMsg({ text: e instanceof Error ? e.message : "Could not issue.", ok: false });
      }
    });
  }

  function doReturn() {
    if (!returnAcc.trim()) return;
    setMsg(null);
    startTransition(async () => {
      try {
        const res = await returnBookByAccession(returnAcc.trim());
        setMsg({ text: res.fine > 0 ? `Returned "${returnAcc.trim()}" — fine ₹${res.fine} charged.` : `Returned "${returnAcc.trim()}", no fine.`, ok: true });
        setReturnAcc("");
      } catch (e) {
        setMsg({ text: e instanceof Error ? e.message : "Could not return.", ok: false });
      }
    });
  }

  return (
    <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12, marginTop: 4, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 11.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Scan mode (barcode/QR)</div>
      <div style={{ display: "flex", gap: 6 }}>
        <select className="in" value={studentId} onChange={(e) => setStudentId(e.target.value)} style={{ fontSize: 12, flex: 1 }}>
          <option value="">Student…</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          className="in mono"
          placeholder="Scan/enter accession no."
          value={issueAcc}
          onChange={(e) => setIssueAcc(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doIssue()}
          style={{ fontSize: 12, flex: 1 }}
        />
        <button type="button" disabled={pending} onClick={doIssue} style={{ fontSize: 11.5, fontWeight: 700, background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 6, padding: "0 12px", cursor: pending ? "default" : "pointer" }}>
          Issue
        </button>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          className="in mono"
          placeholder="Scan/enter accession no. to return"
          value={returnAcc}
          onChange={(e) => setReturnAcc(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doReturn()}
          style={{ fontSize: 12, flex: 1 }}
        />
        <button type="button" disabled={pending} onClick={doReturn} style={{ fontSize: 11.5, fontWeight: 700, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 6, padding: "0 12px", cursor: pending ? "default" : "pointer" }}>
          Return
        </button>
      </div>
      {msg && <div style={{ fontSize: 11.5, fontWeight: 600, color: msg.ok ? "var(--good)" : "var(--critical)" }}>{msg.text}</div>}
    </div>
  );
}
