import Link from "next/link";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { getScopedDb } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { studentName } from "@/lib/format";
import { hasFeature } from "@/lib/feature-flags";
import AddStopForm from "./AddStopForm";
import RouteDetailForm from "./RouteDetailForm";
import { VehicleColumnCard, type VehicleColumn } from "./AssignmentsPanel";
import { AttendanceRosterPanel } from "./AttendancePanel";

const TABS = ["vehicles", "routes", "assignments", "attendance"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = { vehicles: "Vehicles", routes: "Routes", assignments: "Student Assignments", attendance: "Attendance" };

type VehicleWithRoutes = Prisma.TransportVehicleGetPayload<{ include: { routes: { include: { assignments: true } } } }>;
type RouteWithDetail = Prisma.TransportRouteGetPayload<{ include: { vehicle: true; assignments: true; stops: true } }>;

export default async function TransportPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; route?: string; vehicle?: string; date?: string; q?: string }>;
}) {
  const session = await auth();
  const sdb = await getScopedDb();

  if (session!.user.role === "PARENT") {
    return <ParentTransportView />;
  }

  const accessLevel = await requireModuleAccess("Transport", "VIEW");
  const canEdit = accessLevel === "EDIT";
  const params = await searchParams;
  const tab: Tab = TABS.includes(params.tab as Tab) ? (params.tab as Tab) : "vehicles";

  const [vehiclesRaw, routesRaw] = await Promise.all([
    sdb.transportVehicle.findMany({ include: { routes: { include: { assignments: true } } }, orderBy: { vehicleNo: "asc" } }),
    sdb.transportRoute.findMany({ include: { vehicle: true, assignments: true, stops: { orderBy: { sequence: "asc" } } }, orderBy: { name: "asc" } }),
  ]);

  const totalCommuting = routesRaw.reduce((s, r) => s + r.assignments.length, 0);
  const activeVehicleCount = vehiclesRaw.filter((v) => v.isActive).length;
  const utilisableVehicles = vehiclesRaw.filter((v) => v.capacity);
  const avgUtilisation = utilisableVehicles.length
    ? Math.round((utilisableVehicles.reduce((s, v) => s + v.routes.reduce((rs, r) => rs + r.assignments.length, 0) / v.capacity!, 0) / utilisableVehicles.length) * 100)
    : 0;

  return (
    <div style={{ padding: "26px 34px", display: "flex", flexDirection: "column", gap: 16, height: "100dvh", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="disp" style={{ fontSize: 21 }}>
          Transport
        </div>
        {canEdit && tab === "routes" && (
          <Link href="/app/transport/new-route" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 15px", fontSize: 13, fontWeight: 600, textDecoration: "none", color: "var(--ink)" }}>
            + Add route
          </Link>
        )}
        {canEdit && tab === "vehicles" && (
          <Link href="/app/transport/new-vehicle" style={{ background: "var(--marigold)", border: "none", borderRadius: 8, padding: "8px 15px", fontSize: 13, fontWeight: 700, textDecoration: "none", color: "#fff" }}>
            + Add vehicle
          </Link>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 13 }}>
        <Stat label="Active vehicles" value={<>{activeVehicleCount}<span style={{ fontSize: 13, color: "var(--faint)", fontWeight: 500 }}> / {vehiclesRaw.length}</span></>} color="var(--teal)" />
        <Stat label="Active routes" value={routesRaw.length} />
        <Stat label="Students commuting" value={totalCommuting} />
        <Stat label="Avg. seat utilisation" value={`${avgUtilisation}%`} color="var(--marigold-deep)" />
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid var(--line)" }}>
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/app/transport?tab=${t}`}
            style={{ padding: "10px 2px", marginRight: 26, fontSize: 13.5, fontWeight: tab === t ? 700 : 600, color: tab === t ? "var(--ink)" : "var(--muted)", borderBottom: tab === t ? "2px solid var(--marigold)" : "2px solid transparent", textDecoration: "none" }}
          >
            {TAB_LABEL[t]}
          </Link>
        ))}
      </div>

      {tab === "vehicles" ? (
        <VehiclesTab vehicles={vehiclesRaw} />
      ) : tab === "routes" ? (
        <RoutesTab routes={routesRaw} vehicles={vehiclesRaw} selectedId={params.route} canEdit={canEdit} />
      ) : tab === "assignments" ? (
        await AssignmentsTab({ vehicles: vehiclesRaw, routes: routesRaw, sdb, canEdit })
      ) : (
        await AttendanceTab({ routes: routesRaw, params, sdb, canEdit })
      )}
    </div>
  );
}

function VehiclesTab({ vehicles }: { vehicles: VehicleWithRoutes[] }) {
  return (
    <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", overflow: "hidden", flex: 1, minHeight: 0 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 0.7fr 1.2fr 1.2fr 0.8fr auto", padding: "13px 20px", borderBottom: "1px solid var(--line)", fontSize: 10.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        <div>Vehicle no.</div>
        <div>Type</div>
        <div>Capacity</div>
        <div>Driver</div>
        <div>Routes</div>
        <div>Status</div>
        <div />
      </div>
      <div style={{ overflowY: "auto" }}>
        {vehicles.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>No vehicles added yet — use "+ Add vehicle" above.</div>}
        {vehicles.map((v) => (
          <Link
            key={v.id}
            href={`/app/transport/vehicles/${v.id}`}
            style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 0.7fr 1.2fr 1.2fr 0.8fr auto", alignItems: "center", padding: "12px 20px", borderBottom: "1px solid var(--line)", fontSize: 13, textDecoration: "none", color: "inherit" }}
          >
            <div className="mono" style={{ fontWeight: 600 }}>{v.vehicleNo}</div>
            <div style={{ color: "var(--muted)" }}>{v.vehicleType ?? "—"}</div>
            <div className="mono">{v.capacity ?? "—"}</div>
            <div style={{ color: "var(--muted)" }}>{v.driverName ?? "—"}</div>
            <div style={{ color: "var(--teal)", fontSize: 12 }}>{v.routes.map((r) => r.name).join(", ") || "—"}</div>
            <div>
              <span className="pill" style={{ background: v.isActive ? "var(--good-tint)" : "var(--critical-tint)", color: v.isActive ? "var(--good)" : "var(--critical)" }}>
                {v.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--marigold-deep)" }}>Open →</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function RoutesTab({
  routes,
  vehicles,
  selectedId,
  canEdit,
}: {
  routes: RouteWithDetail[];
  vehicles: VehicleWithRoutes[];
  selectedId?: string;
  canEdit: boolean;
}) {
  const selected = routes.find((r) => r.id === selectedId) ?? routes[0];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 16, flex: 1, minHeight: 0 }}>
      <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1.3fr 0.9fr 0.9fr", padding: "13px 20px", borderBottom: "1px solid var(--line)", fontSize: 10.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          <div>Route</div>
          <div>Vehicle</div>
          <div>Stops</div>
          <div>Assigned</div>
        </div>
        <div style={{ overflowY: "auto" }}>
          {routes.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>No routes set up yet.</div>}
          {routes.map((r) => {
            const isSelected = r.id === selected?.id;
            return (
              <Link key={r.id} href={`/app/transport?tab=routes&route=${r.id}`} style={{ display: "grid", gridTemplateColumns: "1.8fr 1.3fr 0.9fr 0.9fr", alignItems: "center", padding: "12px 20px", borderBottom: "1px solid var(--line)", fontSize: 13, background: isSelected ? "var(--marigold-tint)" : "transparent", textDecoration: "none", color: "inherit" }}>
                <div style={{ fontWeight: isSelected ? 700 : 600 }}>{r.name}</div>
                <div className="mono" style={{ color: "var(--muted)" }}>{r.vehicle?.vehicleNo ?? "—"}</div>
                <div className="mono">{r.stops.length}</div>
                <div className="mono" style={{ fontWeight: 600 }}>
                  {r.assignments.length}
                  {r.vehicle?.capacity ? `/${r.vehicle.capacity}` : ""}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
        {selected ? (
          <>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 2 }}>{selected.name}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                {selected.vehicle?.vehicleNo ?? "No vehicle assigned"} · {selected.assignments.length}
                {selected.vehicle?.capacity ? ` of ${selected.vehicle.capacity}` : ""} seats
              </div>
            </div>
            {selected.vehicle?.capacity && (
              <div style={{ height: 9, borderRadius: 5, background: "var(--marigold-tint)" }}>
                <div style={{ height: "100%", width: `${Math.min(100, (selected.assignments.length / selected.vehicle.capacity) * 100)}%`, borderRadius: 5, background: "var(--marigold)" }} />
              </div>
            )}
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14, flex: 1, overflowY: "auto" }}>
              <div style={{ fontSize: 11.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Stop list · pickup times</div>
              {selected.stops.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>No stops added yet.</div>}
              {selected.stops.map((stop) => (
                <div key={stop.id} style={{ display: "flex", gap: 12 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--marigold)", flex: "none" }} />
                    <div style={{ width: 1.5, flex: 1, background: "var(--line)", minHeight: 20 }} />
                  </div>
                  <div style={{ paddingBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{stop.stopName}</div>
                    {stop.pickupTime && (
                      <div className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>
                        {stop.pickupTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {canEdit && (
                <div style={{ marginTop: 8 }}>
                  <AddStopForm routeId={selected.id} />
                </div>
              )}
            </div>
            {canEdit && (
              <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
                <RouteDetailForm routeId={selected.id} vehicleId={selected.vehicleId} feeAmount={selected.feeAmount ? Number(selected.feeAmount) : null} vehicles={vehicles.map((v) => ({ id: v.id, vehicleNo: v.vehicleNo }))} />
              </div>
            )}
          </>
        ) : (
          <div style={{ color: "var(--muted)", fontSize: 13.5 }}>No route selected.</div>
        )}
      </div>
    </div>
  );
}

async function AssignmentsTab({
  vehicles,
  routes,
  sdb,
  canEdit,
}: {
  vehicles: VehicleWithRoutes[];
  routes: RouteWithDetail[];
  sdb: Awaited<ReturnType<typeof getScopedDb>>;
  canEdit: boolean;
}) {
  const routeIds = routes.map((r) => r.id);
  const [assignments, unassignedStudents] = await Promise.all([
    routeIds.length > 0
      ? sdb.studentTransportAssignment.findMany({ where: { routeId: { in: routeIds } }, include: { student: { include: { class: true } }, stop: true } })
      : Promise.resolve([]),
    sdb.student.findMany({ where: { status: "ACTIVE", transportAssignment: null }, orderBy: [{ firstName: "asc" }, { surname: "asc" }], select: { id: true, firstName: true, surname: true, class: true } }),
  ]);

  const columns: VehicleColumn[] = [
    ...vehicles.map((v) => ({
      vehicleId: v.id,
      vehicleLabel: v.vehicleNo,
      routes: routes
        .filter((r) => r.vehicleId === v.id)
        .map((r) => ({
          id: r.id,
          name: r.name,
          stops: r.stops.map((s) => ({ id: s.id, stopName: s.stopName })),
          students: assignments
            .filter((a) => a.routeId === r.id)
            .map((a) => ({ id: a.studentId, firstName: a.student.firstName, surname: a.student.surname, className: `${a.student.class.grade}-${a.student.class.section}`, stopName: a.stop.stopName })),
        })),
    })),
    ...(routes.some((r) => !r.vehicleId)
      ? [
          {
            vehicleId: null,
            vehicleLabel: "Unassigned vehicle",
            routes: routes
              .filter((r) => !r.vehicleId)
              .map((r) => ({
                id: r.id,
                name: r.name,
                stops: r.stops.map((s) => ({ id: s.id, stopName: s.stopName })),
                students: assignments
                  .filter((a) => a.routeId === r.id)
                  .map((a) => ({ id: a.studentId, firstName: a.student.firstName, surname: a.student.surname, className: `${a.student.class.grade}-${a.student.class.section}`, stopName: a.stop.stopName })),
              })),
          },
        ]
      : []),
  ];

  return (
    <div style={{ display: "flex", gap: 16, flex: 1, minHeight: 0, overflowX: "auto", paddingBottom: 4 }}>
      {columns.length === 0 && <div style={{ color: "var(--muted)", padding: 32 }}>Add a vehicle and a route first.</div>}
      {columns.map((col) => (
        <VehicleColumnCard key={col.vehicleId ?? "none"} column={col} unassigned={unassignedStudents.map((s) => ({ id: s.id, firstName: s.firstName, surname: s.surname, className: `${s.class.grade}-${s.class.section}` }))} canEdit={canEdit} />
      ))}
    </div>
  );
}

async function AttendanceTab({
  routes,
  params,
  sdb,
  canEdit,
}: {
  routes: RouteWithDetail[];
  params: { route?: string; date?: string };
  sdb: Awaited<ReturnType<typeof getScopedDb>>;
  canEdit: boolean;
}) {
  const date = params.date ?? new Date().toISOString().slice(0, 10);
  const selectedRoute = routes.find((r) => r.id === params.route) ?? routes[0];

  const [assignments, attendanceRows] = selectedRoute
    ? await Promise.all([
        sdb.studentTransportAssignment.findMany({ where: { routeId: selectedRoute.id }, include: { student: { include: { class: true } } } }),
        sdb.transportAttendance.findMany({ where: { routeId: selectedRoute.id, date: new Date(date) } }),
      ])
    : [[], []];

  const attendanceByStudent = new Map(attendanceRows.map((a) => [a.studentId, a]));
  const students = assignments.map((a) => ({
    id: a.studentId,
    firstName: a.student.firstName,
    surname: a.student.surname,
    className: `${a.student.class.grade}-${a.student.class.section}`,
    pickupAt: attendanceByStudent.get(a.studentId)?.pickupAt?.toISOString() ?? null,
    dropAt: attendanceByStudent.get(a.studentId)?.dropAt?.toISOString() ?? null,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1, minHeight: 0 }}>
      <form method="GET" style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input type="hidden" name="tab" value="attendance" />
        <select className="in" name="route" defaultValue={selectedRoute?.id ?? ""} style={{ width: "auto" }}>
          {routes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <input className="in mono" type="date" name="date" defaultValue={date} style={{ width: "auto" }} />
        <button type="submit" style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "0 16px", height: 36, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Go
        </button>
      </form>

      {selectedRoute ? (
        <AttendanceRosterPanel routeId={selectedRoute.id} date={date} students={students} canEdit={canEdit} />
      ) : (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
          No routes set up yet.
        </div>
      )}
    </div>
  );
}

async function ParentTransportView() {
  const session = await auth();
  const sdb = await getScopedDb();

  const parent = await sdb.parent.findUnique({
    where: { userId: session!.user.id },
    include: {
      studentLinks: {
        include: {
          student: {
            include: { transportAssignment: { include: { route: { include: { vehicle: true } }, stop: true } } },
          },
        },
      },
    },
  });
  const students = parent?.studentLinks.map((l) => l.student) ?? [];
  const showLiveLocation = await hasFeature(session!.user.schoolId, "transport.liveLocation");

  return (
    <div style={{ padding: "26px 34px", display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="disp" style={{ fontSize: 21 }}>
        Transport
      </div>
      {students.length === 0 && <div style={{ color: "var(--muted)" }}>No students linked to your account.</div>}
      {students.map((s) => (
        <div key={s.id} className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 14 }}>{studentName(s)}</div>
          {s.transportAssignment ? (
            <div style={{ fontSize: 13.5 }}>
              <div style={{ fontWeight: 600 }}>{s.transportAssignment.route.name}</div>
              <div style={{ color: "var(--muted)", fontSize: 12.5, marginTop: 2 }}>
                Pickup: {s.transportAssignment.stop.stopName}
                {s.transportAssignment.stop.pickupTime && ` · ${s.transportAssignment.stop.pickupTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}`}
              </div>
              {showLiveLocation && s.transportAssignment.route.vehicle?.lastKnownLat != null && (
                <div style={{ marginTop: 6 }}>
                  <a
                    href={`https://www.google.com/maps?q=${s.transportAssignment.route.vehicle.lastKnownLat},${s.transportAssignment.route.vehicle.lastKnownLng}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 11.5, fontWeight: 700, color: "var(--marigold-deep)" }}
                  >
                    View bus's last known location ↗
                  </a>
                  <div style={{ fontSize: 10.5, color: "var(--faint)" }}>
                    Updated {s.transportAssignment.route.vehicle.lastLocationAt ? new Date(s.transportAssignment.route.vehicle.lastLocationAt).toLocaleString("en-IN") : "—"}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: "var(--muted)", fontSize: 13.5 }}>Not assigned to a transport route.</div>
          )}
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="card" style={{ padding: "14px 17px" }}>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 6 }}>{label}</div>
      <div className="mono" style={{ fontSize: 21, fontWeight: 700, color: color ?? "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}
