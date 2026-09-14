"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { initials, studentName } from "@/lib/format";
import { avatarColorFor } from "@/lib/academic";
import type { HostelAttendanceSession, HostelAttendanceStatus } from "@prisma/client";
import { saveHostelAttendance } from "./attendance-actions";

type Resident = { id: string; firstName: string; surname: string; roomNo: string; bedNo: string | null };

type Props = {
  date: string;
  session: HostelAttendanceSession;
  residents: Resident[];
  initialMarks: Record<string, HostelAttendanceStatus>;
  canEdit: boolean;
};

const SESSIONS: { key: HostelAttendanceSession; label: string }[] = [
  { key: "MORNING", label: "Morning" },
  { key: "EVENING", label: "Evening" },
  { key: "NIGHT", label: "Night Roll Call" },
];

const MARKS: { key: HostelAttendanceStatus; label: string }[] = [
  { key: "PRESENT", label: "P" },
  { key: "ABSENT", label: "A" },
  { key: "LATE", label: "L" },
];

function statusColor(status: HostelAttendanceStatus) {
  if (status === "PRESENT") return "var(--good)";
  if (status === "ABSENT") return "var(--critical)";
  return "var(--warn)";
}

export default function HostelAttendanceRoster({ date, session, residents, initialMarks, canEdit }: Props) {
  const [marks, setMarks] = useState<Record<string, HostelAttendanceStatus>>(initialMarks);
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const counts = useMemo(() => {
    let present = 0,
      absent = 0,
      late = 0;
    for (const r of residents) {
      const m = marks[r.id];
      if (m === "PRESENT") present++;
      else if (m === "ABSENT") absent++;
      else if (m === "LATE") late++;
    }
    return { present, absent, late, total: residents.length };
  }, [marks, residents]);

  function setMark(studentId: string, status: HostelAttendanceStatus) {
    setMarks((prev) => ({ ...prev, [studentId]: status }));
  }

  function markAllPresent() {
    const next: Record<string, HostelAttendanceStatus> = {};
    for (const r of residents) next[r.id] = "PRESENT";
    setMarks(next);
  }

  function save() {
    startTransition(async () => {
      await saveHostelAttendance(date, session, marks);
      setSavedAt(Date.now());
    });
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {SESSIONS.map((s) => (
            <Link
              key={s.key}
              href={`/app/hostel?tab=attendance&date=${date}&session=${s.key}`}
              style={{
                padding: "7px 13px",
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 700,
                textDecoration: "none",
                background: session === s.key ? "var(--marigold)" : "var(--card)",
                color: session === s.key ? "#fff" : "var(--muted)",
                border: `1px solid ${session === s.key ? "var(--marigold)" : "var(--line)"}`,
              }}
            >
              {s.label}
            </Link>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            type="date"
            defaultValue={date}
            onChange={(e) => {
              window.location.href = `/app/hostel?tab=attendance&date=${e.target.value}&session=${session}`;
            }}
            className="in"
            style={{ width: "auto" }}
          />
          {canEdit && (
            <>
              <span onClick={markAllPresent} style={{ background: "var(--good)", color: "#fff", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Mark All Present
              </span>
              <button
                onClick={save}
                disabled={pending}
                style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1 }}
              >
                {pending ? "Saving…" : savedAt ? "Saved ✓" : "Save Attendance"}
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 13 }}>
        <CountTile label="Present" value={counts.present} color="var(--good)" />
        <CountTile label="Absent" value={counts.absent} color="var(--critical)" />
        <CountTile label="Late" value={counts.late} color="var(--warn)" />
        <CountTile label="Residents" value={counts.total} />
      </div>

      <div className="card" style={{ padding: 0, flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 0.8fr 0.8fr 1fr", padding: "13px 22px", borderBottom: "1px solid var(--line)", fontSize: 11, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          <div>Student</div>
          <div>Room</div>
          <div>Bed</div>
          <div style={{ textAlign: "right" }}>Mark</div>
        </div>
        <div style={{ overflowY: "auto" }}>
          {residents.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>No students allocated to the hostel yet.</div>}
          {residents.map((r) => (
            <div key={r.id} style={{ display: "grid", gridTemplateColumns: "2fr 0.8fr 0.8fr 1fr", alignItems: "center", padding: "11px 22px", borderBottom: "1px solid var(--line)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: avatarColorFor(r.id), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 700, color: "#fff", flex: "none" }}>
                  {initials(studentName(r))}
                </div>
                <span style={{ fontWeight: 600, fontSize: 13.5 }}>{studentName(r)}</span>
              </div>
              <div className="mono" style={{ color: "var(--muted)", fontSize: 13 }}>{r.roomNo}</div>
              <div className="mono" style={{ color: "var(--muted)", fontSize: 13 }}>{r.bedNo ?? "—"}</div>
              <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
                {MARKS.map((m) => {
                  const on = marks[r.id] === m.key;
                  return (
                    <span
                      key={m.key}
                      onClick={() => canEdit && setMark(r.id, m.key)}
                      style={{
                        width: 34,
                        height: 30,
                        borderRadius: 7,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        border: `1.5px solid ${on ? statusColor(m.key) : "var(--line)"}`,
                        color: on ? "#fff" : "var(--faint)",
                        background: on ? statusColor(m.key) : "transparent",
                        cursor: canEdit ? "pointer" : "default",
                        userSelect: "none",
                      }}
                    >
                      {m.label}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function CountTile({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="card" style={{ padding: "14px 17px" }}>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 6 }}>{label}</div>
      <div className="mono" style={{ fontSize: 21, fontWeight: 700, color: color ?? "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}
