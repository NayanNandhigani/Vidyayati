"use client";

import { useActionState, useState, useTransition } from "react";
import type { HostelFacilityType } from "@prisma/client";
import { createRoom, updateRoomDetails, addFacility, updateFacilityCondition, removeFacility, type FormState } from "./actions";

const initialState: FormState = {};

export function NewRoomInlineForm() {
  const [state, formAction, pending] = useActionState(createRoom, initialState);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700 }}>Add room</div>
      <label className="field">
        Room number / name
        <input className="in" name="roomNo" required placeholder="Room 204" />
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label className="field">
          Room size
          <input className="in" name="roomSize" placeholder="12ft x 10ft" />
        </label>
        <label className="field">
          Capacity (beds)
          <input className="in mono" type="number" min={1} name="capacity" required placeholder="4" />
        </label>
      </div>
      <label className="field">
        Room type
        <select className="in" name="roomType" defaultValue="">
          <option value="">Not set</option>
          <option value="Dormitory">Dormitory</option>
          <option value="Double">Double</option>
          <option value="Single">Single</option>
        </select>
      </label>
      {state.error && (
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--critical)", background: "var(--critical-tint)", border: "1px solid var(--critical-border)", borderRadius: 8, padding: "8px 11px" }}>
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 0", fontSize: 13, fontWeight: 700, cursor: pending ? "default" : "pointer" }}>
        {pending ? "Adding…" : "Add room"}
      </button>
    </form>
  );
}

export type RoomFacility = { id: string; type: HostelFacilityType; label: string | null; condition: string | null };

export type RoomBed = { bedNo: string; occupantName: string | null };

export function RoomDetailEditor({
  room,
  facilities,
  beds,
}: {
  room: { id: string; roomNo: string; roomSize: string | null; capacity: number; roomType: string | null };
  facilities: RoomFacility[];
  beds: RoomBed[];
}) {
  const [pending, startTransition] = useTransition();
  const [roomNo, setRoomNo] = useState(room.roomNo);
  const [roomSize, setRoomSize] = useState(room.roomSize ?? "");
  const [capacity, setCapacity] = useState(room.capacity.toString());
  const [error, setError] = useState<string | null>(null);
  const [facilityType, setFacilityType] = useState<HostelFacilityType>("TOILET");
  const [facilityLabel, setFacilityLabel] = useState("");

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await updateRoomDetails(room.id, roomNo, roomSize, Number(capacity));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save.");
      }
    });
  }

  function addFac() {
    startTransition(async () => {
      await addFacility(room.id, facilityType, facilityLabel || null);
      setFacilityLabel("");
    });
  }

  const toilets = facilities.filter((f) => f.type === "TOILET");
  const showers = facilities.filter((f) => f.type === "SHOWER");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 11, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Room details</div>
      <label className="field">
        Room number / name
        <input className="in" value={roomNo} onChange={(e) => setRoomNo(e.target.value)} onBlur={save} />
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label className="field">
          Room size
          <input className="in" value={roomSize} onChange={(e) => setRoomSize(e.target.value)} onBlur={save} placeholder="12ft x 10ft" />
        </label>
        <label className="field">
          Capacity (beds)
          <input className="in mono" type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} onBlur={save} />
        </label>
      </div>
      {error && <div style={{ color: "var(--critical)", fontSize: 12 }}>{error}</div>}

      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
        <div style={{ fontSize: 11, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Beds</div>
        {beds.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--muted)" }}>No beds set up.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 6 }}>
            {beds.map((b) => (
              <div
                key={b.bedNo}
                style={{
                  padding: "6px 8px",
                  borderRadius: 6,
                  fontSize: 11,
                  background: b.occupantName ? "var(--teal-tint)" : "var(--good-tint)",
                  color: b.occupantName ? "var(--teal)" : "var(--good)",
                }}
              >
                <div className="mono" style={{ fontWeight: 700 }}>Bed {b.bedNo}</div>
                <div style={{ marginTop: 2, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.occupantName ?? "Available"}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
        <div style={{ fontSize: 11, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Toilets &amp; showers</div>
        <FacilityGroup label="Toilets" items={toilets} pending={pending} />
        <div style={{ height: 10 }} />
        <FacilityGroup label="Showers" items={showers} pending={pending} />
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <select className="in" value={facilityType} onChange={(e) => setFacilityType(e.target.value as HostelFacilityType)} style={{ fontSize: 12, width: "auto" }}>
            <option value="TOILET">Toilet</option>
            <option value="SHOWER">Shower</option>
          </select>
          <input className="in" placeholder="Label (optional)" value={facilityLabel} onChange={(e) => setFacilityLabel(e.target.value)} style={{ fontSize: 12, flex: 1 }} />
          <button type="button" onClick={addFac} disabled={pending} style={{ fontSize: 12, fontWeight: 700, background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 6, padding: "0 12px", cursor: "pointer" }}>
            + Add
          </button>
        </div>
      </div>
    </div>
  );
}

function FacilityGroup({ label, items, pending }: { label: string; items: RoomFacility[]; pending: boolean }) {
  const [, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  if (items.length === 0) return <div style={{ fontSize: 12, color: "var(--muted)" }}>{label}: none added yet.</div>;

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((f, i) => (
          <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ flex: "none", width: 90 }}>{f.label || `${label.slice(0, -1)} ${i + 1}`}</span>
            <input
              className="in"
              placeholder="Condition (e.g. Good)"
              value={drafts[f.id] ?? f.condition ?? ""}
              onChange={(e) => setDrafts({ ...drafts, [f.id]: e.target.value })}
              onBlur={() => startTransition(() => updateFacilityCondition(f.id, drafts[f.id] ?? f.condition ?? ""))}
              style={{ fontSize: 11.5, flex: 1, padding: "4px 6px" }}
            />
            <span onClick={() => startTransition(() => removeFacility(f.id))} style={{ color: "var(--critical)", cursor: pending ? "default" : "pointer", fontWeight: 700 }}>
              ×
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
