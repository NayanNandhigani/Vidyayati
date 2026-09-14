import { auth } from "@/auth";
import { getScopedDb } from "@/lib/tenant-db";
import { requireModuleAccess, getPermittedClassIds } from "@/lib/permissions";
import { studentName } from "@/lib/format";
import { hasFeature } from "@/lib/feature-flags";
import { getAttendanceFlags } from "./depth-actions";
import AttendanceFilters from "./AttendanceFilters";
import AttendanceRoster from "./AttendanceRoster";
import LeaveRequestsPanel from "./LeaveRequestsPanel";
import AttendanceFlagsPanel from "./AttendanceFlagsPanel";
import ParentLeaveForm from "./ParentLeaveForm";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ classId?: string; date?: string }> }) {
  const session = await auth();
  const params = await searchParams;
  const sdb = await getScopedDb();

  if (session!.user.role === "PARENT") {
    return <ParentAttendanceView />;
  }

  // A staffer scoped to specific classes (no school-wide row) still needs
  // to reach this page — requireModuleAccess() with no classId would
  // incorrectly reject them, since it only resolves the school-wide grant.
  // Attendance access is tied to actually teaching a class (class teacher
  // or co-teacher — see setClassTeacher/addCoTeacher in the Academic
  // Management module), not a general permission toggle, so a Staff
  // session with no class assignment at all is a normal, expected state
  // now — show a plain explanation instead of throwing to the generic
  // error boundary.
  const permittedClassIds = await getPermittedClassIds("Attendance", "VIEW");
  if (session!.user.role === "STAFF" && permittedClassIds !== "ALL" && permittedClassIds.size === 0) {
    return (
      <div style={{ padding: "26px 34px" }}>
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--muted)", maxWidth: 460, margin: "0 auto" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)", marginBottom: 6 }}>No class assigned to you yet</div>
          <div style={{ fontSize: 13 }}>
            Attendance is only visible to a class's teacher or co-teacher. Ask your School Admin to assign you in Academic Management → Classes &amp; Sections.
          </div>
        </div>
      </div>
    );
  }

  const classesRaw = await sdb.class.findMany({ orderBy: [{ grade: "asc" }, { section: "asc" }] });
  const classes = permittedClassIds === "ALL" ? classesRaw : classesRaw.filter((c) => permittedClassIds.has(c.id));
  const classId = params.classId ?? classes[0]?.id ?? "";
  const date = params.date ?? todayISO();

  // Resolve actual per-class access — a staffer can have EDIT on one class
  // and only VIEW (or none) on another. Throws if classId itself isn't
  // permitted at all (e.g. a manipulated ?classId=), consistent with how
  // insufficient access is handled elsewhere in this codebase.
  const accessLevel = classId ? await requireModuleAccess("Attendance", "VIEW", classId) : "NONE";
  const canEdit = accessLevel === "EDIT";

  const students = classId
    ? await sdb.student.findMany({
        where: { classId, status: "ACTIVE" },
        orderBy: [{ firstName: "asc" }, { surname: "asc" }],
        select: { id: true, firstName: true, surname: true, admissionNo: true },
      })
    : [];

  const existing = classId
    ? await sdb.attendance.findMany({ where: { date: new Date(`${date}T00:00:00`), studentId: { in: students.map((s) => s.id) } } })
    : [];
  const initialMarks: Record<string, "PRESENT" | "ABSENT" | "HALF_DAY"> = {};
  for (const a of existing) initialMarks[a.studentId] = a.status;

  const isAdmin = session!.user.role === "SCHOOL_ADMIN";
  const [showLeaveWorkflow, showFlags] = await Promise.all([
    hasFeature(session!.user.schoolId, "attendance.studentLeave"),
    hasFeature(session!.user.schoolId, "attendance.defaulterAlerts"),
  ]);

  let leaveRequests: { id: string; studentName: string; className: string; dateFrom: string; dateTo: string; reason: string; stage: "PENDING" | "CLASS_TEACHER_APPROVED" | "ADMIN_APPROVED" | "REJECTED"; rejectionNote: string | null }[] = [];
  if (showLeaveWorkflow) {
    const classFilter = permittedClassIds === "ALL" ? {} : { classId: { in: [...permittedClassIds] } };
    const reqs = await sdb.studentLeaveRequest.findMany({
      where: { stage: { in: ["PENDING", "CLASS_TEACHER_APPROVED"] }, student: classFilter },
      include: { student: { include: { class: true } } },
      orderBy: { requestedAt: "desc" },
    });
    leaveRequests = reqs.map((r) => ({
      id: r.id,
      studentName: `${r.student.firstName} ${r.student.surname}`,
      className: `${r.student.class.grade}-${r.student.class.section}`,
      dateFrom: r.dateFrom.toISOString(),
      dateTo: r.dateTo.toISOString(),
      reason: r.reason,
      stage: r.stage,
      rejectionNote: r.rejectionNote,
    }));
  }

  const flags = showFlags ? await getAttendanceFlags() : { defaulters: [], consecutiveAbsentees: [] };
  const school = showFlags ? await sdb.school.findUnique({ where: { id: session!.user.schoolId! }, select: { attendanceDefaulterThresholdPct: true, consecutiveAbsenceAlertDays: true } }) : null;

  return (
    <div style={{ padding: "26px 34px", display: "flex", flexDirection: "column", gap: 16, height: "100dvh", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
        <AttendanceFilters classes={classes} classId={classId} date={date} />
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <AttendanceRoster classId={classId} date={date} students={students} initialMarks={initialMarks} canEdit={canEdit} />
        {showLeaveWorkflow && <LeaveRequestsPanel requests={leaveRequests} isAdmin={isAdmin} canActAsClassTeacher={canEdit} />}
        {showFlags && (
          <AttendanceFlagsPanel
            defaulters={flags.defaulters}
            consecutiveAbsentees={flags.consecutiveAbsentees}
            isAdmin={isAdmin}
            defaulterPct={school?.attendanceDefaulterThresholdPct ?? null}
            consecutiveDays={school?.consecutiveAbsenceAlertDays ?? null}
          />
        )}
      </div>
    </div>
  );
}

async function ParentAttendanceView() {
  const session = await auth();
  const sdb = await getScopedDb();
  const showLeave = await hasFeature(session!.user.schoolId, "attendance.studentLeave");

  const parent = await sdb.parent.findUnique({
    where: { userId: session!.user.id },
    include: {
      studentLinks: {
        include: {
          student: {
            include: { class: true, attendance: { orderBy: { date: "desc" }, take: 30 } },
          },
        },
      },
    },
  });

  const students = parent?.studentLinks.map((l) => l.student) ?? [];
  const leaveByStudent = new Map<string, { id: string; dateFrom: string; dateTo: string; reason: string; stage: string; rejectionNote: string | null }[]>();
  if (showLeave) {
    for (const s of students) {
      const reqs = await sdb.studentLeaveRequest.findMany({ where: { studentId: s.id }, orderBy: { requestedAt: "desc" } });
      leaveByStudent.set(
        s.id,
        reqs.map((r) => ({ id: r.id, dateFrom: r.dateFrom.toISOString(), dateTo: r.dateTo.toISOString(), reason: r.reason, stage: r.stage, rejectionNote: r.rejectionNote }))
      );
    }
  }

  return (
    <div style={{ padding: "26px 34px", display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="disp" style={{ fontSize: 21 }}>
        Attendance
      </div>
      {students.length === 0 && <div style={{ color: "var(--muted)" }}>No students linked to your account.</div>}
      {students.map((s) => {
        const present = s.attendance.filter((a) => a.status === "PRESENT").length;
        const pct = s.attendance.length ? Math.round((present / s.attendance.length) * 100) : null;
        return (
          <div key={s.id} className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontSize: 15.5, fontWeight: 700 }}>{studentName(s)}</div>
              <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: "var(--teal)" }}>
                {pct === null ? "No data" : `${pct}% present`}
              </div>
            </div>
            {s.attendance.length === 0 ? (
              <div style={{ color: "var(--muted)", fontSize: 13.5 }}>No attendance recorded yet.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(10,1fr)", gap: 6 }}>
                {[...s.attendance].reverse().map((a, i) => {
                  const style =
                    a.status === "PRESENT"
                      ? { bg: "var(--good-tint)", fg: "var(--good)", mark: "P" }
                      : a.status === "ABSENT"
                        ? { bg: "var(--critical-tint)", fg: "var(--critical)", mark: "A" }
                        : { bg: "var(--warn-tint)", fg: "var(--warn)", mark: "H" };
                  return (
                    <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, borderRadius: 6, padding: "7px 0", background: style.bg, color: style.fg }}>
                      <span className="mono" style={{ fontSize: 11, fontWeight: 700 }}>
                        {a.date.getDate()}
                      </span>
                      <span style={{ fontSize: 8, fontWeight: 700 }}>{style.mark}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {showLeave && <ParentLeaveForm studentId={s.id} requests={leaveByStudent.get(s.id) ?? []} />}
          </div>
        );
      })}
    </div>
  );
}
