"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import { bulkReshuffleStudents } from "../institute/depth-actions";

type StudentRow = { id: string; firstName: string; surname: string; admissionNo: string; photoPath: string | null; class: { grade: string; section: string } };
type ClassOption = { id: string; grade: string; section: string };

export default function StudentListBody({ students, classes, showReshuffle }: { students: StudentRow[]; classes: ClassOption[]; showReshuffle: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetClass, setTargetClass] = useState("");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function moveSelected() {
    if (!targetClass || selected.size === 0) return;
    startTransition(async () => {
      const res = await bulkReshuffleStudents([...selected], targetClass);
      setMessage(`Moved ${res.moved} student${res.moved === 1 ? "" : "s"}.`);
      setSelected(new Set());
      setTargetClass("");
    });
  }

  return (
    <>
      {showReshuffle && selected.size > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", background: "var(--marigold-tint)", borderBottom: "1px solid var(--line)" }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--marigold-deep)" }}>{selected.size} selected</span>
          <select className="in" value={targetClass} onChange={(e) => setTargetClass(e.target.value)} style={{ width: "auto", fontSize: 12.5 }}>
            <option value="">Move to class…</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.grade}-{c.section}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!targetClass || isPending}
            onClick={moveSelected}
            style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            {isPending ? "Moving…" : "Move"}
          </button>
          <span onClick={() => setSelected(new Set())} style={{ fontSize: 12, color: "var(--muted)", cursor: "pointer" }}>
            Clear
          </span>
        </div>
      )}
      {message && (
        <div style={{ padding: "6px 20px", fontSize: 12, color: "var(--good)", fontWeight: 600 }}>
          {message}
        </div>
      )}

      <div style={{ overflowY: "auto", flex: 1 }}>
        {students.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>
            No students match these filters.
          </div>
        )}
        {students.map((s) => (
          <div
            key={s.id}
            style={{
              display: "grid",
              gridTemplateColumns: showReshuffle ? "auto 1.9fr 1.3fr 0.7fr 0.7fr 1.2fr 0.8fr" : "1.9fr 1.3fr 0.7fr 0.7fr 1.2fr 0.8fr",
              alignItems: "center",
              padding: "12px 20px",
              borderBottom: "1px solid var(--line)",
            }}
          >
            {showReshuffle && (
              <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} style={{ marginRight: 8 }} />
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar photoPath={s.photoPath} seed={s.id} name={`${s.firstName} ${s.surname}`} size={32} fontSize={11.5} />
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{s.firstName}</div>
            </div>
            <div style={{ fontSize: 13.5 }}>{s.surname}</div>
            <div className="mono" style={{ fontSize: 12.5 }}>{s.class.grade}</div>
            <div className="mono" style={{ fontSize: 12.5 }}>{s.class.section}</div>
            <div className="mono" style={{ fontSize: 12.5, color: "var(--muted)" }}>
              {s.admissionNo}
            </div>
            <div>
              <Link
                href={`/app/students/${s.id}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  background: "var(--card)",
                  border: "1px solid var(--line)",
                  borderRadius: 6,
                  padding: "5px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--marigold-deep)",
                  textDecoration: "none",
                }}
              >
                Open →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
