"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { updateAttendanceThresholds } from "./depth-actions";

type Flag = { id: string; name: string; className: string; pct?: number; streak?: number };

export default function AttendanceFlagsPanel({
  defaulters,
  consecutiveAbsentees,
  isAdmin,
  defaulterPct,
  consecutiveDays,
}: {
  defaulters: Flag[];
  consecutiveAbsentees: Flag[];
  isAdmin: boolean;
  defaulterPct: number | null;
  consecutiveDays: number | null;
}) {
  const [, startTransition] = useTransition();
  const [pct, setPct] = useState(defaulterPct?.toString() ?? "");
  const [days, setDays] = useState(consecutiveDays?.toString() ?? "");

  function save() {
    startTransition(() => updateAttendanceThresholds(pct ? Number(pct) : null, days ? Number(days) : null));
  }

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--faint)" }}>
          Attendance flags
        </div>
        {isAdmin && (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <label style={{ fontSize: 11, color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
              Defaulter below
              <input className="in" type="number" value={pct} onChange={(e) => setPct(e.target.value)} onBlur={save} style={{ width: 46, fontSize: 11, padding: "3px 5px" }} />%
            </label>
            <label style={{ fontSize: 11, color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
              Flag after
              <input className="in" type="number" value={days} onChange={(e) => setDays(e.target.value)} onBlur={save} style={{ width: 40, fontSize: 11, padding: "3px 5px" }} /> consecutive absences
            </label>
          </div>
        )}
      </div>

      {defaulterPct == null && consecutiveDays == null ? (
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
          {isAdmin ? "Set a threshold above to start flagging students." : "No thresholds configured yet."}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--faint)", marginBottom: 6 }}>Below {defaulterPct ?? "—"}% attendance</div>
            {defaulters.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--muted)" }}>None.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {defaulters.map((d) => (
                  <Link key={d.id} href={`/app/students/${d.id}`} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "inherit", textDecoration: "none" }}>
                    <span>{d.name} <span style={{ color: "var(--muted)" }}>({d.className})</span></span>
                    <span className="mono" style={{ fontWeight: 700, color: "var(--critical)" }}>{d.pct}%</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--faint)", marginBottom: 6 }}>{consecutiveDays ?? "—"}+ consecutive absences</div>
            {consecutiveAbsentees.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--muted)" }}>None.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {consecutiveAbsentees.map((d) => (
                  <Link key={d.id} href={`/app/students/${d.id}`} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "inherit", textDecoration: "none" }}>
                    <span>{d.name} <span style={{ color: "var(--muted)" }}>({d.className})</span></span>
                    <span className="mono" style={{ fontWeight: 700, color: "var(--critical)" }}>{d.streak}d</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
