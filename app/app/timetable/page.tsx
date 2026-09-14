import { auth } from "@/auth";
import { getScopedDb } from "@/lib/tenant-db";
import { requireModuleAccess, getPermittedClassIds } from "@/lib/permissions";
import { formatDate, studentName } from "@/lib/format";
import { subjectStyleFor } from "@/lib/academic";
import { hasFeature } from "@/lib/feature-flags";
import { getTeacherWorkload } from "./depth-actions";
import TimetableFilter from "./TimetableFilter";
import TimetableGrid from "./TimetableGrid";
import RoomsPanel from "./RoomsPanel";
import type { DayOfWeek } from "@prisma/client";

function todayColumn() {
  const day = new Date().getDay(); // 0=Sun..6=Sat
  return day === 0 ? -1 : day - 1; // Mon=0..Sat=5, Sunday has no column
}

async function buildGrid(sdb: Awaited<ReturnType<typeof getScopedDb>>, classId: string) {
  const slots = await sdb.timetableSlot.findMany({ where: { classId }, include: { subject: true, staff: { include: { user: true } }, room: true } });
  const grid: Record<number, Partial<Record<DayOfWeek, { subjectId: string; subjectName: string; staffId: string; staffName: string; roomId: string | null; roomName: string | null }>>> = {};
  for (const slot of slots) {
    grid[slot.periodNo] = grid[slot.periodNo] ?? {};
    grid[slot.periodNo]![slot.dayOfWeek] = {
      subjectId: slot.subjectId,
      subjectName: slot.subject.name,
      staffId: slot.staffId,
      staffName: slot.staff.user.name,
      roomId: slot.roomId,
      roomName: slot.room?.name ?? null,
    };
  }
  return grid;
}

export default async function TimetablePage({ searchParams }: { searchParams: Promise<{ classId?: string }> }) {
  const session = await auth();
  const params = await searchParams;
  const sdb = await getScopedDb();

  if (session!.user.role === "PARENT") {
    return <ParentTimetableView />;
  }

  const permittedClassIds = await getPermittedClassIds("Timetable", "VIEW");
  if (permittedClassIds !== "ALL" && permittedClassIds.size === 0) {
    await requireModuleAccess("Timetable", "VIEW");
  }

  const [classesRaw, subjects, staff, showRooms, rooms, workload] = await Promise.all([
    sdb.class.findMany({ orderBy: [{ grade: "asc" }, { section: "asc" }], include: { classTeacher: { include: { user: true } } } }),
    sdb.subject.findMany({ orderBy: { name: "asc" } }),
    sdb.staffProfile.findMany({ include: { user: true }, orderBy: { user: { name: "asc" } } }),
    hasFeature(session!.user.schoolId, "timetable.roomsAndConflicts"),
    sdb.room.findMany({ orderBy: { name: "asc" } }),
    getTeacherWorkload(),
  ]);
  const classes = permittedClassIds === "ALL" ? classesRaw : classesRaw.filter((c) => permittedClassIds.has(c.id));

  const classId = params.classId ?? classes[0]?.id ?? "";
  const selectedClass = classes.find((c) => c.id === classId);
  const grid = classId ? await buildGrid(sdb, classId) : {};

  // Per-class access — a staffer can have EDIT on one class's timetable and
  // only VIEW (or none) on another.
  const accessLevel = classId ? await requireModuleAccess("Timetable", "VIEW", classId) : "NONE";
  const canEdit = accessLevel === "EDIT";

  return (
    <div style={{ padding: "22px 30px", display: "flex", flexDirection: "column", gap: 13, height: "100dvh", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div className="disp" style={{ fontSize: 21 }}>
            Timetable
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{formatDate(new Date())}</div>
        </div>
        <TimetableFilter classes={classes} classId={classId} classTeacherName={selectedClass?.classTeacher?.user.name ?? null} />
      </div>

      <div className="card" style={{ padding: "10px 18px", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", fontSize: 11.5, color: "var(--muted)" }}>
        {subjects.map((s) => (
          <span key={s.id}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: subjectStyleFor(s.name).fg, marginRight: 5 }} />
            {s.name}
          </span>
        ))}
      </div>

      {showRooms && (
        <div className="card" style={{ padding: "12px 18px", display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
          <RoomsPanel rooms={rooms.map((r) => ({ id: r.id, name: r.name, capacity: r.capacity, equipmentNote: r.equipmentNote }))} />
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 6 }}>
              Teacher workload (periods/week)
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 100, overflowY: "auto" }}>
              {workload.slice(0, 6).map((w) => (
                <div key={w.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
                  <span>{w.name}</span>
                  <span className="mono" style={{ fontWeight: 700, color: w.count > 30 ? "var(--critical)" : "var(--muted)" }}>{w.count}</span>
                </div>
              ))}
              {workload.length === 0 && <div style={{ fontSize: 11.5, color: "var(--muted)" }}>No slots scheduled yet.</div>}
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "84px repeat(6,1fr)", borderBottom: "1px solid var(--line)", flex: "none" }}>
          <div style={{ padding: "9px 12px", fontSize: 10, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em", borderRight: "1px solid var(--line)" }}>Period</div>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
            <div
              key={d}
              style={{
                padding: "9px 0",
                textAlign: "center",
                fontSize: 12.5,
                fontWeight: 700,
                borderRight: i === 5 ? "none" : "1px solid var(--line)",
                color: i === todayColumn() ? "var(--marigold-deep)" : "var(--ink)",
              }}
            >
              {d} {i === todayColumn() && <span className="mono" style={{ fontSize: 9.5, fontWeight: 600 }}>· Today</span>}
            </div>
          ))}
        </div>
        {classId ? (
          <TimetableGrid
            classId={classId}
            grid={grid}
            subjects={subjects}
            staff={staff.map((s) => ({ id: s.id, name: s.user.name }))}
            todayCol={todayColumn()}
            canEdit={canEdit}
            rooms={rooms.map((r) => ({ id: r.id, name: r.name }))}
            showRooms={showRooms}
          />
        ) : (
          <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>No classes set up yet.</div>
        )}
      </div>
    </div>
  );
}

