"use client";

import { useState, useTransition } from "react";
import { updateRoomTypeAndWarden, upsertMessMenu, addVisitorLog, checkOutVisitor, requestOuting, actOnOuting } from "./hostel-depth-actions";

const ROOM_TYPES = ["Dormitory", "Double", "Single"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MEALS = ["BREAKFAST", "LUNCH", "DINNER"] as const;
const MEAL_LABEL: Record<string, string> = { BREAKFAST: "Breakfast", LUNCH: "Lunch", DINNER: "Dinner" };

export function RoomTypeWardenEditor({
  roomId,
  roomType,
  wardenStaffId,
  staffOptions,
}: {
  roomId: string;
  roomType: string | null;
  wardenStaffId: string | null;
  staffOptions: { id: string; name: string }[];
}) {
  const [, startTransition] = useTransition();
  const [type, setType] = useState(roomType ?? "");
  const [warden, setWarden] = useState(wardenStaffId ?? "");

  function save(nextType: string, nextWarden: string) {
    startTransition(() => updateRoomTypeAndWarden(roomId, nextType || null, nextWarden || null));
  }

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <select
        className="in"
        value={type}
        onChange={(e) => {
          setType(e.target.value);
          save(e.target.value, warden);
        }}
        style={{ fontSize: 12, flex: 1 }}
      >
        <option value="">Room type…</option>
        {ROOM_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <select
        className="in"
        value={warden}
        onChange={(e) => {
          setWarden(e.target.value);
          save(type, e.target.value);
        }}
        style={{ fontSize: 12, flex: 1 }}
      >
        <option value="">No warden</option>
        {staffOptions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function MessMenuEditor({ menus }: { menus: { dayOfWeek: number; mealType: string; menuText: string }[] }) {
  const [, startTransition] = useTransition();
  const [day, setDay] = useState(1);
  const lookup = new Map(menus.map((m) => [`${m.dayOfWeek}-${m.mealType}`, m.menuText]));
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  function valueFor(meal: string) {
    const key = `${day}-${meal}`;
    return drafts[key] ?? lookup.get(key) ?? "";
  }

  function save(meal: (typeof MEALS)[number]) {
    const text = valueFor(meal);
    startTransition(() => upsertMessMenu(day, meal, text));
  }

  return (
    <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700 }}>Weekly mess menu</div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {DAYS.map((d, i) => (
          <span
            key={d}
            onClick={() => setDay(i)}
            className="pill"
            style={{ cursor: "pointer", background: day === i ? "var(--marigold)" : "var(--card)", color: day === i ? "#fff" : "var(--ink2)", border: "1px solid var(--line)" }}
          >
            {d}
          </span>
        ))}
      </div>
      {MEALS.map((meal) => (
        <label key={meal} className="field">
          {MEAL_LABEL[meal]}
          <textarea
            className="in"
            rows={2}
            value={valueFor(meal)}
            onChange={(e) => setDrafts({ ...drafts, [`${day}-${meal}`]: e.target.value })}
            onBlur={() => save(meal)}
            placeholder="e.g. Idli, sambar, coconut chutney"
            style={{ fontSize: 12.5, resize: "vertical" }}
          />
        </label>
      ))}
    </div>
  );
}

export function VisitorLogPanel({ students, logs }: { students: { id: string; name: string }[]; logs: { id: string; studentName: string; visitorName: string; relation: string | null; purpose: string | null; checkInAt: string; checkOutAt: string | null }[] }) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ studentId: "", visitorName: "", relation: "", purpose: "" });

  function submit() {
    if (!form.studentId || !form.visitorName.trim()) return;
    startTransition(async () => {
      await addVisitorLog(form.studentId, form.visitorName, form.relation || null, form.purpose || null);
      setForm({ studentId: "", visitorName: "", relation: "", purpose: "" });
    });
  }

  const active = logs.filter((l) => !l.checkOutAt);

  return (
    <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700 }}>Visitor log</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <select className="in" value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} style={{ fontSize: 12, flex: "1 1 140px" }}>
          <option value="">Resident…</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input className="in" placeholder="Visitor name" value={form.visitorName} onChange={(e) => setForm({ ...form, visitorName: e.target.value })} style={{ fontSize: 12, flex: "1 1 120px" }} />
        <input className="in" placeholder="Relation" value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })} style={{ fontSize: 12, flex: "1 1 90px" }} />
        <input className="in" placeholder="Purpose" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} style={{ fontSize: 12, flex: "1 1 100px" }} />
        <button type="button" disabled={pending} onClick={submit} style={{ fontSize: 12, fontWeight: 700, background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 6, padding: "0 12px" }}>
          Check in
        </button>
      </div>
      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto" }}>
        {logs.length === 0 && <div style={{ color: "var(--muted)", fontSize: 12.5 }}>No visitors logged yet.</div>}
        {logs.map((l) => (
          <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
            <div>
              <b>{l.visitorName}</b> {l.relation && `(${l.relation})`} → {l.studentName}
              <div style={{ fontSize: 10.5, color: "var(--faint)" }}>
                In {new Date(l.checkInAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                {l.checkOutAt && ` · Out ${new Date(l.checkOutAt).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit" })}`}
              </div>
            </div>
            {!l.checkOutAt && (
              <span onClick={() => startTransition(() => checkOutVisitor(l.id))} style={{ fontWeight: 700, color: "var(--marigold-deep)", cursor: "pointer" }}>
                Check out
              </span>
            )}
          </div>
        ))}
      </div>
      {active.length > 0 && (
        <span className="pill" style={{ background: "var(--warn-tint)", color: "var(--warn)", alignSelf: "flex-start" }}>
          {active.length} on premises
        </span>
      )}
    </div>
  );
}

