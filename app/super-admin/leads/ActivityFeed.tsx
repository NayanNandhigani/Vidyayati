"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { addActivity, completeActivity, type FormState } from "./actions";

export type Activity = {
  id: string;
  type: "CALL" | "MEETING" | "EMAIL" | "TASK";
  notes: string;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

const TYPE_LABEL: Record<string, string> = { CALL: "Call", MEETING: "Meeting", EMAIL: "Email", TASK: "Task" };

const initialState: FormState = {};

export default function ActivityFeed({ leadId, activities, canEdit }: { leadId: string; activities: Activity[]; canEdit: boolean }) {
  const [state, formAction, pending] = useActionState(addActivity, initialState);
  const [completePending, startComplete] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  function complete(activityId: string) {
    startComplete(async () => {
      await completeActivity(activityId, leadId);
    });
  }

  const now = Date.now();

  return (
    <div>
      {activities.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12 }}>No activity logged yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {activities.map((a) => {
            const isOverdue = !a.completedAt && a.dueAt && new Date(a.dueAt).getTime() < now;
            return (
              <div
                key={a.id}
                style={{
                  background: a.completedAt ? "var(--paper)" : isOverdue ? "var(--critical-tint)" : "var(--paper)",
                  border: `1px solid ${isOverdue && !a.completedAt ? "var(--critical-border)" : "var(--line)"}`,
                  borderRadius: 8,
                  padding: "10px 12px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 10,
                  opacity: a.completedAt ? 0.65 : 1,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span className="pill" style={{ background: "var(--card)", border: "1px solid var(--line)", fontSize: 10.5 }}>
                      {TYPE_LABEL[a.type]}
                    </span>
                    {a.completedAt && (
                      <span className="pill" style={{ background: "var(--good-tint)", color: "var(--good)", fontSize: 10.5 }}>
                        Done
                      </span>
                    )}
                    {isOverdue && !a.completedAt && (
                      <span className="pill" style={{ background: "var(--critical)", color: "#fff", fontSize: 10.5 }}>
                        Overdue
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--ink)" }}>{a.notes}</div>
                  {a.dueAt && (
                    <div className="mono" style={{ fontSize: 10.5, color: isOverdue && !a.completedAt ? "var(--critical)" : "var(--faint)", marginTop: 3 }}>
                      Due {new Date(a.dueAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </div>
                  )}
                </div>
                {canEdit && !a.completedAt && (
                  <button
                    onClick={() => complete(a.id)}
                    disabled={completePending}
                    style={{ flex: "none", background: "var(--good-tint)", color: "var(--good)", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: completePending ? "default" : "pointer" }}
                  >
                    Mark done
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canEdit && (
        <form ref={formRef} action={formAction} style={{ display: "flex", flexDirection: "column", gap: 8, background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, padding: 12 }}>
          <input type="hidden" name="leadId" value={leadId} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <select className="in" name="type" defaultValue="CALL" style={{ fontSize: 12.5 }}>
              <option value="CALL">Call</option>
              <option value="MEETING">Meeting</option>
              <option value="EMAIL">Email</option>
              <option value="TASK">Task</option>
            </select>
            <input className="in mono" type="date" name="dueAt" style={{ fontSize: 12.5 }} />
          </div>
          <textarea className="in" name="notes" required rows={2} placeholder="e.g. Called to discuss pricing, follow up next week" style={{ resize: "vertical", fontFamily: "inherit" }} />
          {state.error && <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--critical)" }}>{state.error}</div>}
          <button type="submit" disabled={pending} style={{ alignSelf: "flex-start", background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: pending ? "default" : "pointer" }}>
            {pending ? "Adding…" : "Log activity"}
          </button>
        </form>
      )}
    </div>
  );
}
