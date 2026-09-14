import { auth } from "@/auth";
import { getScopedDb } from "@/lib/tenant-db";
import { getPermittedClassIds } from "@/lib/permissions";
import { formatINR, formatDate, daysUntil, studentName } from "@/lib/format";
import { RemindersPanel, StaffAvailabilityTile, PendingApprovalsPanel, NotesPanel } from "./DashboardWidgets";
import { AttendanceByClassChart, ResultsByClassChart, CashFlowChart } from "./DashboardCharts";

function StatTile({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="card" style={{ padding: "15px 17px" }}>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 7 }}>{label}</div>
      <div className="mono" style={{ fontSize: 23, fontWeight: 600, color: color ?? "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  const role = session!.user.role;
  const name = session!.user.name ?? "there";

  return (
    <div style={{ padding: "26px 34px", display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <div className="disp" style={{ fontSize: 21 }}>
          {greeting()}, {name.split(" ")[0]}
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{formatDate(new Date())}</div>
      </div>

      {role === "PARENT" ? <ParentDashboard /> : <AdminStaffDashboard />}
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

async function AdminStaffDashboard() {
  const session = await auth();
  const isAdmin = session!.user.role === "SCHOOL_ADMIN";
  const sdb = await getScopedDb();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [
    totalStudents,
    todaysAttendance,
    upcomingExam,
    teachingStaff,
    nonTeachingStaff,
    staffAttendanceToday,
    feesTodayAgg,
    reminderRows,
    noteRows,
    classes,
  ] = await Promise.all([
    sdb.student.count({ where: { status: "ACTIVE" } }),
    sdb.attendance.findMany({ where: { date: today } }),
    sdb.exam.findFirst({ where: { startDate: { gte: today } }, orderBy: { startDate: "asc" } }),
    sdb.staffProfile.findMany({ where: { staffCategory: "TEACHING" }, include: { user: true }, orderBy: { user: { name: "asc" } } }),
    sdb.staffProfile.findMany({ where: { staffCategory: "NON_TEACHING" }, include: { user: true }, orderBy: { user: { name: "asc" } } }),
    sdb.staffAttendance.findMany({ where: { date: today } }),
    sdb.feePayment.aggregate({ _sum: { amount: true }, where: { paidOn: { gte: today, lt: tomorrow } } }),
    sdb.dashboardReminder.findMany({ orderBy: [{ remindAt: "asc" }, { createdAt: "desc" }] }),
    sdb.dashboardNote.findMany({ orderBy: { createdAt: "desc" } }),
    sdb.class.findMany({ orderBy: [{ grade: "asc" }, { section: "asc" }] }),
  ]);

  const attendancePresent = todaysAttendance.filter((a) => a.status === "PRESENT").length;
  const feesToday = Number(feesTodayAgg._sum.amount ?? 0);

  const staffStatusById = new Map(staffAttendanceToday.map((a) => [a.staffId, a.status]));
  const teachingAvailability = teachingStaff.map((s) => ({ id: s.id, name: s.user.name, status: staffStatusById.get(s.id) ?? null }));
  const nonTeachingAvailability = nonTeachingStaff.map((s) => ({ id: s.id, name: s.user.name, status: staffStatusById.get(s.id) ?? null }));

  const reminders = reminderRows.map((r) => ({
    id: r.id,
    title: r.title,
    content: r.content,
    remindAt: r.remindAt ? r.remindAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }));
  const notes = noteRows.map((n) => ({ id: n.id, content: n.content, createdAt: n.createdAt.toISOString() }));

  // --- Pending approvals — scoped to what THIS viewer can actually act on.
  // Staff leave, Admissions and Accounts approval are School-Admin-only
  // workflows with no StaffPermission path at all (see actOnStaffLeave,
  // approveAdmissionWithFee/rejectAdmission, actOnTransactionApproval) — a
  // Staff session never sees them. Student leave has a real two-stage
  // flow: any class-teacher-equivalent Staff (Attendance EDIT, school-wide
  // or for that specific class) can act on the PENDING stage; only a
  // School Admin can give the CLASS_TEACHER_APPROVED stage's final
  // approval. Hostel outings gate on a school-wide Hostel EDIT grant only
  // (actOnOuting never scopes by class).
  const approvalItems: { label: string; count: number; href: string }[] = [];

  if (isAdmin) {
    const [staffLeavePending, studentLeavePending, hostelOutingPending, admissionsPending, accountsPending, announcementsPending] = await Promise.all([
      sdb.staffLeaveRequest.count({ where: { status: "PENDING" } }),
      sdb.studentLeaveRequest.count({ where: { stage: { in: ["PENDING", "CLASS_TEACHER_APPROVED"] } } }),
      sdb.hostelOutingRequest.count({ where: { status: "PENDING" } }),
      sdb.admissionEnquiry.count({ where: { approvalStatus: "PENDING" } }),
      sdb.accountsTransaction.count({ where: { approvalStatus: "PENDING" } }),
      sdb.announcement.count({ where: { approvalStatus: "PENDING" } }),
    ]);
    approvalItems.push(
      { label: "Staff leave requests", count: staffLeavePending, href: "/app/employees" },
      { label: "Student leave requests", count: studentLeavePending, href: "/app/attendance" },
      { label: "Hostel outing requests", count: hostelOutingPending, href: "/app/hostel" },
      { label: "Admission approvals", count: admissionsPending, href: "/app/admissions" },
      { label: "Accounts transactions", count: accountsPending, href: "/app/accounts" },
      { label: "Announcements awaiting approval", count: announcementsPending, href: "/app/communication" }
    );
  } else {
    const attendanceClassIds = await getPermittedClassIds("Attendance", "EDIT");
    if (attendanceClassIds === "ALL" || attendanceClassIds.size > 0) {
      const studentLeavePending = await sdb.studentLeaveRequest.count({
        where: {
          stage: "PENDING",
          ...(attendanceClassIds === "ALL" ? {} : { student: { classId: { in: Array.from(attendanceClassIds) } } }),
        },
      });
      approvalItems.push({ label: "Student leave requests awaiting you", count: studentLeavePending, href: "/app/attendance" });
    }

    const hostelClassIds = await getPermittedClassIds("Hostel", "EDIT");
    if (hostelClassIds === "ALL") {
      const hostelOutingPending = await sdb.hostelOutingRequest.count({ where: { status: "PENDING" } });
      approvalItems.push({ label: "Hostel outing requests", count: hostelOutingPending, href: "/app/hostel" });
    }
  }

  // --- Attendance by class — days present, for day / week / month ---
  const earliestAttendanceWindow = weekAgo < monthStart ? weekAgo : monthStart;
  const attendanceRecords = await sdb.attendance.findMany({
    where: { status: "PRESENT", date: { gte: earliestAttendanceWindow } },
    select: { date: true, student: { select: { classId: true } } },
  });
  function classCounts(from: Date, to: Date) {
    return classes.map((c) => ({
      label: `${c.grade}-${c.section}`,
      count: attendanceRecords.filter((a) => a.student.classId === c.id && a.date >= from && a.date <= to).length,
    }));
  }
  const attendanceByClass = {
    day: classCounts(today, today),
    week: classCounts(weekAgo, today),
    month: classCounts(monthStart, today),
  };

  // --- Exam results by class, filterable by subject ---
  const examsThisYear = await sdb.exam.findMany({
    where: { startDate: { gte: yearStart }, endDate: { lt: now }, approvalStatus: "APPROVED" },
    include: { class: true, examSubjects: { include: { subject: true, marks: true } } },
  });
  type Agg = { obtained: number; max: number };
  const perClassAll = new Map<string, Agg>();
  const perClassSubject = new Map<string, Map<string, Agg>>();
  const subjectNamesSet = new Set<string>();
  for (const ex of examsThisYear) {
    for (const es of ex.examSubjects) {
      subjectNamesSet.add(es.subject.name);
      for (const m of es.marks) {
        const obtained = Number(m.marksObtained);
        const max = es.maxMarks;
        const all = perClassAll.get(ex.classId) ?? { obtained: 0, max: 0 };
        all.obtained += obtained;
        all.max += max;
        perClassAll.set(ex.classId, all);
        let subMap = perClassSubject.get(ex.classId);
        if (!subMap) {
          subMap = new Map();
          perClassSubject.set(ex.classId, subMap);
        }
        const sub = subMap.get(es.subject.name) ?? { obtained: 0, max: 0 };
        sub.obtained += obtained;
        sub.max += max;
        subMap.set(es.subject.name, sub);
      }
    }
  }
  const subjectNames = Array.from(subjectNamesSet).sort();
  function pctFrom(agg: Agg | undefined): number | null {
    if (!agg || agg.max === 0) return null;
    return Math.round((agg.obtained / agg.max) * 100);
  }
  const resultsByClassData: Record<string, { label: string; pct: number | null }[]> = {
    "All subjects": classes.map((c) => ({ label: `${c.grade}-${c.section}`, pct: pctFrom(perClassAll.get(c.id)) })),
  };
  for (const subj of subjectNames) {
    resultsByClassData[subj] = classes.map((c) => ({ label: `${c.grade}-${c.section}`, pct: pctFrom(perClassSubject.get(c.id)?.get(subj)) }));
  }

  // --- Accounts money flow, bucketed for day / week / month / year ---
  const fiveYearsAgo = new Date(now.getFullYear() - 4, 0, 1);
  const allTxns = await sdb.accountsTransaction.findMany({ where: { date: { gte: fiveYearsAgo }, approvalStatus: { not: "PENDING" } } });
  function sumFlow(txns: typeof allTxns) {
    return {
      income: txns.filter((t) => t.type === "INCOME").reduce((s, t) => s + Number(t.amount), 0),
      expense: txns.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + Number(t.amount), 0),
    };
  }
  const dayBuckets = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (13 - i));
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    return { label: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }), ...sumFlow(allTxns.filter((t) => t.date >= d && t.date < next)) };
  });
  const weekBuckets = Array.from({ length: 8 }, (_, i) => {
    const weeksAgo = 7 - i;
    const end = new Date(today);
    end.setDate(end.getDate() + 1 - weeksAgo * 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 7);
    return { label: `Wk of ${start.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`, ...sumFlow(allTxns.filter((t) => t.date >= start && t.date < end)) };
  });
  const monthBuckets = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return { label: d.toLocaleDateString("en-IN", { month: "short" }), ...sumFlow(allTxns.filter((t) => t.date >= d && t.date < next)) };
  });
  const yearBuckets = Array.from({ length: 5 }, (_, i) => {
    const y = now.getFullYear() - 4 + i;
    const start = new Date(y, 0, 1);
    const end = new Date(y + 1, 0, 1);
    return { label: String(y), ...sumFlow(allTxns.filter((t) => t.date >= start && t.date < end)) };
  });
  const cashFlow = { day: dayBuckets, week: weekBuckets, month: monthBuckets, year: yearBuckets };

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 13 }}>
        <StatTile label="Students present today" value={`${attendancePresent} / ${totalStudents}`} color="var(--teal)" />
        <StaffAvailabilityTile label="Teaching staff today" staff={teachingAvailability} />
        <StaffAvailabilityTile label="Non-teaching staff today" staff={nonTeachingAvailability} />
        <StatTile label="Fees collected today" value={formatINR(feesToday)} color="var(--marigold-deep)" />
        <StatTile
          label="Next exam"
          value={
            upcomingExam ? (
              <>
                {daysUntil(upcomingExam.startDate)}d
                <div style={{ fontSize: 11, color: "var(--faint)", fontWeight: 500, marginTop: 2 }}>{upcomingExam.name}</div>
              </>
            ) : (
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--faint)" }}>None scheduled</span>
            )
          }
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "0.34fr 0.66fr", gridTemplateRows: "repeat(3, minmax(320px, 1fr))", gap: 16 }}>
        <RemindersPanel reminders={reminders} />
        <AttendanceByClassChart data={attendanceByClass} />

        <PendingApprovalsPanel items={approvalItems} />
        <ResultsByClassChart subjects={subjectNames} data={resultsByClassData} />

        <NotesPanel notes={notes} />
        <CashFlowChart data={cashFlow} />
      </div>
    </>
  );
}

