import Link from "next/link";
import type { HostelAttendanceSession } from "@prisma/client";

const SESSION_LABEL: Record<HostelAttendanceSession, string> = { MORNING: "Morning", EVENING: "Evening", NIGHT: "Night" };

export function HostelAttendanceReports({
  absentToday,
  summary,
}: {
  absentToday: { id: string; name: string; session: HostelAttendanceSession }[];
  summary: { id: string; name: string; pct: number; marked: number }[];
}) {
  const lowAttendance = [...summary].filter((s) => s.marked > 0 && s.pct < 75).sort((a, b) => a.pct - b.pct);

  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 10 }}>
        Attendance reports
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--faint)", marginBottom: 6 }}>Absent today</div>
          {absentToday.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--muted)" }}>None.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {absentToday.map((a, i) => (
                <Link key={`${a.id}-${a.session}-${i}`} href={`/app/students/${a.id}`} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "inherit", textDecoration: "none" }}>
                  <span>{a.name}</span>
                  <span className="mono" style={{ fontWeight: 700, color: "var(--critical)" }}>{SESSION_LABEL[a.session]}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--faint)", marginBottom: 6 }}>Below 75% (last 90 marks)</div>
          {lowAttendance.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--muted)" }}>None.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {lowAttendance.map((s) => (
                <Link key={s.id} href={`/app/students/${s.id}`} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "inherit", textDecoration: "none" }}>
                  <span>{s.name}</span>
                  <span className="mono" style={{ fontWeight: 700, color: "var(--critical)" }}>{s.pct}%</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
