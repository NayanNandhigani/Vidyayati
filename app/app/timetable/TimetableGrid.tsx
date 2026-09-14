"use client";

import { useState, useTransition } from "react";
import type { DayOfWeek } from "@prisma/client";
import { subjectStyleFor as styleFor } from "@/lib/academic";
import { setTimetableSlot } from "./actions";
import { setTimetableSlotWithRoom } from "./depth-actions";

const DAYS: DayOfWeek[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

type Slot = { subjectId: string; subjectName: string; staffId: string; staffName: string; roomId: string | null; roomName: string | null };
type Grid = Record<number, Partial<Record<DayOfWeek, Slot>>>;

export default function TimetableGrid({
  classId,
  grid: initialGrid,
  subjects,
  staff,
  todayCol,
  canEdit,
  rooms,
  showRooms,
}: {
  classId: string;
  grid: Grid;
  subjects: { id: string; name: string }[];
  staff: { id: string; name: string }[];
  todayCol: number;
  canEdit: boolean;
  rooms: { id: string; name: string }[];
  showRooms: boolean;
}) {
  const [grid, setGrid] = useState(initialGrid);
  const [editing, setEditing] = useState<{ period: number; day: DayOfWeek } | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function save(period: number, day: DayOfWeek, subjectId: string, staffId: string, roomId: string) {
    const subject = subjects.find((s) => s.id === subjectId);
    const staffMember = staff.find((s) => s.id === staffId);
    const room = rooms.find((r) => r.id === roomId);
    setConflictError(null);

    if (showRooms) {
      startTransition(async () => {
        const res = await setTimetableSlotWithRoom(classId, day, period, subjectId || null, staffId || null, roomId || null);
        if (res.error) {
          setConflictError(res.error);
          return;
        }
        setGrid((prev) => ({
          ...prev,
          [period]: { ...prev[period], [day]: subject && staffMember ? { subjectId, subjectName: subject.name, staffId, staffName: staffMember.name, roomId: roomId || null, roomName: room?.name ?? null } : undefined },
        }));
        setEditing(null);
      });
      return;
    }

    setGrid((prev) => ({
      ...prev,
      [period]: { ...prev[period], [day]: subject && staffMember ? { subjectId, subjectName: subject.name, staffId, staffName: staffMember.name, roomId: null, roomName: null } : undefined },
    }));
    setEditing(null);
    startTransition(async () => {
      await setTimetableSlot(classId, day, period, subjectId || null, staffId || null);
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {PERIODS.map((period, rowIdx) => (
        <div key={period} style={{ display: "grid", gridTemplateColumns: "84px repeat(6,1fr)", flex: 1, minHeight: 0, borderBottom: rowIdx === PERIODS.length - 1 ? "none" : "1px solid var(--line)" }}>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 12px", borderRight: "1px solid var(--line)" }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>P{period}</div>
          </div>
          {DAYS.map((day, colIdx) => {
            const slot = grid[period]?.[day];
            const isToday = colIdx === todayCol;
            const isEditing = editing?.period === period && editing?.day === day;
            const style = slot ? styleFor(slot.subjectName) : null;
            return (
              <div
                key={day}
                onClick={() => canEdit && setEditing({ period, day })}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: 2,
                  padding: "6px 9px",
                  borderRight: colIdx === DAYS.length - 1 ? "none" : "1px solid var(--line)",
                  background: isToday ? "var(--marigold-tint)" : "transparent",
                  cursor: canEdit ? "pointer" : "default",
                }}
              >
                {isEditing ? (
                  <CellEditor
                    subjects={subjects}
                    staff={staff}
                    rooms={rooms}
                    showRooms={showRooms}
                    initial={slot}
                    error={conflictError}
                    onSave={(subjectId, staffId, roomId) => save(period, day, subjectId, staffId, roomId)}
                    onCancel={() => {
                      setEditing(null);
                      setConflictError(null);
                    }}
                  />
                ) : slot ? (
                  <div style={{ borderRadius: 7, padding: "6px 8px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 2, background: style!.bg }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: style!.fg }}>{slot.subjectName}</div>
                    <div className="mono" style={{ fontSize: 9, color: style!.fg, opacity: 0.75 }}>
                      {slot.staffName}
                      {slot.roomName && ` · ${slot.roomName}`}
                    </div>
                  </div>
                ) : (
                  <div style={{ borderRadius: 7, padding: "6px 8px", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--paper)", border: "1px dashed var(--line)" }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--faint)" }}>{canEdit ? "+ Add" : "Free"}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function CellEditor({
  subjects,
  staff,
  rooms,
  showRooms,
  initial,
  error,
  onSave,
  onCancel,
}: {
  subjects: { id: string; name: string }[];
  staff: { id: string; name: string }[];
  rooms: { id: string; name: string }[];
  showRooms: boolean;
  initial?: Slot;
  error: string | null;
  onSave: (subjectId: string, staffId: string, roomId: string) => void;
  onCancel: () => void;
}) {
  const [subjectId, setSubjectId] = useState(initial?.subjectId ?? "");
  const [staffId, setStaffId] = useState(initial?.staffId ?? "");
  const [roomId, setRoomId] = useState(initial?.roomId ?? "");

  return (
    <div data-testid="timetable-cell-editor" onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", gap: 3, background: "#fff", border: "1px solid var(--marigold)", borderRadius: 7, padding: 5, minWidth: showRooms ? 110 : undefined }}>
      <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} style={{ fontSize: 10, padding: 2 }}>
        <option value="">Subject…</option>
        {subjects.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <select value={staffId} onChange={(e) => setStaffId(e.target.value)} style={{ fontSize: 10, padding: 2 }}>
        <option value="">Teacher…</option>
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      {showRooms && (
        <select value={roomId} onChange={(e) => setRoomId(e.target.value)} style={{ fontSize: 10, padding: 2 }}>
          <option value="">Room…</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      )}
      {error && <div style={{ fontSize: 9, color: "var(--critical)", fontWeight: 600, lineHeight: 1.3 }}>{error}</div>}
      <div style={{ display: "flex", gap: 4 }}>
        <button onClick={() => onSave(subjectId, staffId, roomId)} style={{ flex: 1, fontSize: 9.5, fontWeight: 700, background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 4, padding: "3px 0", cursor: "pointer" }}>
          Save
        </button>
        <button
          onClick={() => (initial ? onSave("", "", "") : onCancel())}
          style={{ flex: 1, fontSize: 9.5, fontWeight: 600, background: "var(--line)", border: "none", borderRadius: 4, padding: "3px 0", cursor: "pointer" }}
        >
          {initial ? "Clear" : "Cancel"}
        </button>
      </div>
    </div>
  );
}
