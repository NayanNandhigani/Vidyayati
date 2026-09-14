import Link from "next/link";
import { auth } from "@/auth";
import { getScopedDb } from "@/lib/tenant-db";
import { requireModuleAccess, getPermittedClassIds } from "@/lib/permissions";
import { formatDate, daysUntil, studentName } from "@/lib/format";
import { hasFeature } from "@/lib/feature-flags";
import { effectiveStatus } from "@/lib/homework";
import { getOverdueHomework } from "./depth-actions";
import HomeworkBoard from "./HomeworkBoard";
import ParentSubmissionUpload from "./ParentSubmissionUpload";
import GraceDaysSetting from "./GraceDaysSetting";

export default async function HomeworkPage({ searchParams }: { searchParams: Promise<{ assignment?: string }> }) {
  const session = await auth();
  const params = await searchParams;
  const sdb = await getScopedDb();

  if (session!.user.role === "PARENT") {
    return <ParentHomeworkView />;
  }

  // Same reasoning as the other class-scoped modules: don't reject a
  // staffer up front just because they lack a school-wide row — only when
  // they have no permitted classes at all.
  const permittedClassIds = await getPermittedClassIds("Homework", "VIEW");
  if (permittedClassIds !== "ALL" && permittedClassIds.size === 0) {
    await requireModuleAccess("Homework", "VIEW");
  }
  // "+ New assignment" and the board's edit affordances show if they can
  // edit at least one permitted class — the actual per-assignment write is
  // still separately enforced server-side in actions.ts by deriving each
  // assignment's own class.
  const editableClassIds = await getPermittedClassIds("Homework", "EDIT");
  const canEdit = editableClassIds === "ALL" || editableClassIds.size > 0;

  const homeworkRaw = await sdb.homework.findMany({
    include: {
      class: true,
      subject: true,
      staff: { include: { user: true } },
      submissions: { include: { student: true } },
    },
    orderBy: { dueDate: "desc" },
  });
  const homework = permittedClassIds === "ALL" ? homeworkRaw : homeworkRaw.filter((h) => permittedClassIds.has(h.classId));

  const now = new Date();
  const activeCount = homework.filter((h) => h.dueDate >= now).length;
  const dueThisWeekCount = homework.filter((h) => daysUntil(h.dueDate) >= 0 && daysUntil(h.dueDate) <= 7).length;
  const rates = homework
    .filter((h) => h.submissions.length > 0)
    .map((h) => h.submissions.filter((s) => s.status !== "PENDING").length / h.submissions.length);
  const avgSubmissionRate = rates.length ? Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100) : 0;
  const pendingGrading = homework.filter((h) => {
    const submitted = h.submissions.filter((s) => s.status !== "PENDING").length;
    const graded = h.submissions.filter((s) => s.score !== null).length;
    return submitted > 0 && graded < submitted;
  }).length;

  const showAttachments = await hasFeature(session!.user.schoolId, "homework.attachmentsAndDigest");
  const schoolForGrace = showAttachments ? await sdb.school.findUnique({ where: { id: session!.user.schoolId! }, select: { homeworkGraceDays: true } }) : null;

  const boardData = homework.map((h) => ({
    id: h.id,
    title: h.title,
    description: h.description,
    dueDate: h.dueDate.toISOString(),
    subject: { name: h.subject.name },
    class: { grade: h.class.grade, section: h.class.section },
    staff: { user: { name: h.staff.user.name } },
    submissions: h.submissions.map((s) => ({ id: s.id, studentId: s.studentId, student: { name: studentName(s.student) }, status: s.status, score: s.score !== null ? Number(s.score) : null })),
    attachmentPath: h.attachmentPath,
  }));

  return (
    <div style={{ padding: "22px 30px", display: "flex", flexDirection: "column", gap: 14, height: "100dvh", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div className="disp" style={{ fontSize: 21 }}>
            Homework
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{formatDate(new Date())}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {canEdit && showAttachments && <GraceDaysSetting graceDays={schoolForGrace?.homeworkGraceDays ?? null} />}
          {canEdit && (
            <Link href="/app/homework/new" style={{ background: "var(--marigold)", color: "#fff", borderRadius: 8, padding: "8px 15px", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
              + New assignment
            </Link>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        <StatCard label="Active assignments" value={activeCount} />
        <StatCard label="Due this week" value={dueThisWeekCount} color="var(--warn)" />
        <StatCard label="Avg. submission rate" value={`${avgSubmissionRate}%`} color="var(--teal)" />
        <StatCard label="Pending grading" value={pendingGrading} color="var(--clay)" />
      </div>

      {homework.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--muted)", flex: 1 }}>
          No homework assigned yet.
        </div>
      ) : (
        <HomeworkBoard assignments={boardData} initialSelectedId={params.assignment ?? null} canEdit={canEdit} showAttachments={showAttachments} />
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="card" style={{ padding: "12px 16px" }}>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 5 }}>{label}</div>
      <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: color ?? "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}

async function ParentHomeworkView() {
  const session = await auth();
  const sdb = await getScopedDb();
  const showAttachments = await hasFeature(session!.user.schoolId, "homework.attachmentsAndDigest");

  const parent = await sdb.parent.findUnique({
    where: { userId: session!.user.id },
    include: {
      studentLinks: {
        include: {
          student: {
            include: {
              homeworkSubmissions: { include: { assignment: { include: { subject: true } } }, orderBy: { assignment: { dueDate: "desc" } } },
            },
          },
        },
      },
    },
  });

  const students = parent?.studentLinks.map((l) => l.student) ?? [];
  const school = await sdb.school.findUnique({ where: { id: session!.user.schoolId! }, select: { homeworkGraceDays: true } });
  const overdue = showAttachments ? await getOverdueHomework(students.map((s) => s.id)) : [];

  return (
    <div style={{ padding: "26px 34px", display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="disp" style={{ fontSize: 21 }}>
        Homework
      </div>

      {showAttachments && overdue.length > 0 && (
        <div className="card" style={{ padding: 18, background: "var(--critical-tint)" }}>
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--critical)", marginBottom: 8 }}>
            Overdue homework
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {overdue.map((o) => (
              <div key={o.id} style={{ fontSize: 12.5, color: "var(--ink)" }}>
                <strong>{o.studentName}</strong> · {o.title} ({o.subject}) — was due {new Date(o.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
              </div>
            ))}
          </div>
        </div>
      )}

      {students.length === 0 && <div style={{ color: "var(--muted)" }}>No students linked to your account.</div>}
      {students.map((s) => (
        <div key={s.id} className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 14 }}>{studentName(s)}</div>
          {s.homeworkSubmissions.length === 0 ? (
            <div style={{ color: "var(--muted)", fontSize: 13.5 }}>No homework assigned yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {s.homeworkSubmissions.map((sub) => {
                const status = effectiveStatus(sub.status, sub.assignment.dueDate, school?.homeworkGraceDays ?? null);
                const style =
                  status === "SUBMITTED"
                    ? { bg: "var(--good-tint)", fg: "var(--good)" }
                    : status === "LATE"
                      ? { bg: "var(--critical-tint)", fg: "var(--critical)" }
                      : { bg: "var(--warn-tint)", fg: "var(--warn)" };
                return (
                  <div key={sub.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--paper)", borderRadius: 8 }}>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600 }}>{sub.assignment.title}</div>
                      <div style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 1 }}>
                        {sub.assignment.subject.name} · Due {sub.assignment.dueDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                      </div>
                    </div>
                    {showAttachments && <ParentSubmissionUpload submissionId={sub.id} hasAttachment={!!sub.attachmentPath} />}
                    {sub.score !== null && (
                      <span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>
                        {Number(sub.score)}/10
                      </span>
                    )}
                    <span className="pill" style={{ background: style.bg, color: style.fg }}>
                      {status[0] + status.slice(1).toLowerCase()}
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