async function ParentDashboard() {
  const session = await auth();
  const sdb = await getScopedDb();
  const today = new Date(new Date().setHours(0, 0, 0, 0));

  const parent = await sdb.parent.findUnique({
    where: { userId: session!.user.id },
    include: {
      studentLinks: {
        include: {
          student: {
            include: {
              class: true,
              attendance: { where: { date: today }, take: 1 },
              homeworkSubmissions: { where: { status: "PENDING" }, include: { assignment: true } },
              feePayments: true,
            },
          },
        },
      },
    },
  });

  const students = parent?.studentLinks.map((l) => l.student) ?? [];

  if (students.length === 0) {
    return (
      <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
        No students are linked to your account yet. Contact your school office if this seems wrong.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {students.map((student) => (
        <div key={student.id} className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700 }}>{studentName(student)}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
              Grade {student.class.grade}
              {student.class.section} · {student.admissionNo}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 13 }}>
            <StatTile
              label="Today's attendance"
              value={
                student.attendance[0] ? (
                  <span
                    style={{
                      fontSize: 15,
                      color:
                        student.attendance[0].status === "PRESENT"
                          ? "var(--good)"
                          : student.attendance[0].status === "ABSENT"
                            ? "var(--critical)"
                            : "var(--warn)",
                    }}
                  >
                    {student.attendance[0].status.replace("_", " ")}
                  </span>
                ) : (
                  <span style={{ fontSize: 14, color: "var(--faint)" }}>Not marked yet</span>
                )
              }
            />
            <StatTile label="Pending homework" value={student.homeworkSubmissions.length} />
            <StatTile label="Fee payments made" value={student.feePayments.length} />
          </div>
        </div>
      ))}
    </div>
  );
}