export function OutingRequestsPanel({ requests }: { requests: { id: string; studentName: string; reason: string; dateFrom: string; dateTo: string; status: string }[] }) {
  const [pending, startTransition] = useTransition();
  const STATUS_COLOR: Record<string, string> = { PENDING: "var(--warn)", APPROVED: "var(--good)", REJECTED: "var(--critical)" };

  return (
    <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700 }}>Outing requests</div>
      {requests.length === 0 && <div style={{ color: "var(--muted)", fontSize: 12.5 }}>No outing requests.</div>}
      {requests.map((r) => (
        <div key={r.id} style={{ borderBottom: "1px solid var(--line)", paddingBottom: 8, fontSize: 12.5 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <b>{r.studentName}</b>
            <span className="pill" style={{ background: "transparent", border: `1px solid ${STATUS_COLOR[r.status]}`, color: STATUS_COLOR[r.status] }}>
              {r.status}
            </span>
          </div>
          <div style={{ color: "var(--muted)" }}>{r.reason}</div>
          <div style={{ fontSize: 10.5, color: "var(--faint)" }}>
            {new Date(r.dateFrom).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} – {new Date(r.dateTo).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
          </div>
          {r.status === "PENDING" && (
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <span onClick={() => startTransition(() => actOnOuting(r.id, true))} style={{ fontWeight: 700, color: "var(--good)", cursor: pending ? "default" : "pointer" }}>
                Approve
              </span>
              <span onClick={() => startTransition(() => actOnOuting(r.id, false))} style={{ fontWeight: 700, color: "var(--critical)", cursor: pending ? "default" : "pointer" }}>
                Reject
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function ParentOutingRequestForm({ studentId }: { studentId: string }) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ reason: "", dateFrom: "", dateTo: "" });
  const [msg, setMsg] = useState<string | null>(null);

  function submit() {
    if (!form.reason.trim() || !form.dateFrom || !form.dateTo) return;
    setMsg(null);
    startTransition(async () => {
      try {
        await requestOuting(studentId, form.reason, form.dateFrom, form.dateTo);
        setForm({ reason: "", dateFrom: "", dateTo: "" });
        setMsg("Outing request submitted.");
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Could not submit.");
      }
    });
  }

  return (
    <div style={{ marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Request an outing</div>
      <input className="in" placeholder="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} style={{ fontSize: 12 }} />
      <div style={{ display: "flex", gap: 6 }}>
        <input className="in mono" type="date" value={form.dateFrom} onChange={(e) => setForm({ ...form, dateFrom: e.target.value })} style={{ fontSize: 12, flex: 1 }} />
        <input className="in mono" type="date" value={form.dateTo} onChange={(e) => setForm({ ...form, dateTo: e.target.value })} style={{ fontSize: 12, flex: 1 }} />
        <button type="button" disabled={pending} onClick={submit} style={{ fontSize: 12, fontWeight: 700, background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 6, padding: "0 12px" }}>
          Submit
        </button>
      </div>
      {msg && <div style={{ fontSize: 11.5, color: msg.includes("submitted") ? "var(--good)" : "var(--critical)" }}>{msg}</div>}
    </div>
  );
}
