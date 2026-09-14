"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { addReminder, removeReminder, addNote, removeNote } from "./actions";

function BlockHead({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700 }}>{title}</div>
      {action}
    </div>
  );
}

// ------------------------------------------------------------------ Reminders

type Reminder = { id: string; title: string; content: string; remindAt: string | null; createdAt: string };

function reminderBadge(remindAt: string | null): { label: string; bg: string; fg: string } {
  if (!remindAt) return { label: "No date", bg: "var(--line)", fg: "var(--muted)" };
  const today = new Date(new Date().toDateString());
  const d = new Date(new Date(remindAt).toDateString());
  const days = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, bg: "var(--critical-tint)", fg: "var(--critical)" };
  if (days === 0) return { label: "Today", bg: "var(--marigold-tint)", fg: "var(--marigold-deep)" };
  if (days === 1) return { label: "Tomorrow", bg: "var(--warn-tint)", fg: "var(--warn)" };
  return { label: `In ${days}d`, bg: "var(--info-tint)", fg: "var(--info)" };
}

export function RemindersPanel({ reminders }: { reminders: Reminder[] }) {
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [remindAt, setRemindAt] = useState(new Date().toISOString().slice(0, 10));

  function add() {
    if (!title.trim() || !remindAt) return;
    startTransition(async () => {
      await addReminder(title, content, remindAt);
      setTitle("");
      setContent("");
      setAdding(false);
    });
  }

  return (
    <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <BlockHead
        title="Reminders"
        action={
          <span onClick={() => setAdding((v) => !v)} style={{ fontSize: 11.5, fontWeight: 700, color: "var(--marigold-deep)", cursor: "pointer" }}>
            {adding ? "Cancel" : "+ Schedule"}
          </span>
        }
      />

      {adding && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12, background: "var(--paper)", padding: 10, borderRadius: 8 }}>
          <input className="in" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" style={{ fontSize: 12 }} />
          <textarea className="in" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Details (optional)" rows={2} style={{ fontSize: 12 }} />
          <input className="in mono" type="date" value={remindAt} onChange={(e) => setRemindAt(e.target.value)} style={{ fontSize: 12 }} />
          <button type="button" onClick={add} disabled={pending} style={{ fontSize: 11.5, fontWeight: 700, background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 6, padding: "6px 0", cursor: pending ? "default" : "pointer" }}>
            Save reminder
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", flex: 1, minHeight: 0 }}>
        {reminders.length === 0 && !adding && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Nothing scheduled. Use "+ Schedule" to add one.</div>}
        {reminders.map((r) => {
          const badge = reminderBadge(r.remindAt);
          return (
            <div key={r.id} style={{ background: "var(--paper)", borderRadius: 7, padding: "9px 10px", position: "relative" }}>
              <span onClick={() => startTransition(() => removeReminder(r.id))} style={{ position: "absolute", top: 6, right: 8, fontSize: 12, color: "var(--muted)", cursor: "pointer" }}>
                ×
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingRight: 14 }}>
                <span className="pill" style={{ background: badge.bg, color: badge.fg, fontSize: 10 }}>
                  {badge.label}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>{r.title}</span>
              </div>
              {r.content && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{r.content}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------ Staff availability

type StaffStatus = { id: string; name: string; status: "PRESENT" | "ABSENT" | "HALF_DAY" | null };

export function StaffAvailabilityTile({ label, staff, color }: { label: string; staff: StaffStatus[]; color?: string }) {
  const [open, setOpen] = useState(false);
  const present = staff.filter((s) => s.status === "PRESENT").length;
  const total = staff.length;

  return (
    <>
      <div className="card" onClick={() => setOpen(true)} style={{ padding: "15px 17px", cursor: "pointer" }}>
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 7 }}>{label}</div>
        <div className="mono" style={{ fontSize: 23, fontWeight: 600, color: color ?? "var(--teal)" }}>
          {present}
          <span style={{ fontSize: 13, color: "var(--faint)", fontWeight: 500 }}> / {total}</span>
        </div>
      </div>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: 420, maxHeight: "70vh", padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 14.5, fontWeight: 700 }}>{label}</div>
              <span onClick={() => setOpen(false)} style={{ cursor: "pointer", fontSize: 16, color: "var(--muted)" }}>
                ×
              </span>
            </div>
            <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
              {staff.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>No staff in this category yet.</div>}
              {staff.map((s) => {
                const style =
                  s.status === "PRESENT"
                    ? { bg: "var(--good-tint)", fg: "var(--good)", label: "Present" }
                    : s.status === "ABSENT"
                      ? { bg: "var(--critical-tint)", fg: "var(--critical)", label: "Absent" }
                      : s.status === "HALF_DAY"
                        ? { bg: "var(--warn-tint)", fg: "var(--warn)", label: "Half day" }
                        : { bg: "var(--line)", fg: "var(--muted)", label: "Not marked" };
                return (
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", background: "var(--paper)", borderRadius: 7, fontSize: 12.5 }}>
                    <span>{s.name}</span>
                    <span className="pill" style={{ background: style.bg, color: style.fg }}>
                      {style.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------- Pending approvals

type ApprovalItem = { label: string; count: number; href: string };

export function PendingApprovalsPanel({ items }: { items: ApprovalItem[] }) {
  const total = items.reduce((s, i) => s + i.count, 0);

  return (
    <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <BlockHead
        title="Pending approvals"
        action={
          total > 0 ? (
            <span className="pill" style={{ background: "var(--warn-tint)", color: "var(--warn)" }}>
              {total} pending
            </span>
          ) : (
            <span className="pill" style={{ background: "var(--good-tint)", color: "var(--good)" }}>
              All caught up
            </span>
          )
        }
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", flex: 1, minHeight: 0 }}>
        {total === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Nothing needs your approval right now.</div>}
        {items
          .filter((i) => i.count > 0)
          .map((i) => (
            <Link key={i.label} href={i.href} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--ink)", textDecoration: "none", padding: "8px 9px", background: "var(--paper)", borderRadius: 7 }}>
              <span>{i.label}</span>
              <span className="mono" style={{ fontWeight: 700, color: "var(--marigold-deep)" }}>
                {i.count} →
              </span>
            </Link>
          ))}
      </div>
    </div>
  );
}

// -------------------------------------------------------------------- Notes

type Note = { id: string; content: string; createdAt: string };

export function NotesPanel({ notes }: { notes: Note[] }) {
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");

  function add() {
    if (!draft.trim()) return;
    startTransition(async () => {
      await addNote(draft);
      setDraft("");
    });
  }

  return (
    <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <BlockHead title="Notes" />
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <input
          className="in"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          placeholder="Jot something down…"
          style={{ fontSize: 12.5 }}
        />
        <button type="button" onClick={add} disabled={pending} style={{ fontSize: 12, fontWeight: 700, background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 6, padding: "0 14px", cursor: pending ? "default" : "pointer" }}>
          Add
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", flex: 1, minHeight: 0 }}>
        {notes.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>No notes yet.</div>}
        {notes.map((n) => (
          <div key={n.id} style={{ background: "var(--paper)", borderRadius: 7, padding: "9px 10px", position: "relative" }}>
            <span onClick={() => startTransition(() => removeNote(n.id))} style={{ position: "absolute", top: 6, right: 8, fontSize: 12, color: "var(--muted)", cursor: "pointer" }}>
              ×
            </span>
            <div style={{ fontSize: 12.5, color: "var(--ink2)", paddingRight: 14, whiteSpace: "pre-wrap" }}>{n.content}</div>
            <div className="mono" style={{ fontSize: 9.5, color: "var(--faint)", marginTop: 4 }}>
              {new Date(n.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
