"use client";

import { useState, useTransition } from "react";
import type { HostelLogType, HostelLogStatus } from "@prisma/client";
import { addMaintenanceLog, updateMaintenanceStatus, deleteMaintenanceLog } from "./maintenance-actions";

const TYPE_LABEL: Record<HostelLogType, string> = { LAUNDRY: "Laundry", MAINTENANCE: "Maintenance" };
const STATUS_STYLE: Record<HostelLogStatus, { bg: string; fg: string; label: string }> = {
  PENDING: { bg: "var(--warn-tint)", fg: "var(--warn)", label: "Pending" },
  IN_PROGRESS: { bg: "var(--info-tint, var(--marigold-tint))", fg: "var(--info, var(--marigold-deep))", label: "In progress" },
  DONE: { bg: "var(--good-tint)", fg: "var(--good)", label: "Done" },
};
const STATUSES: HostelLogStatus[] = ["PENDING", "IN_PROGRESS", "DONE"];

export type MaintenanceTarget = { key: string; label: string; roomId?: string; facilityId?: string };
export type MaintenanceLogRow = {
  id: string;
  type: HostelLogType;
  date: string;
  description: string;
  status: HostelLogStatus;
  targetLabel: string;
};

export function MaintenancePanel({ targets, logs }: { targets: MaintenanceTarget[]; logs: MaintenanceLogRow[] }) {
  const [pending, startTransition] = useTransition();
  const [targetKey, setTargetKey] = useState(targets[0]?.key ?? "");
  const [type, setType] = useState<HostelLogType>("MAINTENANCE");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const target = targets.find((t) => t.key === targetKey);
    if (!target) {
      setError("Pick a room or facility.");
      return;
    }
    if (!description.trim()) {
      setError("Describe the work.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await addMaintenanceLog({ roomId: target.roomId, facilityId: target.facilityId }, type, date, description);
        setDescription("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not log.");
      }
    });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 16, flex: 1, minHeight: 0 }}>
      <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1.3fr 1.6fr 0.9fr 1fr", padding: "13px 20px", borderBottom: "1px solid var(--line)", fontSize: 10.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          <div>Type</div>
          <div>Target</div>
          <div>Description</div>
          <div>Date</div>
          <div>Status</div>
        </div>
        <div style={{ overflowY: "auto" }}>
          {logs.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>No laundry or maintenance logged yet.</div>}
          {logs.map((l) => {
            const style = STATUS_STYLE[l.status];
            return (
              <div key={l.id} style={{ display: "grid", gridTemplateColumns: "0.8fr 1.3fr 1.6fr 0.9fr 1fr", alignItems: "center", padding: "11px 20px", borderBottom: "1px solid var(--line)", fontSize: 12.5 }}>
                <div>
                  <span className="pill" style={{ background: "var(--paper)", border: "1px solid var(--line)", fontSize: 10.5 }}>
                    {TYPE_LABEL[l.type]}
                  </span>
                </div>
                <div style={{ fontWeight: 600 }}>{l.targetLabel}</div>
                <div style={{ color: "var(--muted)" }}>{l.description}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>{new Date(l.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <select
                    value={l.status}
                    onChange={(e) => startTransition(() => updateMaintenanceStatus(l.id, e.target.value as HostelLogStatus))}
                    style={{ fontSize: 11, fontWeight: 700, background: style.bg, color: style.fg, border: "none", borderRadius: 20, padding: "4px 8px" }}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_STYLE[s].label}
                      </option>
                    ))}
                  </select>
                  <span onClick={() => startTransition(() => deleteMaintenanceLog(l.id))} style={{ color: "var(--critical)", cursor: "pointer", fontWeight: 700 }}>
                    ×
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>Log laundry / maintenance</div>
        <label className="field">
          Room / facility
          <select className="in" value={targetKey} onChange={(e) => setTargetKey(e.target.value)}>
            {targets.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label className="field">
            Type
            <select className="in" value={type} onChange={(e) => setType(e.target.value as HostelLogType)}>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="LAUNDRY">Laundry</option>
            </select>
          </label>
          <label className="field">
            Date
            <input className="in mono" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <label className="field">
          Description
          <textarea className="in" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What needs doing / was done" />
        </label>
        {error && <div style={{ color: "var(--critical)", fontSize: 12 }}>{error}</div>}
        <button type="button" onClick={submit} disabled={pending || targets.length === 0} style={{ fontSize: 13, fontWeight: 700, background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 0", cursor: pending ? "default" : "pointer" }}>
          {pending ? "Logging…" : "Log entry"}
        </button>
      </div>
    </div>
  );
}
