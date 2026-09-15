import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getScopedDb } from "@/lib/tenant-db";
import { requireModuleAccess, getPermittedClassIds } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import TeachingBoard from "./TeachingBoard";

export default async function TeachingPage({ searchParams }: { searchParams: Promise<{ assignment?: string }> }) {
  const session = await auth();
  const params = await searchParams;
  const sdb = await getScopedDb();

  // Same reasoning as the other class-scoped modules: don't reject a
  // staffer up front just because they lack a school-wide row — only when
  // they have no permitted classes at all.
  const permittedClassIds = await getPermittedClassIds("Teaching", "VIEW");
  if (permittedClassIds !== "ALL" && permittedClassIds.size === 0) {
    await requireModuleAccess("Teaching", "VIEW");
  }
  const editableClassIds = await getPermittedClassIds("Teaching", "EDIT");

  const isAdmin = session!.user.role === "SCHOOL_ADMIN";
  const staffProfile = isAdmin ? null : await db.staffProfile.findUnique({ where: { userId: session!.user.id }, select: { id: true } });

  // "Assigned subjects/classes" comes from the standing class-subject-teacher
  // roster (Academic Management), not from Teaching's own StaffPermission
  // rows — those just gate whether this module is reachable at all, and for
  // which classes. A School Admin browses every assignment in the school;
  // a Staff member sees only the rows where they're the assigned teacher.
  const rosterRaw = await sdb.classSubjectTeacher.findMany({
    where: isAdmin ? undefined : { staffId: staffProfile?.id ?? "__none__" },
    include: { class: true, subject: true, staff: { include: { user: true } } },
  });
  const roster = (permittedClassIds === "ALL" ? rosterRaw : rosterRaw.filter((r) => permittedClassIds.has(r.classId))).sort(
    (a, b) =>
      a.class.grade.localeCompare(b.class.grade, undefined, { numeric: true }) ||
      a.class.section.localeCompare(b.class.section) ||
      a.subject.name.localeCompare(b.subject.name)
  );

  const topics = roster.length
    ? await sdb.syllabusTopic.findMany({
        where: { classId: { in: roster.map((r) => r.classId) }, subjectId: { in: roster.map((r) => r.subjectId) } },
        include: { loggedByStaff: { include: { user: true } } },
        orderBy: { orderIndex: "asc" },
      })
    : [];

  const assignments = roster.map((r) => {
    const myTopics = topics.filter((t) => t.classId === r.classId && t.subjectId === r.subjectId);
    const completedCount = myTopics.filter((t) => t.status === "COMPLETED").length;
    return {
      key: `${r.classId}:${r.subjectId}`,
      classId: r.classId,
      subjectId: r.subjectId,
      className: `${r.class.grade}-${r.class.section}`,
      subjectName: r.subject.name,
      teacherName: r.staff.user.name,
      canEdit: editableClassIds === "ALL" || editableClassIds.has(r.classId),
      topics: myTopics.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        coveredOn: t.coveredOn?.toISOString() ?? null,
        note: t.note,
        loggedByName: t.loggedByStaff?.user.name ?? null,
      })),
      completedCount,
      totalCount: myTopics.length,
    };
  });

  // Stats are derived from `assignments[].topics`, not the raw `topics`
  // fetch above — that query is only scoped to "classId in this roster's
  // classes AND subjectId in this roster's subjects" (an efficient single
  // round trip), which is broader than the roster's actual (classId,
  // subjectId) pairs. assignments[].topics is the one place that filter got
  // narrowed to the exact pair per row, so it's the only correct source for
  // anything aggregated across a teacher's assignments.
  const allMyTopics = assignments.flatMap((a) => a.topics);
  const overallTotal = assignments.reduce((sum, a) => sum + a.totalCount, 0);
  const overallCompleted = assignments.reduce((sum, a) => sum + a.completedCount, 0);
  const overallPct = overallTotal ? Math.round((overallCompleted / overallTotal) * 100) : 0;
  const fullyCovered = assignments.filter((a) => a.totalCount > 0 && a.completedCount === a.totalCount).length;
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const loggedThisWeek = allMyTopics.filter((t) => t.status === "COMPLETED" && t.coveredOn && new Date(t.coveredOn) >= weekAgo).length;

  return (
    <div style={{ padding: "22px 30px", display: "flex", flexDirection: "column", gap: 14, height: "100dvh", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div className="disp" style={{ fontSize: 21 }}>
            Teaching
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{formatDate(new Date())}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        <StatCard label="Assigned subjects" value={assignments.length} />
        <StatCard label="Overall completion" value={`${overallPct}%`} color="var(--teal)" />
        <StatCard label="Fully covered" value={fullyCovered} color="var(--good)" />
        <StatCard label="Topics logged this week" value={loggedThisWeek} color="var(--clay)" />
      </div>

      {assignments.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--muted)", flex: 1 }}>
          {isAdmin
            ? "No subject teachers have been assigned yet — set them up under Academic Management → Subjects."
            : "You have no assigned subjects yet — ask your School Admin to assign you as a subject teacher in Academic Management."}
        </div>
      ) : (
        <TeachingBoard assignments={assignments} initialSelectedKey={params.assignment ?? null} showTeacherName={isAdmin} />
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
