"use client";

import { useState } from "react";
import { formatINR } from "@/lib/format";

function PeriodToggle<T extends string>({ options, value, onChange }: { options: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div style={{ display: "flex", gap: 4, background: "var(--paper)", borderRadius: 7, padding: 3 }}>
      {options.map((o) => (
        <span
          key={o.key}
          onClick={() => onChange(o.key)}
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "4px 10px",
            borderRadius: 5,
            cursor: "pointer",
            color: value === o.key ? "#fff" : "var(--muted)",
            background: value === o.key ? "var(--marigold)" : "transparent",
          }}
        >
          {o.label}
        </span>
      ))}
    </div>
  );
}

// ------------------------------------------------------ Attendance by class

type ClassCount = { label: string; count: number };
type AttendancePeriod = "day" | "week" | "month";

export function AttendanceByClassChart({ data }: { data: Record<AttendancePeriod, ClassCount[]> }) {
  const [period, setPeriod] = useState<AttendancePeriod>("day");
  const rows = data[period];
  const max = Math.max(1, ...rows.map((d) => d.count));

  return (
    <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>Attendance by class</div>
        <PeriodToggle
          value={period}
          onChange={setPeriod}
          options={[
            { key: "day", label: "Day" },
            { key: "week", label: "Week" },
            { key: "month", label: "Month" },
          ]}
        />
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>Days present, per class · {period === "day" ? "today" : period === "week" ? "last 7 days" : "this month"}</div>
      {rows.length === 0 ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 12.5 }}>No attendance marked yet for this period.</div>
      ) : (
        <>
          <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 6, borderBottom: "1px solid var(--line)", paddingBottom: 2, minHeight: 140 }}>
            {rows.map((d) => (
              <div key={d.label} style={{ flex: 1, height: `${Math.max(3, (d.count / max) * 100)}%`, background: "var(--teal-tint)", borderRadius: "3px 3px 0 0", position: "relative" }}>
                <span className="mono" style={{ position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)", fontSize: 9.5, color: "var(--faint)" }}>
                  {d.count}
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 6, fontSize: 9.5, color: "var(--faint)" }}>
            {rows.map((d) => (
              <span key={d.label} style={{ flex: 1, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {d.label}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------- Results by class

type ClassPct = { label: string; pct: number | null };

export function ResultsByClassChart({ subjects, data }: { subjects: string[]; data: Record<string, ClassPct[]> }) {
  const [subject, setSubject] = useState<string>("All subjects");
  const rows = (data[subject] ?? []).filter((d): d is { label: string; pct: number } => d.pct !== null);

  return (
    <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>Exam results by class</div>
        <select className="in" value={subject} onChange={(e) => setSubject(e.target.value)} style={{ fontSize: 11.5, width: "auto", padding: "4px 8px" }}>
          <option value="All subjects">All subjects</option>
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>Average % scored, this year</div>
      {rows.length === 0 ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 12.5 }}>No completed, approved exam results for this subject yet.</div>
      ) : (
        <>
          <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 6, borderBottom: "1px solid var(--line)", paddingBottom: 2, minHeight: 140 }}>
            {rows.map((d) => (
              <div key={d.label} style={{ flex: 1, height: `${Math.max(3, d.pct)}%`, background: d.pct < 40 ? "var(--critical)" : "var(--info-tint)", borderRadius: "3px 3px 0 0", position: "relative" }}>
                <span className="mono" style={{ position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)", fontSize: 9.5, color: "var(--faint)" }}>
                  {d.pct}%
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 6, fontSize: 9.5, color: "var(--faint)" }}>
            {rows.map((d) => (
              <span key={d.label} style={{ flex: 1, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {d.label}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// -------------------------------------------------------------- Cash flow

type FlowBucket = { label: string; income: number; expense: number };
type FlowPeriod = "day" | "week" | "month" | "year";

export function CashFlowChart({ data }: { data: Record<FlowPeriod, FlowBucket[]> }) {
  const [period, setPeriod] = useState<FlowPeriod>("month");
  const rows = data[period];
  const max = Math.max(1, ...rows.flatMap((d) => [d.income, d.expense]));
  const last = rows[rows.length - 1];
  const net = last ? last.income - last.expense : 0;

  return (
    <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>Accounts — money flow</div>
        <PeriodToggle
          value={period}
          onChange={setPeriod}
          options={[
            { key: "day", label: "Day" },
            { key: "week", label: "Week" },
            { key: "month", label: "Month" },
            { key: "year", label: "Year" },
          ]}
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 14, fontSize: 11.5, color: "var(--muted)" }}>
          <span>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "var(--teal)", marginRight: 5 }} />
            Income
          </span>
          <span>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "var(--clay)", marginRight: 5 }} />
            Expense
          </span>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
          Net, last {period}:{" "}
          <span className="mono" style={{ fontWeight: 700, color: net >= 0 ? "var(--good)" : "var(--critical)" }}>
            {net >= 0 ? "+" : ""}
            {formatINR(net)}
          </span>
        </div>
      </div>
      {rows.length === 0 ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 12.5 }}>No transactions in this range yet.</div>
      ) : (
        <>
          <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: rows.length > 10 ? 6 : 16, borderBottom: "1px solid var(--line)", paddingBottom: 2, minHeight: 140 }}>
            {rows.map((m) => (
              <div key={m.label} style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 3, height: "100%" }}>
                <div style={{ flex: 1, height: `${Math.max(2, (m.income / max) * 100)}%`, background: "var(--teal)", borderRadius: "3px 3px 0 0" }} />
                <div style={{ flex: 1, height: `${Math.max(2, (m.expense / max) * 100)}%`, background: "var(--clay)", borderRadius: "3px 3px 0 0" }} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", marginTop: 8, fontSize: rows.length > 10 ? 8.5 : 10.5, color: "var(--faint)" }}>
            {rows.map((m) => (
              <span key={m.label} style={{ flex: 1, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {m.label}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
