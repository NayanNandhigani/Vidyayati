"use client";

import { useState } from "react";

const ACTION_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  CREATE: { bg: "var(--good-tint)", fg: "var(--good)", label: "Created" },
  UPDATE: { bg: "var(--info-tint)", fg: "var(--info)", label: "Updated" },
  DELETE: { bg: "var(--critical-tint)", fg: "var(--critical)", label: "Deleted" },
};

export type AuditLogRow = {
  id: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  entityType: string;
  entityId: string;
  changes: unknown;
  occurredAt: string;
  actorName: string | null;
  schoolName?: string | null;
};

const ENTITY_LABEL: Record<string, string> = {
  Mark: "Mark",
  Student: "Student",
  FeePayment: "Fee Payment",
  AccountsTransaction: "Accounts Transaction",
  StaffPermission: "Staff Permission",
  PayrollRun: "Payroll Run",
  Attendance: "Attendance",
  HostelAllocation: "Hostel Allocation",
};

export default function AuditLogTable({ rows, showSchool }: { rows: AuditLogRow[]; showSchool?: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (rows.length === 0) {
    return <div style={{ padding: "24px 0", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No mutations recorded for this filter yet.</div>;
  }

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: showSchool ? "1fr 1.3fr 1fr 1.4fr 1.3fr" : "1fr 1.3fr 1.6fr 1.3fr",
          fontSize: 11,
          color: "var(--faint)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          paddingBottom: 10,
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div>Action</div>
        <div>Entity</div>
        {showSchool && <div>School</div>}
        <div>Actor</div>
        <div>When</div>
      </div>

      {rows.map((r) => {
        const style = ACTION_STYLE[r.action];
        const isOpen = expanded === r.id;
        return (
          <div key={r.id} style={{ borderBottom: "1px solid var(--line)" }}>
            <div
              onClick={() => setExpanded(isOpen ? null : r.id)}
              style={{
                display: "grid",
                gridTemplateColumns: showSchool ? "1fr 1.3fr 1fr 1.4fr 1.3fr" : "1fr 1.3fr 1.6fr 1.3fr",
                alignItems: "center",
                padding: "11px 0",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              <div>
                <span className="pill" style={{ background: style.bg, color: style.fg }}>
                  {style.label}
                </span>
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>{ENTITY_LABEL[r.entityType] ?? r.entityType}</div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--faint)" }}>
                  {r.entityId}
                </div>
              </div>
              {showSchool && <div style={{ color: "var(--muted)" }}>{r.schoolName ?? "—"}</div>}
              <div style={{ color: "var(--muted)" }}>{r.actorName ?? "System"}</div>
              <div className="mono" style={{ color: "var(--muted)", fontSize: 12 }}>
                {new Date(r.occurredAt).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>

            {isOpen && (
              <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, padding: "12px 14px", marginBottom: 12 }}>
                <ChangesDetail action={r.action} changes={r.changes} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ChangesDetail({ action, changes }: { action: string; changes: unknown }) {
  if (action === "CREATE" || !changes) {
    return <div style={{ fontSize: 12.5, color: "var(--muted)" }}>New record created — no prior state to compare.</div>;
  }

  if (action === "DELETE" && typeof changes === "object" && changes !== null && "deleted" in changes) {
    const deleted = (changes as { deleted: Record<string, unknown> }).deleted;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Deleted record</div>
        {Object.entries(deleted)
          .filter(([k]) => !["schoolId"].includes(k))
          .map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, gap: 12 }}>
              <span style={{ color: "var(--muted)" }}>{k}</span>
              <span className="mono" style={{ textAlign: "right" }}>
                {String(v)}
              </span>
            </div>
          ))}
      </div>
    );
  }

  const fields = changes as Record<string, { before: string; after: string }>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {Object.entries(fields).map(([field, { before, after }]) => (
        <div key={field} style={{ fontSize: 12.5 }}>
          <div style={{ color: "var(--muted)", marginBottom: 2, fontWeight: 600 }}>{field}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="mono pill" style={{ background: "var(--critical-tint)", color: "var(--critical)" }}>
              {before}
            </span>
            <span style={{ color: "var(--faint)" }}>→</span>
            <span className="mono pill" style={{ background: "var(--good-tint)", color: "var(--good)" }}>
              {after}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
