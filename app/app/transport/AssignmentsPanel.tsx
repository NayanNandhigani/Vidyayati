"use client";

import { useState, useTransition } from "react";
import { studentName } from "@/lib/format";
import { assignStudentToRoute, unassignStudentFromRoute } from "./actions";

export type VehicleColumn = {
  vehicleId: string | null;
  vehicleLabel: string; // registration no, or "Unassigned vehicle"
  routes: {
    id: string;
    name: string;
    stops: { id: string; stopName: string }[];
    students: { id: string; firstName: string; surname: string; className: string; stopName: string | null }[];
  }[];
};

type UnassignedStudent = { id: string; firstName: string; surname: string; className: string };

/** One vehicle's column: its route(s), each route's roster, and a compact add-student control per route. */
export function VehicleColumnCard({ column, unassigned, canEdit }: { column: VehicleColumn; unassigned: UnassignedStudent[]; canEdit: boolean }) {
  return (
    <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", minWidth: 280, flex: "1 1 280px", overflow: "hidden" }}>
      <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--line)", background: "var(--paper)" }}>
        <div className="mono" style={{ fontSize: 13.5, fontWeight: 700 }}>{column.vehicleLabel}</div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
          {column.routes.length === 0 ? "No route assigned" : column.routes.map((r) => r.name).join(", ")}
        </div>
      </div>
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 14, overflowY: "auto", maxHeight: 480 }}>
        {column.routes.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)" }}>Assign a route to this vehicle in the Routes tab first.</div>}
        {column.routes.map((route) => (
          <RouteRoster key={route.id} route={route} unassigned={unassigned} canEdit={canEdit} />
        ))}
      </div>
    </div>
  );
}

function RouteRoster({ route, unassigned, canEdit }: { route: VehicleColumn["routes"][number]; unassigned: UnassignedStudent[]; canEdit: boolean }) {
  const [pending, startTransition] = useTransition();
  const [studentId, setStudentId] = useState("");
  const [stopId, setStopId] = useState("");
  const [error, setError] = useState<string | null>(null);

  function assign() {
    if (!studentId || !stopId) {
      setError("Pick a student and a stop.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await assignStudentToRoute(studentId, route.id, stopId);
        setStudentId("");
        setStopId("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not assign.");
      }
    });
  }

  function remove(id: string) {
    startTransition(() => unassignStudentFromRoute(id));
  }

  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--marigold-deep)", marginBottom: 6 }}>{route.name}</div>
      {route.students.length === 0 ? (
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 8 }}>No students on this route yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}>
          {route.students.map((s) => (
            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "5px 8px", background: "var(--paper)", borderRadius: 6 }}>
              <span>
                <span style={{ fontWeight: 600 }}>{studentName(s)}</span>
                <span style={{ color: "var(--faint)" }}> · {s.className}</span>
                {s.stopName && <span className="mono" style={{ color: "var(--muted)" }}> · {s.stopName}</span>}
              </span>
              {canEdit && (
                <span onClick={() => remove(s.id)} style={{ color: "var(--critical)", cursor: pending ? "default" : "pointer", fontWeight: 700 }}>
                  ×
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {canEdit && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", gap: 4 }}>
            <select className="in" value={studentId} onChange={(e) => setStudentId(e.target.value)} style={{ fontSize: 11, padding: "4px 5px", flex: 1.3 }}>
              <option value="">+ Student…</option>
              {unassigned.map((s) => (
                <option key={s.id} value={s.id}>
                  {studentName(s)} · {s.className}
                </option>
              ))}
            </select>
            <select className="in" value={stopId} onChange={(e) => setStopId(e.target.value)} style={{ fontSize: 11, padding: "4px 5px", flex: 1 }}>
              <option value="">Stop…</option>
              {route.stops.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.stopName}
                </option>
              ))}
            </select>
            <button type="button" disabled={pending || !studentId || !stopId} onClick={assign} style={{ fontSize: 11, fontWeight: 700, background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 5, padding: "0 8px", cursor: pending ? "default" : "pointer" }}>
              +
            </button>
          </div>
          {error && <div style={{ color: "var(--critical)", fontSize: 10.5 }}>{error}</div>}
        </div>
      )}
    </div>
  );
}
