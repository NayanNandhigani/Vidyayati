"use client";

import { useState, useTransition } from "react";
import { setClassFeeDefault } from "./actions";

export type GradeFeeRow = { grade: string; sectionCount: number; actualFee: number | null };

export default function FeeStructurePanel({ grades }: { grades: GradeFeeRow[] }) {
  return (
    <div>
      <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 2 }}>Fee Structure</div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 18 }}>
        Set the actual fee for each class (grade) — shared by every section in it. This is what shows on a student's profile and prepopulates admission approval; a student's charged fee (and scholarship) is set individually per student.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "0.7fr 1fr auto", gap: 10, padding: "0 12px 10px", fontSize: 10.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        <div>Class</div>
        <div>Actual fee (₹)</div>
        <div />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {grades.map((g) => (
          <FeeRow key={g.grade} gradeRow={g} />
        ))}
      </div>
    </div>
  );
}

function FeeRow({ gradeRow }: { gradeRow: GradeFeeRow }) {
  const [pending, startTransition] = useTransition();
  const [actualFee, setActualFee] = useState(gradeRow.actualFee != null ? String(gradeRow.actualFee) : "");
  const [saved, setSaved] = useState(false);

  function save() {
    const actual = Number(actualFee);
    if (!actualFee || Number.isNaN(actual)) return;
    startTransition(async () => {
      await setClassFeeDefault(gradeRow.grade, actual);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "0.7fr 1fr auto", gap: 10, alignItems: "center", padding: "8px 12px", background: "var(--paper)", borderRadius: 8 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 13 }}>Class {gradeRow.grade}</div>
        <div style={{ fontSize: 10.5, color: "var(--faint)" }}>
          {gradeRow.sectionCount} section{gradeRow.sectionCount === 1 ? "" : "s"}
        </div>
      </div>
      <input className="in mono" type="number" min={0} value={actualFee} onChange={(e) => setActualFee(e.target.value)} placeholder="0" style={{ fontSize: 12.5 }} />
      <button
        type="button"
        onClick={save}
        disabled={pending}
        style={{ fontSize: 11.5, fontWeight: 700, background: saved ? "var(--good)" : "var(--marigold)", color: "#fff", border: "none", borderRadius: 6, padding: "7px 12px", cursor: pending ? "default" : "pointer" }}
      >
        {saved ? "Saved" : pending ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