async function ParentTimetableView() {
  const session = await auth();
  const sdb = await getScopedDb();

  const parent = await sdb.parent.findUnique({
    where: { userId: session!.user.id },
    include: { studentLinks: { include: { student: { include: { class: true } } } } },
  });
  const student = parent?.studentLinks[0]?.student;

  if (!student) {
    return (
      <div style={{ padding: "26px 34px" }}>
        <div className="disp" style={{ fontSize: 21, marginBottom: 12 }}>
          Timetable
        </div>
        <div style={{ color: "var(--muted)" }}>No students linked to your account.</div>
      </div>
    );
  }

  const [subjects, grid] = await Promise.all([sdb.subject.findMany({ orderBy: { name: "asc" } }), buildGrid(sdb, student.classId)]);

  return (
    <div style={{ padding: "22px 30px", display: "flex", flexDirection: "column", gap: 13, height: "100dvh", boxSizing: "border-box" }}>
      <div className="disp" style={{ fontSize: 21 }}>
        Timetable · {studentName(student)} · Class {student.class.grade}-{student.class.section}
      </div>
      <div className="card" style={{ padding: 0, flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "84px repeat(6,1fr)", borderBottom: "1px solid var(--line)", flex: "none" }}>
          <div style={{ padding: "9px 12px", fontSize: 10, color: "var(--faint)", textTransform: "uppercase" }}>Period</div>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} style={{ padding: "9px 0", textAlign: "center", fontSize: 12.5, fontWeight: 700 }}>
              {d}
            </div>
          ))}
        </div>
        <TimetableGrid classId={student.classId} grid={grid} subjects={subjects} staff={[]} todayCol={todayColumn()} canEdit={false} rooms={[]} showRooms={false} />
      </div>
    </div>
  );
}
