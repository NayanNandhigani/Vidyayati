"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { studentName } from "@/lib/format";
import { markTransportEvent, unmarkTransportEvent } from "./attendance-actions";

export type AttendanceStudent = {
  id: string;
  firstName: string;
  surname: string;
  className: string;
  pickupAt: string | null;
  dropAt: string | null;
};

export function AttendanceRosterPanel({ routeId, date, students, canEdit }: { routeId: string; date: string; students: AttendanceStudent[]; canEdit: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggle(studentId: string, event: "pickup" | "drop", currentlyMarked: boolean) {
    startTransition(async () => {
      if (currentlyMarked) {
        await unmarkTransportEvent(studentId, date, event);
      } else {
        await markTransportEvent(studentId, routeId, date, event);
      }
      router.refresh();
    });
  }

  return (
    <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr 1fr", padding: "13px 20px", borderBottom: "1px solid var(--line)", fontSize: 10.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        <div>Student</div>
        <div>Pickup</div>
        <div>Drop</div>
      </div>
      <div style={{ overflowY: "auto" }}>
        {students.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>No students assigned to this route.</div>}
        {students.map((s) => (
          <div key={s.id} style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr 1fr", alignItems: "center", padding: "11px 20px", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
            <div>
              <div style={{ fontWeight: 600 }}>{studentName(s)}</div>
              <div style={{ fontSize: 10.5, color: "var(--faint)" }}>Class {s.className}</div>
            </div>
            <EventCell label="Picked up" time={s.pickupAt} canEdit={canEdit} pending={pending} onToggle={() => toggle(s.id, "pickup", !!s.pickupAt)} />
            <EventCell label="Dropped off" time={s.dropAt} canEdit={canEdit} pending={pending} onToggle={() => toggle(s.id, "drop", !!s.dropAt)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function EventCell({ label, time, canEdit, pending, onToggle }: { label: string; time: string | null; canEdit: boolean; pending: boolean; onToggle: () => void }) {
  const marked = !!time;
  return (
    <div>
      <button
        type="button"
        disabled={!canEdit || pending}
        onClick={onToggle}
        className="pill"
        style={{
          border: "none",
          cursor: canEdit ? (pending ? "default" : "pointer") : "default",
          background: marked ? "var(--good-tint)" : "var(--line)",
          color: marked ? "var(--good)" : "var(--faint)",
          fontWeight: 700,
        }}
      >
        {marked ? `${label} ✓` : `Mark ${label.toLowerCase()}`}
      </button>
      {marked && (
        <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 3 }}>
          {new Date(time!).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
        </div>
      )}
    </div>
  );
}
