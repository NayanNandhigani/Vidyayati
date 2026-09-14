import Link from "next/link";
import { auth } from "@/auth";
import { getScopedDb } from "@/lib/tenant-db";
import { requireModuleAccess, getPermittedClassIds } from "@/lib/permissions";
import { daysUntil, studentName } from "@/lib/format";
import { gradeFor, gradeForScale, gradeColor } from "@/lib/academic";
import { hasFeature } from "@/lib/feature-flags";
import { getSeating, canViewExamResults } from "./depth-actions";
import ExamMarksGrid from "./ExamMarksGrid";
import ExamDepthPanel from "./ExamDepthPanel";
import ExamPicker from "./ExamPicker";
import ScheduleExamPanel from "./ScheduleExamPanel";
import ReportCardPanel from "./ReportCardPanel";
import HallTicketPanel from "./HallTicketPanel";

const TABS = ["schedule", "grades", "report-card", "hall-ticket"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = { schedule: "Schedule Exam", grades: "Grades", "report-card": "Report Card", "hall-ticket": "Hall Ticket" };

const APPROVAL_PILL: Record<string, { bg: string; fg: string; label: string }> = {
  PENDING: { bg: "var(--warn-tint)", fg: "var(--warn)", label: "Pending approval" },
  APPROVED: { bg: "var(--good-tint)", fg: "var(--good)", label: "Approved" },
  REJECTED: { bg: "var(--critical-tint)", fg: "var(--critical)", label: "Rejected" },
};

export default async function ExamsPage({ searchParams }: { searchParams: Promise<{ tab?: string; exam?: string; classId?: string }> }) {
  const session = await auth();
  const params = await searchParams;
  const sdb = await getScopedDb();

  if (session!.user.role === "PARENT") {
    return <ParentExamsView />;
  }

  // Same reasoning as Attendance/Students: a class-scoped staffer with no
  // school-wide row must still reach this page — only reject up front when
  // they have no permitted classes at all.
  const permittedClassIds = await getPermittedClassIds("Exams", "VIEW");
  if (permittedClassIds !== "ALL" && permittedClassIds.size === 0) {
    await requireModuleAccess("Exams", "VIEW");
  }

  const tab: Tab = TABS.includes(params.tab as Tab) ? (params.tab as Tab) : "schedule";

  const currentYear = await sdb.academicYear.findFirst({ where: { isCurrent: true }, include: { gradeScale: { include: { bands: true } } } });
  const gradeBands = currentYear?.gradeScale?.bands.map((b) => ({ label: b.label, minPercent: Number(b.minPercent), maxPercent: Number(b.maxPercent) })) ?? [];
  const gradeForPct = (pct: number) => gradeForScale(pct, gradeBands) ?? gradeFor(pct);
  const examsRaw = currentYear
    ? await sdb.exam.findMany({ where: { yearId: currentYear.id }, include: { class: true }, orderBy: { startDate: "asc" } })
    : [];
  const exams = permittedClassIds === "ALL" ? examsRaw : examsRaw.filter((e) => permittedClassIds.has(e.classId));

  const now = new Date();
  const selectedExam = exams.find((e) => e.id === params.exam) ?? exams.find((e) => e.endDate >= now) ?? exams[exams.length - 1];

  const classId = params.classId ?? selectedExam?.classId ?? "";
  // Unlike Attendance's classId (near-always populated via a class picker),
  // selectedExam only exists once an exam has already been created — a
  // school's very first visit to this page, before scheduling anything,
  // has no selectedExam. Falling back to "NONE" there (as if the user had
  // no access) hid the "+ Schedule Exam" button behind a chicken-and-egg
  // deadlock for every school. Resolve the school-wide grant instead
  // (still correctly "EDIT" for a School Admin, or a staff member's real
  // school-wide StaffPermission row, or "NONE" if they truly have none).
  const accessLevel = await requireModuleAccess("Exams", "VIEW", selectedExam?.classId);
  const canEdit = accessLevel === "EDIT";
  const isSchoolAdmin = session!.user.role === "SCHOOL_ADMIN";

  const [examSubjects, allSubjects] = await Promise.all([
    selectedExam
      ? sdb.examSubject.findMany({ where: { examId: selectedExam.id }, include: { subject: true }, orderBy: { subject: { name: "asc" } } })
      : Promise.resolve([]),
    sdb.subject.findMany({ orderBy: { name: "asc" } }),
  ]);

  const students = classId
    ? await sdb.student.findMany({ where: { classId, status: "ACTIVE" }, orderBy: [{ firstName: "asc" }, { surname: "asc" }], select: { id: true, firstName: true, surname: true, admissionNo: true } })
    : [];

  const marks = selectedExam
    ? await sdb.mark.findMany({ where: { examSubject: { examId: selectedExam.id }, studentId: { in: students.map((s) => s.id) } } })
    : [];
  const initialMarks: Record<string, Record<string, number>> = {};
  for (const m of marks) {
    initialMarks[m.studentId] = initialMarks[m.studentId] ?? {};
    initialMarks[m.studentId][m.examSubjectId] = Number(m.marksObtained);
  }

  const [showSeating, showResultRelease, rooms, school] = await Promise.all([
    hasFeature(session!.user.schoolId, "exams.seatingAndBulkMarks"),
    hasFeature(session!.user.schoolId, "exams.resultRelease"),
    sdb.room.findMany({ orderBy: { name: "asc" } }),
    sdb.school.findUnique({ where: { id: session!.user.schoolId! }, select: { resultsLockUntilFeesCleared: true } }),
  ]);
  const seating = selectedExam && showSeating ? await getSeating(selectedExam.id) : [];

  const examOptions = exams.map((e) => ({ id: e.id, classId: e.classId, label: `${e.name} · Class ${e.class.grade}-${e.class.section}` }));

  // Report Card rows — total/percentage/grade/rank per student, computed
  // once here from the same marks data ExamMarksGrid already uses, so the
  // panel and the downloadable PDF (app/api/exams/[examId]/report-card/pdf)
  // agree with what's on screen.
  const maxTotal = examSubjects.reduce((s, es) => s + es.maxMarks, 0);
  const totals = students.map((s) => {
    const row = initialMarks[s.id] ?? {};
    return { student: s, total: examSubjects.reduce((sum, es) => sum + (row[es.id] ?? 0), 0) };
  });
  const ranked = [...totals].sort((a, b) => b.total - a.total);
  const reportCardRows = totals.map(({ student: s, total }) => {
    const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
    return { id: s.id, name: studentName(s), total, maxTotal, pct, grade: gradeForPct(pct), rank: ranked.findIndex((r) => r.student.id === s.id) + 1 };
  });

  const hallTicketRows = students.map((s) => ({ id: s.id, name: studentName(s), admissionNo: s.admissionNo }));

  const tabHref = (t: Tab) => `/app/exams?tab=${t}${selectedExam ? `&exam=${selectedExam.id}&classId=${selectedExam.classId}` : ""}`;

  return (
    <div style={{ padding: "26px 34px", display: "flex", flexDirection: "column", gap: 14, height: "100dvh", boxSizing: "border-box", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="disp" style={{ fontSize: 21 }}>
          Exams {currentYear && <span style={{ fontSize: 14, fontWeight: 500, color: "var(--faint)" }}>· {currentYear.label}</span>}
        </div>
        {canEdit && tab === "schedule" && (
          <Link href="/app/exams/new" style={{ background: "var(--marigold)", color: "#fff", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            + Schedule Exam
          </Link>
        )}
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid var(--line)" }}>
        {TABS.map((t) => (
          <Link
            key={t}
            href={tabHref(t)}
            style={{ padding: "10px 2px", marginRight: 26, fontSize: 13.5, fontWeight: tab === t ? 700 : 600, color: tab === t ? "var(--ink)" : "var(--muted)", borderBottom: tab === t ? "2px solid var(--marigold)" : "2px solid transparent", textDecoration: "none" }}
          >
            {TAB_LABEL[t]}
          </Link>
        ))}
      </div>

      {exams.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
          No exams scheduled yet for {currentYear?.label ?? "this year"}.
        </div>
      ) : tab === "schedule" ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(3, exams.length)},1fr)`, gap: 13 }}>
            {exams.map((e) => {
              const isSelected = e.id === selectedExam?.id;
              const completed = e.endDate < now;
              const upcoming = e.startDate > now;
              const approval = APPROVAL_PILL[e.approvalStatus];
              return (
                <Link
                  key={e.id}
                  href={`/app/exams?tab=schedule&exam=${e.id}&classId=${e.classId}`}
                  className="card"
                  style={{
                    padding: "13px 17px",
                    textDecoration: "none",
                    color: "inherit",
                    border: isSelected ? "2px solid var(--marigold)" : "1px solid var(--line)",
                    background: isSelected ? "var(--marigold-tint)" : "var(--card)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5 }}>{e.name}</div>
                    <span
                      className="pill"
                      style={
                        completed
                          ? { background: "var(--good-tint)", color: "var(--good)" }
                          : upcoming
                            ? { background: "var(--marigold-tint)", color: "var(--marigold-deep)" }
                            : { background: "var(--line)", color: "var(--faint)" }
                      }
                    >
                      {completed ? "Completed" : upcoming ? `Upcoming · ${daysUntil(e.startDate)}d` : "Ongoing"}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink2)", marginTop: 4, fontWeight: 600 }}>
                    {e.startDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} – {e.endDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} · Class {e.class.grade}-{e.class.section}
                  </div>
                  <span className="pill" style={{ background: approval.bg, color: approval.fg, marginTop: 6, display: "inline-block" }}>
                    {approval.label}
                  </span>
                </Link>
              );
            })}
          </div>

          {selectedExam && (
            <ScheduleExamPanel
              examId={selectedExam.id}
              examName={selectedExam.name}
              startDate={selectedExam.startDate.toISOString().slice(0, 10)}
              endDate={selectedExam.endDate.toISOString().slice(0, 10)}
              classLabel={`${selectedExam.class.grade}-${selectedExam.class.section}`}
              approvalStatus={selectedExam.approvalStatus}
              isSchoolAdmin={isSchoolAdmin}
              canEdit={canEdit}
              examSubjects={examSubjects.map((es) => ({ id: es.id, subjectId: es.subjectId, name: es.subject.name, maxMarks: es.maxMarks }))}
              allSubjects={allSubjects}
            />
          )}
          {selectedExam && (
            <ExamDepthPanel
              examId={selectedExam.id}
              canEdit={canEdit}
              showSeating={showSeating}
              rooms={rooms.map((r) => ({ id: r.id, name: r.name }))}
              seating={seating}
              showResultRelease={showResultRelease}
              resultReleaseAt={selectedExam.resultReleaseAt?.toISOString() ?? null}
              feeLockEnabled={school?.resultsLockUntilFeesCleared ?? false}
            />
          )}
        </>
      ) : tab === "grades" ? (
        <>
          <ExamPicker exams={examOptions} selectedExamId={selectedExam?.id ?? null} tab="grades" />
          {selectedExam ? (
            <ExamMarksGrid
              examId={selectedExam.id}
              examName={selectedExam.name}
              className={`${selectedExam.class.grade}-${selectedExam.class.section}`}
              students={students}
              examSubjects={examSubjects}
              initialMarks={initialMarks}
              canEdit={canEdit}
              gradeBands={gradeBands}
            />
          ) : (
            <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
              Select an exam to enter marks.
            </div>
          )}
        </>
      ) : tab === "report-card" ? (
        <>
          <ExamPicker exams={examOptions} selectedExamId={selectedExam?.id ?? null} tab="report-card" />
          {selectedExam ? (
            <ReportCardPanel examId={selectedExam.id} examApproved={selectedExam.approvalStatus === "APPROVED"} rows={reportCardRows} />
          ) : (
            <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
              Select an exam to view report cards.
            </div>
          )}
        </>
      ) : (
        <>
          <ExamPicker exams={examOptions} selectedExamId={selectedExam?.id ?? null} tab="hall-ticket" />
          {selectedExam ? (
            <HallTicketPanel examId={selectedExam.id} examApproved={selectedExam.approvalStatus === "APPROVED"} rows={hallTicketRows} />
          ) : (
            <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
              Select an exam to generate hall tickets.
            </div>
          )}
        </>
      )}
    </div>
  );
}

async function ParentExamsView() {
  const session = await auth();
  const sdb = await getScopedDb();

  const parent = await sdb.parent.findUnique({
    where: { userId: session!.user.id },
    include: {
      studentLinks: {
        include: {
          student: {
            include: {
              class: true,
              marks: { include: { examSubject: { include: { exam: true, subject: true } } } },
            },
          },
        },
      },
    },
  });

  const students = parent?.studentLinks.map((l) => l.student) ?? [];

  const currentYear = await sdb.academicYear.findFirst({ where: { isCurrent: true }, include: { gradeScale: { include: { bands: true } } } });
  const gradeBands = currentYear?.gradeScale?.bands.map((b) => ({ label: b.label, minPercent: Number(b.minPercent), maxPercent: Number(b.maxPercent) })) ?? [];
  const gradeForPct = (pct: number) => gradeForScale(pct, gradeBands) ?? gradeFor(pct);

  // Precompute per-exam visibility (release date / fee lock) before
  // rendering — canViewExamResults is async, so this can't happen inline
  // inside a .map() callback in the JSX below.
  const resultsByStudent = await Promise.all(
    students.map(async (s) => {
      const byExam = new Map<string, { examId: string; name: string; date: Date; obtained: number; max: number }>();
      for (const m of s.marks) {
        const exam = m.examSubject.exam;
        const entry = byExam.get(exam.id) ?? { examId: exam.id, name: exam.name, date: exam.startDate, obtained: 0, max: 0 };
        entry.obtained += Number(m.marksObtained);
        entry.max += m.examSubject.maxMarks;
        byExam.set(exam.id, entry);
      }
      const raw = [...byExam.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
      const results = await Promise.all(
        raw.map(async (r) => ({ ...r, ...(await canViewExamResults(r.examId, s.id)) }))
      );
      return { student: s, results };
    })
  );

  return (
    <div style={{ padding: "26px 34px", display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="disp" style={{ fontSize: 21 }}>
        Exam Results
      </div>
      {students.length === 0 && <div style={{ color: "var(--muted)" }}>No students linked to your account.</div>}
      {resultsByStudent.map(({ student: s, results }) => (
        <div key={s.id} className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 14 }}>
            {studentName(s)} <span style={{ fontWeight: 500, fontSize: 12.5, color: "var(--muted)" }}>· Class {s.class.grade}-{s.class.section}</span>
          </div>
          {results.length === 0 ? (
            <div style={{ color: "var(--muted)", fontSize: 13.5 }}>No exam results recorded yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {results.map((r) => {
                if (!r.visible) {
                  return (
                    <div key={r.name + r.date.toISOString()} style={{ padding: "10px 12px", background: "var(--paper)", borderRadius: 8 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600 }}>{r.name}</div>
                      <div style={{ fontSize: 11.5, color: "var(--warn)", marginTop: 2 }}>{r.reason}</div>
                    </div>
                  );
                }
                const pct = Math.round((r.obtained / r.max) * 100);
                const grade = gradeForPct(pct);
                return (
                  <div key={r.name + r.date.toISOString()} style={{ display: "grid", gridTemplateColumns: "1.7fr 0.9fr 0.6fr auto", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--paper)", borderRadius: 8 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{r.name}</div>
                    <div className="mono" style={{ fontSize: 12.5, fontWeight: 700, textAlign: "right" }}>
                      {r.obtained} / {r.max}
                    </div>
                    <div className="mono" style={{ fontSize: 12.5, fontWeight: 700, textAlign: "right", color: gradeColor(grade) }}>
                      {pct}%
                    </div>
                    <span className="pill" style={{ background: "var(--paper)", color: gradeColor(grade), border: "1px solid var(--line)" }}>
                      {grade}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
