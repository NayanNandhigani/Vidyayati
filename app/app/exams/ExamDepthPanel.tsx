"use client";

import { useRef, useState, useTransition } from "react";
import { randomizeSeating, bulkImportMarks, updateExamResultRelease, updateFeeLockSetting } from "./depth-actions";

type Seat = { id: string; studentName: string; roomName: string; seatNo: number };
type Room = { id: string; name: string };

export default function ExamDepthPanel({
  examId,
  canEdit,
  showSeating,
  rooms,
  seating,
  showResultRelease,
  resultReleaseAt,
  feeLockEnabled,
}: {
  examId: string;
  canEdit: boolean;
  showSeating: boolean;
  rooms: Room[];
  seating: Seat[];
  showResultRelease: boolean;
  resultReleaseAt: string | null;
  feeLockEnabled: boolean;
}) {
  const [, startTransition] = useTransition();
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [importResult, setImportResult] = useState<{ error?: string; imported?: number } | null>(null);
  const [releaseAt, setReleaseAt] = useState(resultReleaseAt?.slice(0, 16) ?? "");
  const [feeLock, setFeeLock] = useState(feeLockEnabled);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!showSeating && !showResultRelease) return null;

  function toggleRoom(id: string) {
    setSelectedRooms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function doRandomize() {
    startTransition(async () => {
      await randomizeSeating(examId, [...selectedRooms]);
    });
  }

  function pickCsv() {
    fileRef.current?.click();
  }

  function onCsvChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      startTransition(async () => {
        const res = await bulkImportMarks(examId, String(reader.result));
        // The marks grid above (ExamMarksGrid) is a still-mounted Client
        // Component holding its own local state seeded once from initial
        // props — router.refresh() re-renders the Server Component tree
        // but can't reset state already living in that mounted instance,
        // so a real reload is what's needed to show the just-imported
        // marks immediately (this only fires on a successful import, not
        // on every render).
        if (res.imported) {
          window.location.reload();
          return;
        }
        setImportResult(res);
      });
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function saveRelease() {
    startTransition(() => updateExamResultRelease(examId, releaseAt));
  }

  function toggleFeeLock() {
    const next = !feeLock;
    setFeeLock(next);
    startTransition(() => updateFeeLockSetting(next));
  }

  return (
    <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
      {showSeating && (
        <div>
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 8 }}>
            Seating arrangement
          </div>
          {canEdit && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
              {rooms.length === 0 ? (
                <span style={{ fontSize: 12, color: "var(--muted)" }}>Add rooms in Timetable first.</span>
              ) : (
                rooms.map((r) => (
                  <label key={r.id} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                    <input type="checkbox" checked={selectedRooms.has(r.id)} onChange={() => toggleRoom(r.id)} />
                    {r.name}
                  </label>
                ))
              )}
              <button
                type="button"
                disabled={selectedRooms.size === 0}
                onClick={doRandomize}
                style={{ fontSize: 12, fontWeight: 700, background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer" }}
              >
                Randomize seating
              </button>

              <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: "var(--marigold-deep)", cursor: "pointer" }} onClick={pickCsv}>
                Bulk import marks (CSV) →
              </span>
              <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onCsvChosen} style={{ display: "none" }} />
            </div>
          )}
          {importResult && (
            <div style={{ fontSize: 12, color: importResult.error ? "var(--critical)" : "var(--good)", marginBottom: 8 }}>
              {importResult.error ?? `Imported ${importResult.imported} marks.`}
            </div>
          )}
          {seating.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>No seating generated yet.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, maxHeight: 160, overflowY: "auto" }}>
              {seating.map((s) => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, padding: "4px 8px", background: "var(--paper)", borderRadius: 5 }}>
                  <span>{s.studentName}</span>
                  <span className="mono" style={{ color: "var(--muted)" }}>{s.roomName} · #{s.seatNo}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showResultRelease && canEdit && (
        <div>
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 8 }}>
            Result release
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              Release results at
              <input className="in" type="datetime-local" value={releaseAt} onChange={(e) => setReleaseAt(e.target.value)} onBlur={saveRelease} style={{ fontSize: 12 }} />
            </label>
            <span style={{ fontSize: 11.5, color: "var(--muted)" }}>Leave blank for immediate visibility.</span>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <input type="checkbox" checked={feeLock} onChange={toggleFeeLock} />
              Lock results until fees are cleared (school-wide)
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
