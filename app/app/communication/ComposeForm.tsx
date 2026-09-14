"use client";

import { useActionState, useEffect, useState } from "react";
import { studentName } from "@/lib/format";
import { publishAnnouncement, type AnnouncementFormState } from "./actions";

const AUDIENCES = [
  { key: "ALL_PARENTS", label: "All Parents" },
  { key: "ALL_STAFF", label: "All Staff" },
  { key: "SPECIFIC_CLASS", label: "Specific Class" },
  { key: "SPECIFIC_STUDENT", label: "Specific Student" },
] as const;

const initialState: AnnouncementFormState = {};

export default function ComposeForm({ classes, students }: { classes: { id: string; grade: string; section: string }[]; students: { id: string; firstName: string; surname: string }[] }) {
  const [audience, setAudience] = useState<(typeof AUDIENCES)[number]["key"]>("ALL_PARENTS");
  const [scheduled, setScheduled] = useState(false);
  const [state, formAction, pending] = useActionState(publishAnnouncement, initialState);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (state.success) {
      setKey((k) => k + 1);
      setAudience("ALL_PARENTS");
      setScheduled(false);
    }
  }, [state.success]);

  return (
    <form key={key} action={formAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontSize: 14.5, fontWeight: 700 }}>New announcement</div>

      <div>
        <div style={fieldLabel}>Title</div>
        <input className="in" name="title" placeholder="Parent-Teacher Meeting — 28 Aug" required />
      </div>

      <div>
        <div style={fieldLabel}>Audience</div>
        <input type="hidden" name="audienceType" value={audience} />
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {AUDIENCES.map((a) => (
            <span
              key={a.key}
              onClick={() => setAudience(a.key)}
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "6px 13px",
                borderRadius: 100,
                border: `1px solid ${audience === a.key ? "var(--marigold)" : "var(--line)"}`,
                background: audience === a.key ? "var(--marigold)" : "transparent",
                color: audience === a.key ? "#fff" : "var(--muted)",
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              {a.label}
            </span>
          ))}
        </div>
        {audience === "SPECIFIC_CLASS" && (
          <select className="in" name="audienceTarget" required style={{ marginTop: 9 }}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                Class {c.grade}-{c.section}
              </option>
            ))}
          </select>
        )}
        {audience === "SPECIFIC_STUDENT" && (
          <select className="in" name="audienceTarget" required style={{ marginTop: 9 }}>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {studentName(s)}
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <div style={fieldLabel}>Message</div>
        <textarea className="in" name="body" rows={5} required placeholder="Dear Parents, ..." style={{ lineHeight: 1.6 }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>Schedule for later</span>
          <div
            onClick={() => setScheduled((v) => !v)}
            style={{ width: 34, height: 18, borderRadius: 100, background: scheduled ? "var(--marigold)" : "var(--line)", position: "relative", cursor: "pointer", transition: "background .15s ease" }}
          >
            <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: scheduled ? 18 : 2, transition: "left .15s ease", boxShadow: "0 1px 2px rgba(23,34,59,.25)" }} />
          </div>
        </div>
        {scheduled && <input className="in mono" name="scheduleDate" type="datetime-local" style={{ fontSize: 12 }} />}
      </div>

      {state.error && (
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--critical)", background: "var(--critical-tint)", border: "1px solid var(--critical-border)", borderRadius: 8, padding: "8px 11px" }}>
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: 10, fontSize: 13, fontWeight: 700, cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1 }}
      >
        {pending ? "Submitting…" : "Submit for approval"}
      </button>
    </form>
  );
}

const fieldLabel: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 7 };
