import Link from "next/link";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { getScopedDb } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { studentName } from "@/lib/format";
import AllocateForm from "./AllocateForm";
import { RoomTypeWardenEditor, MessMenuEditor, VisitorLogPanel, OutingRequestsPanel, ParentOutingRequestForm } from "./HostelDepthPanel";
import { NewRoomInlineForm, RoomDetailEditor } from "./RoomDetailsPanel";
import { MealsServedLog } from "./MealsPanel";
import { MaintenancePanel, type MaintenanceTarget, type MaintenanceLogRow } from "./MaintenancePanel";
import LaundryPanel, { type LaundryStudentOption, type LaundryTicketRow } from "./LaundryPanel";
import HostelAttendanceRoster from "./HostelAttendanceRoster";
import { HostelAttendanceReports } from "./HostelAttendanceReports";
import { getHostelAttendanceSummary } from "./attendance-actions";
import { removeAllocation } from "./actions";
import type { HostelAttendanceSession } from "@prisma/client";

const TABS = ["rooms", "allocation", "attendance", "visitors", "canteen", "maintenance", "laundry"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = { rooms: "Room Details", allocation: "Student Allocation", attendance: "Attendance", visitors: "Visitor Entry & Permit", canteen: "Canteen / Mess", maintenance: "Maintenance", laundry: "Laundry Management" };

type RoomsList = Prisma.HostelRoomGetPayload<{
  include: { allocations: { include: { student: { include: { class: true } }; bed: true } }; warden: { include: { user: true } }; facilities: true; beds: { include: { allocation: true } } };
}>[];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function HostelPage({ searchParams }: { searchParams: Promise<{ tab?: string; room?: string; date?: string; session?: string }> }) {
  const session = await auth();
  const sdb = await getScopedDb();

  if (session!.user.role === "PARENT") {
    return <ParentHostelView />;
  }

  const accessLevel = await requireModuleAccess("Hostel", "VIEW");
  const canEdit = accessLevel === "EDIT";
  const params = await searchParams;
  const tab: Tab = TABS.includes(params.tab as Tab) ? (params.tab as Tab) : "rooms";

  const rooms = await sdb.hostelRoom.findMany({
    include: {
      allocations: { include: { student: { include: { class: true } }, bed: true } },
      warden: { include: { user: true } },
      facilities: true,
      beds: { include: { allocation: true } },
    },
    orderBy: { roomNo: "asc" },
  });

  const totalBeds = rooms.reduce((s, r) => s + r.capacity, 0);
  const occupied = rooms.reduce((s, r) => s + r.allocations.length, 0);
  const available = totalBeds - occupied;
  const occupancyPct = totalBeds ? Math.round((occupied / totalBeds) * 100) : 0;

  const selected = rooms.find((r) => r.id === params.room) ?? rooms[0];

  return (
    <div style={{ padding: "26px 34px", display: "flex", flexDirection: "column", gap: 16, height: "100dvh", boxSizing: "border-box" }}>
      <div className="disp" style={{ fontSize: 21 }}>
        Hostel
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 13 }}>
        <Stat label="Total rooms" value={rooms.length} />
        <Stat label="Occupied beds" value={occupied} color="var(--teal)" />
        <Stat label="Available beds" value={available} color="var(--good)" />
        <Stat label="Occupancy %" value={`${occupancyPct}%`} color="var(--marigold-deep)" />
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid var(--line)" }}>
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/app/hostel?tab=${t}`}
            style={{ padding: "10px 2px", marginRight: 22, fontSize: 13.5, fontWeight: tab === t ? 700 : 600, color: tab === t ? "var(--ink)" : "var(--muted)", borderBottom: tab === t ? "2px solid var(--marigold)" : "2px solid transparent", textDecoration: "none", whiteSpace: "nowrap" }}
          >
            {TAB_LABEL[t]}
          </Link>
        ))}
      </div>

      {tab === "rooms" ? (
        <RoomsTab rooms={rooms} selectedId={selected?.id} canEdit={canEdit} />
      ) : tab === "allocation" ? (
        <AllocationTab rooms={rooms} selectedId={selected?.id} canEdit={canEdit} sdb={sdb} />
      ) : tab === "attendance" ? (
        await AttendanceTab({ date: params.date ?? todayISO(), session: (params.session as HostelAttendanceSession) ?? "MORNING", canEdit, sdb })
      ) : tab === "visitors" ? (
        await VisitorsTab({ rooms, sdb })
      ) : tab === "canteen" ? (
        await CanteenTab({ sdb })
      ) : tab === "maintenance" ? (
        await MaintenanceTab({ rooms, sdb })
      ) : (
        await LaundryTab({ sdb, canEdit })
      )}
    </div>
  );
}

function RoomsTab({ rooms, selectedId, canEdit }: { rooms: RoomsList; selectedId?: string; canEdit: boolean }) {
  const selected = rooms.find((r) => r.id === selectedId) ?? rooms[0];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 16, flex: 1, minHeight: 0 }}>
      <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 0.8fr 1fr 1fr", padding: "13px 20px", borderBottom: "1px solid var(--line)", fontSize: 10.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          <div>Room</div>
          <div>Size</div>
          <div>Capacity</div>
          <div>Type</div>
          <div>Facilities</div>
        </div>
        <div style={{ overflowY: "auto" }}>
          {rooms.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>No hostel rooms set up yet — add one on the right.</div>}
          {rooms.map((r) => {
            const isSelected = r.id === selected?.id;
            return (
              <Link key={r.id} href={`/app/hostel?tab=rooms&room=${r.id}`} style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 0.8fr 1fr 1fr", alignItems: "center", padding: "12px 20px", borderBottom: "1px solid var(--line)", fontSize: 13, background: isSelected ? "var(--marigold-tint)" : "transparent", textDecoration: "none", color: "inherit" }}>
                <div style={{ fontWeight: isSelected ? 700 : 600 }}>{r.roomNo}</div>
                <div style={{ color: "var(--muted)" }}>{r.roomSize ?? "—"}</div>
                <div className="mono">{r.capacity}</div>
                <div style={{ color: "var(--muted)" }}>{r.roomType ?? "—"}</div>
                <div className="mono" style={{ fontSize: 11.5, color: "var(--faint)" }}>
                  {r.facilities.filter((f) => f.type === "TOILET").length} toilet · {r.facilities.filter((f) => f.type === "SHOWER").length} shower
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ padding: 22, overflowY: "auto" }}>
        {canEdit ? (
          selected ? (
            <RoomDetailEditor
              room={{ id: selected.id, roomNo: selected.roomNo, roomSize: selected.roomSize, capacity: selected.capacity, roomType: selected.roomType }}
              facilities={selected.facilities.map((f) => ({ id: f.id, type: f.type, label: f.label, condition: f.condition }))}
              beds={[...selected.beds]
                .sort((a, b) => Number(a.bedNo) - Number(b.bedNo) || a.bedNo.localeCompare(b.bedNo))
                .map((b) => {
                  const occupant = selected.allocations.find((a) => a.bedId === b.id);
                  return { bedNo: b.bedNo, occupantName: occupant ? studentName(occupant.student) : null };
                })}
            />
          ) : (
            <NewRoomInlineForm />
          )
        ) : selected ? (
          <div style={{ color: "var(--muted)", fontSize: 13.5 }}>{selected.roomNo} — {selected.capacity} beds</div>
        ) : (
          <div style={{ color: "var(--muted)", fontSize: 13.5 }}>No room selected.</div>
        )}
        {canEdit && selected && (
          <details style={{ marginTop: 20, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
            <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "var(--marigold-deep)" }}>+ Add another room</summary>
            <div style={{ marginTop: 14 }}>
              <NewRoomInlineForm />
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

async function AllocationTab({ rooms, selectedId, canEdit, sdb }: { rooms: RoomsList; selectedId?: string; canEdit: boolean; sdb: Awaited<ReturnType<typeof getScopedDb>> }) {
  const selected = rooms.find((r) => r.id === selectedId) ?? rooms[0];
  const [unassignedStudents, staffOptions] = await Promise.all([
    sdb.student.findMany({ where: { status: "ACTIVE", hostelAllocations: { none: {} } }, orderBy: [{ firstName: "asc" }, { surname: "asc" }], select: { id: true, firstName: true, surname: true } }),
    sdb.staffProfile.findMany({ include: { user: true }, orderBy: { user: { name: "asc" } } }),
  ]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 16, flex: 1, minHeight: 0 }}>
      <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr 0.8fr 0.9fr 1fr", padding: "13px 20px", borderBottom: "1px solid var(--line)", fontSize: 10.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          <div>Room No.</div>
          <div>Warden</div>
          <div>Capacity</div>
          <div>Occupied</div>
          <div>Status</div>
        </div>
        <div style={{ overflowY: "auto" }}>
          {rooms.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>No hostel rooms set up yet.</div>}
          {rooms.map((r) => {
            const isSelected = r.id === selected?.id;
            const full = r.allocations.length >= r.capacity;
            const status = full ? { label: "Full", bg: "var(--teal-tint)", fg: "var(--teal)" } : { label: "Available", bg: "var(--good-tint)", fg: "var(--good)" };
            return (
              <Link key={r.id} href={`/app/hostel?tab=allocation&room=${r.id}`} style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr 0.8fr 0.9fr 1fr", alignItems: "center", padding: "12px 20px", borderBottom: "1px solid var(--line)", fontSize: 13, background: isSelected ? "var(--marigold-tint)" : "transparent", textDecoration: "none", color: "inherit" }}>
                <div style={{ fontWeight: isSelected ? 700 : 600 }}>{r.roomNo}</div>
                <div style={{ color: "var(--muted)" }}>{r.warden?.user.name ?? "—"}</div>
                <div className="mono">{r.capacity}</div>
                <div className="mono" style={{ fontWeight: 600 }}>{r.allocations.length}</div>
                <div>
                  <span className="pill" style={{ background: status.bg, color: status.fg }}>
                    {status.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
        {selected ? (
          <>
            {canEdit && (
              <AllocateForm
                roomId={selected.id}
                students={unassignedStudents}
                availableBeds={selected.beds.filter((b) => !b.allocation).map((b) => ({ id: b.id, bedNo: b.bedNo })).sort((a, b) => Number(a.bedNo) - Number(b.bedNo) || a.bedNo.localeCompare(b.bedNo))}
              />
            )}
            {canEdit && (
              <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                <div style={{ fontSize: 11.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Warden</div>
                <RoomTypeWardenEditor roomId={selected.id} roomType={selected.roomType} wardenStaffId={selected.wardenStaffId} staffOptions={staffOptions.map((s) => ({ id: s.id, name: s.user.name ?? "Staff" }))} />
              </div>
            )}
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14, flex: 1, overflowY: "auto" }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 2 }}>{selected.roomNo} roster</div>
              <div className="mono" style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
                {selected.allocations.length} of {selected.capacity} beds occupied
              </div>
              <div style={{ height: 9, borderRadius: 5, background: "var(--marigold-tint)", marginBottom: 16 }}>
                <div style={{ height: "100%", width: `${Math.min(100, (selected.allocations.length / selected.capacity) * 100)}%`, borderRadius: 5, background: "var(--marigold)" }} />
              </div>
              {selected.allocations.length === 0 ? (
                <div style={{ color: "var(--muted)", fontSize: 13 }}>No students allocated yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {selected.allocations.map((a) => (
                    <div key={a.studentId} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>
                          {studentName(a.student)}
                          {a.bed && <span className="mono" style={{ fontWeight: 600, color: "var(--muted)", marginLeft: 8, fontSize: 11.5 }}>Bed {a.bed.bedNo}</span>}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--muted)", margin: "2px 0 4px" }}>
                          Class {a.student.class.grade}-{a.student.class.section}
                        </div>
                        <div className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>
                          Moved in {a.dateFrom.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </div>
                      </div>
                      {canEdit && (
                        <form action={async () => { "use server"; await removeAllocation(a.studentId); }}>
                          <button type="submit" style={{ fontSize: 11, fontWeight: 700, color: "var(--critical)", background: "none", border: "none", cursor: "pointer" }}>
                            Remove
                          </button>
                        </form>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ color: "var(--muted)", fontSize: 13.5 }}>No room selected.</div>
        )}
      </div>
    </div>
  );
}

async function AttendanceTab({ date, session, canEdit, sdb }: { date: string; session: HostelAttendanceSession; canEdit: boolean; sdb: Awaited<ReturnType<typeof getScopedDb>> }) {
  const [allocations, existing, summary] = await Promise.all([
    sdb.hostelAllocation.findMany({ include: { student: true, room: true, bed: true }, orderBy: { student: { firstName: "asc" } } }),
    sdb.hostelAttendance.findMany({ where: { date: new Date(`${date}T00:00:00`), session } }),
    getHostelAttendanceSummary(),
  ]);

  const residents = allocations.map((a) => ({ id: a.studentId, firstName: a.student.firstName, surname: a.student.surname, roomNo: a.room.roomNo, bedNo: a.bed?.bedNo ?? null }));
  const initialMarks: Record<string, "PRESENT" | "ABSENT" | "LATE"> = {};
  for (const e of existing) initialMarks[e.studentId] = e.status;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1, minHeight: 0, overflowY: "auto" }}>
      <HostelAttendanceRoster date={date} session={session} residents={residents} initialMarks={initialMarks} canEdit={canEdit} />
      <HostelAttendanceReports absentToday={summary.absentToday} summary={summary.summary} />
    </div>
  );
}

async function VisitorsTab({ rooms, sdb }: { rooms: RoomsList; sdb: Awaited<ReturnType<typeof getScopedDb>> }) {
  const [visitorLogs, outingRequests] = await Promise.all([
    sdb.hostelVisitorLog.findMany({ include: { student: true }, orderBy: { checkInAt: "desc" }, take: 40 }),
    sdb.hostelOutingRequest.findMany({ include: { student: true }, orderBy: { requestedAt: "desc" }, take: 40 }),
  ]);
  const residents = rooms.flatMap((r) => r.allocations.map((a) => ({ id: a.studentId, name: studentName(a.student) })));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, flex: 1, minHeight: 0, overflowY: "auto" }}>
      <VisitorLogPanel
        students={residents}
        logs={visitorLogs.map((l) => ({ id: l.id, studentName: studentName(l.student), visitorName: l.visitorName, relation: l.relation, purpose: l.purpose, checkInAt: l.checkInAt.toISOString(), checkOutAt: l.checkOutAt?.toISOString() ?? null }))}
      />
      <OutingRequestsPanel
        requests={outingRequests.map((r) => ({ id: r.id, studentName: studentName(r.student), reason: r.reason, dateFrom: r.dateFrom.toISOString(), dateTo: r.dateTo.toISOString(), status: r.status }))}
      />
    </div>
  );
}

async function CanteenTab({ sdb }: { sdb: Awaited<ReturnType<typeof getScopedDb>> }) {
  const [menus, mealsServed] = await Promise.all([
    sdb.hostelMessMenu.findMany(),
    sdb.hostelMealServed.findMany({ orderBy: { date: "desc" }, take: 30 }),
  ]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, flex: 1, minHeight: 0, overflowY: "auto" }}>
      <MessMenuEditor menus={menus.map((m) => ({ dayOfWeek: m.dayOfWeek, mealType: m.mealType, menuText: m.menuText }))} />
      <MealsServedLog logs={mealsServed.map((m) => ({ id: m.id, date: m.date.toISOString(), mealType: m.mealType, description: m.description, headcount: m.headcount }))} />
    </div>
  );
}

async function MaintenanceTab({ rooms, sdb }: { rooms: RoomsList; sdb: Awaited<ReturnType<typeof getScopedDb>> }) {
  const logsRaw = await sdb.hostelMaintenanceLog.findMany({ include: { room: true, facility: { include: { room: true } } }, orderBy: { date: "desc" }, take: 60 });

  const targets: MaintenanceTarget[] = rooms.flatMap((r) => [
    { key: `room:${r.id}`, label: `${r.roomNo} (room)`, roomId: r.id },
    ...r.facilities.map((f) => ({ key: `facility:${f.id}`, label: `${r.roomNo} — ${f.label || (f.type === "TOILET" ? "Toilet" : "Shower")}`, facilityId: f.id })),
  ]);

  const logs: MaintenanceLogRow[] = logsRaw.map((l) => ({
    id: l.id,
    type: l.type,
    date: l.date.toISOString(),
    description: l.description,
    status: l.status,
    targetLabel: l.facility ? `${l.facility.room.roomNo} — ${l.facility.label || (l.facility.type === "TOILET" ? "Toilet" : "Shower")}` : l.room ? `${l.room.roomNo} (room)` : "—",
  }));

  return <MaintenancePanel targets={targets} logs={logs} />;
}

async function LaundryTab({ sdb, canEdit }: { sdb: Awaited<ReturnType<typeof getScopedDb>>; canEdit: boolean }) {
  const [allocations, tickets] = await Promise.all([
    sdb.hostelAllocation.findMany({ include: { student: true, room: true }, orderBy: { student: { firstName: "asc" } } }),
    sdb.laundryTicket.findMany({ include: { student: true, items: true }, orderBy: { submittedAt: "desc" }, take: 60 }),
  ]);

  const students: LaundryStudentOption[] = allocations.map((a) => ({ id: a.studentId, name: `${a.student.firstName} ${a.student.surname}`, roomNo: a.room.roomNo }));

  const roomByStudentId = new Map(allocations.map((a) => [a.studentId, a.room.roomNo]));
  const ticketRows: LaundryTicketRow[] = tickets.map((t) => ({
    id: t.id,
    tokenNo: t.tokenNo,
    studentName: `${t.student.firstName} ${t.student.surname}`,
    roomNo: roomByStudentId.get(t.studentId) ?? "—",
    submittedAt: t.submittedAt.toISOString(),
    collectionDate: t.collectionDate?.toISOString() ?? null,
    collectedAt: t.collectedAt?.toISOString() ?? null,
    status: t.status,
    items: t.items.map((i) => ({ itemType: i.itemType, quantity: i.quantity })),
  }));

  return <LaundryPanel students={students} tickets={ticketRows} canEdit={canEdit} />;
}

async function ParentHostelView() {
  const session = await auth();
  const sdb = await getScopedDb();

  const parent = await sdb.parent.findUnique({
    where: { userId: session!.user.id },
    include: {
      studentLinks: {
        include: {
          student: {
            include: {
              hostelAllocations: { include: { room: true, bed: true }, orderBy: { dateFrom: "desc" }, take: 1 },
              hostelOutingRequests: { orderBy: { requestedAt: "desc" }, take: 5 },
              hostelAttendance: { orderBy: { date: "desc" }, take: 15 },
            },
          },
        },
      },
    },
  });
  const students = parent?.studentLinks.map((l) => l.student) ?? [];

  return (
    <div style={{ padding: "26px 34px", display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="disp" style={{ fontSize: 21 }}>
        Hostel
      </div>
      {students.length === 0 && <div style={{ color: "var(--muted)" }}>No students linked to your account.</div>}
      {students.map((s) => (
        <div key={s.id} className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 14 }}>{studentName(s)}</div>
          {s.hostelAllocations[0] ? (
            <>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                Hostel room: <b style={{ color: "var(--ink)" }}>{s.hostelAllocations[0].room.roomNo}</b>
                {s.hostelAllocations[0].bed && <> · Bed <b style={{ color: "var(--ink)" }}>{s.hostelAllocations[0].bed.bedNo}</b></>}
              </div>
              {s.hostelAttendance.length > 0 && (
                <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(15,1fr)", gap: 4 }}>
                  {[...s.hostelAttendance].reverse().map((a) => {
                    const style =
                      a.status === "PRESENT"
                        ? { bg: "var(--good-tint)", fg: "var(--good)", mark: "P" }
                        : a.status === "ABSENT"
                          ? { bg: "var(--critical-tint)", fg: "var(--critical)", mark: "A" }
                          : { bg: "var(--warn-tint)", fg: "var(--warn)", mark: "L" };
                    return (
                      <div key={a.id} title={`${a.session} — ${a.date.toLocaleDateString("en-IN")}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, borderRadius: 6, padding: "6px 0", background: style.bg, color: style.fg }}>
                        <span className="mono" style={{ fontSize: 10, fontWeight: 700 }}>{a.date.getDate()}</span>
                        <span style={{ fontSize: 8, fontWeight: 700 }}>{style.mark}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {s.hostelOutingRequests.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                  {s.hostelOutingRequests.map((r) => {
                    const color = r.status === "APPROVED" ? "var(--good)" : r.status === "REJECTED" ? "var(--critical)" : "var(--warn)";
                    return (
                      <div key={r.id} style={{ fontSize: 11.5, display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--muted)" }}>
                          {r.reason} ({r.dateFrom.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}–{r.dateTo.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })})
                        </span>
                        <span style={{ fontWeight: 700, color }}>{r.status}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              <ParentOutingRequestForm studentId={s.id} />
            </>
          ) : (
            <div style={{ color: "var(--muted)", fontSize: 13.5 }}>Not allocated a hostel room.</div>
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
