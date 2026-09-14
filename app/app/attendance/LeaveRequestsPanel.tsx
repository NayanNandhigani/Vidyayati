"use client";

import { useState, useTransition } from "react";
import { classTeacherActOnLeave, adminActOnLeave } from "./depth-actions";

type Req = {
  id: string;
  studentName: string;
  className: string;
  dateFrom: string;
  dateTo: string;
  reason: string;
  stage: "PENDING" | "CLASS_TEACHER_APPROVED" | "ADMIN_APPROVED" | "REJECTED";
  rejectionNote: string | null;
};

const STAGE_STYLE: Record<Req["stage"], { bg: string; fg: string; label: string }> = {
  PENDING: { bg: "var(--warn-tint)", fg: "var(--warn)", label: "Awaiting class teacher" },
  CLASS_TEACHER_APPROVED: { bg: "var(--info-tint)", fg: "var(--info)", label: "Awaiting admin" },
  ADMIN_APPROVED: { bg: "var(--good-tint)", fg: "var(--good)", label: "Approved" },
  REJECTED: { bg: "var(--critical-tint)", fg: "var(--critical)", label: "Rejected" },
};

export default function LeaveRequestsPanel({ requests, isAdmin, canActAsClassTeacher }: { requests: Req[]; isAdmin: boolean; canActAsClassTeacher: boolean }) {
  const [, startTransition] = useTransition();
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");

  function actClassTeacher(id: string, approve: boolean) {
    startTransition(async () => {
      await classTeacherActOnLeave(id, approve, approve ? undefined : note);
      setNoteFor(null);
      setNote("");
    });
  }
  function actAdmin(id: string, approve: boolean) {
    startTransition(async () => {
      await adminActOnLeave(id, approve, approve ? undefined : note);
      setNoteFor(null);
      setNote("");
    });
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 10 }}>
        Student leave requests
      </div>
      {requests.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--muted)" }}>No leave requests.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {requests.map((r) => {
            const style = STAGE_STYLE[r.stage];
            const canClassTeacherAct = canActAsClassTeacher && r.stage === "PENDING";
            const canAdminAct = isAdmin && r.stage === "CLASS_TEACHER_APPROVED";
            return (
              <div key={r.id} style={{ padding: "10px 12px", background: "var(--paper)", borderRadius: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{r.studentName}</span>{" "}
                    <span style={{ fontSize: 11.5, color: "var(--muted)" }}>({r.className})</span>
                  </div>
                  <span className="pill" style={{ background: style.bg, color: style.fg, fontSize: 10.5 }}>
                    {style.label}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
                  {fmt(r.dateFrom)} – {fmt(r.dateTo)} · {r.reason}
                </div>
                {r.rejectionNote && <div style={{ fontSize: 11.5, color: "var(--critical)", marginTop: 3 }}>{r.rejectionNote}</div>}
                {(canClassTeacherAct || canAdminAct) && (
                  <div style={{ marginTop: 8 }}>
                    {noteFor === r.id ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        <input className="in" placeholder="Reason for rejection" value={note} onChange={(e) => setNote(e.target.value)} style={{ fontSize: 11.5, flex: 1 }} />
                        <span
                          onClick={() => (canClassTeacherAct ? actClassTeacher(r.id, false) : actAdmin(r.id, false))}
                          style={{ fontSize: 11.5, fontWeight: 700, color: "var(--critical)", cursor: "pointer", alignSelf: "center" }}
                        >
                          Confirm reject
                        </span>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 12 }}>
                        <span
                          onClick={() => (canClassTeacherAct ? actClassTeacher(r.id, true) : actAdmin(r.id, true))}
                          style={{ fontSize: 11.5, fontWeight: 700, color: "var(--good)", cursor: "pointer" }}
                        >
                          Approve
                        </span>
                        <span onClick={() => setNoteFor(r.id)} style={{ fontSize: 11.5, fontWeight: 700, color: "var(--critical)", cursor: "pointer" }}>
                          Reject
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
