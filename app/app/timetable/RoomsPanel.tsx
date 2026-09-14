"use client";

import { useState, useTransition } from "react";
import { createRoom, deleteRoom } from "./depth-actions";

type Room = { id: string; name: string; capacity: number | null; equipmentNote: string | null };

export default function RoomsPanel({ rooms }: { rooms: Room[] }) {
  const [, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("");
  const [note, setNote] = useState("");
  const [showForm, setShowForm] = useState(false);

  function add() {
    if (!name.trim()) return;
    startTransition(async () => {
      await createRoom(name, capacity ? Number(capacity) : null, note);
      setName("");
      setCapacity("");
      setNote("");
      setShowForm(false);
    });
  }

  return (
    <div style={{ minWidth: 240 }}>
      <div className="mono" style={{ fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 6 }}>
        Rooms & labs
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
        {rooms.map((r) => (
          <span key={r.id} className="pill" style={{ background: "var(--paper)", border: "1px solid var(--line)", fontSize: 11, display: "flex", alignItems: "center", gap: 5 }}>
            {r.name}
            {r.capacity != null && <span className="mono" style={{ color: "var(--faint)" }}>· {r.capacity}</span>}
            <span onClick={() => startTransition(() => deleteRoom(r.id))} style={{ cursor: "pointer", color: "var(--critical)" }}>
              ×
            </span>
          </span>
        ))}
        {rooms.length === 0 && <span style={{ fontSize: 11.5, color: "var(--muted)" }}>No rooms added yet.</span>}
      </div>
      {showForm ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <input className="in" placeholder="Room name" value={name} onChange={(e) => setName(e.target.value)} style={{ fontSize: 11.5, width: 100, padding: "4px 6px" }} />
          <input className="in" type="number" placeholder="Capacity" value={capacity} onChange={(e) => setCapacity(e.target.value)} style={{ fontSize: 11.5, width: 70, padding: "4px 6px" }} />
          <input className="in" placeholder="Equipment (optional)" value={note} onChange={(e) => setNote(e.target.value)} style={{ fontSize: 11.5, width: 120, padding: "4px 6px" }} />
          <button type="button" onClick={add} style={{ fontSize: 11, fontWeight: 700, background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 5, padding: "4px 10px", cursor: "pointer" }}>
            Add
          </button>
        </div>
      ) : (
        <span onClick={() => setShowForm(true)} style={{ fontSize: 11, fontWeight: 700, color: "var(--marigold-deep)", cursor: "pointer" }}>
          + Add room
        </span>
      )}
    </div>
  );
}
