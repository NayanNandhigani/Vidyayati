import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { getScopedDb } from "@/lib/tenant-db";
import { hasFeature } from "@/lib/feature-flags";
import InstituteClassesPanel from "./InstituteClassesPanel";
import InstituteSubjectsPanel from "./InstituteSubjectsPanel";
import FeeStructurePanel from "./FeeStructurePanel";

const PANELS = [
  { key: "classes", label: "Classes & Sections" },
  { key: "subjects", label: "Subjects" },
  { key: "fees", label: "Fee Structure" },
];

export default async function InstitutePage({ searchParams }: { searchParams: Promise<{ panel?: string }> }) {
  const session = await auth();
  if (session!.user.role !== "SCHOOL_ADMIN") redirect("/app/dashboard");

  const params = await searchParams;
  const panel = PANELS.some((p) => p.key === params.panel) ? params.panel! : "classes";
  const sdb = await getScopedDb();

  const currentYear = await sdb.academicYear.findFirst({ where: { isCurrent: true } });
  const [showCapacity, showCoTeacher, showRte] = await Promise.all([
    hasFeature(session!.user.schoolId, "classes.capacityAndCurriculum"),
    hasFeature(session!.user.schoolId, "classes.coTeacherAndReshuffle"),
    hasFeature(session!.user.schoolId, "compliance.udise"),
  ]);

  return (
    <div style={{ padding: "26px 34px", display: "flex", flexDirection: "column", gap: 18, height: "100dvh", boxSizing: "border-box" }}>
      <div className="disp" style={{ fontSize: 21 }}>
        Academic Management
      </div>

      <div style={{ display: "flex", gap: 20, flex: 1, minHeight: 0 }}>
        <div className="card" style={{ width: 196, flex: "none", padding: 10, display: "flex", flexDirection: "column", gap: 2, height: "fit-content" }}>
          {PANELS.map((p) => (
            <Link
              key={p.key}
              href={`/app/institute?panel=${p.key}`}
              style={{
                padding: "9px 12px",
                borderRadius: 7,
                fontSize: 13,
                fontWeight: panel === p.key ? 700 : 500,
                background: panel === p.key ? "var(--marigold-tint)" : "transparent",
                color: panel === p.key ? "var(--marigold-deep)" : "var(--ink)",
                textDecoration: "none",
              }}
            >
              {p.label}
            </Link>
          ))}
        </div>

        {!currentYear ? (
          <div className="card" style={{ flex: 1, padding: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center", maxWidth: 360 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>No active academic year</div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
                Classes and sections belong to an academic year. Set one as active before managing the institute's structure.
              </div>
              <Link href="/app/settings?panel=years" style={{ fontSize: 13, fontWeight: 700, color: "var(--marigold-deep)", textDecoration: "none" }}>
                Go to Settings → Academic Years
              </Link>
            </div>
          </div>
        ) : panel === "classes" ? (
          <div className="card" style={{ flex: 1, padding: 26, overflowY: "auto" }}>
            <ClassesPanelData sdb={sdb} yearId={currentYear.id} showCapacity={showCapacity} showCoTeacher={showCoTeacher} showRte={showRte} />
          </div>
        ) : panel === "subjects" ? (
          <div className="card" style={{ flex: 1, padding: 26, overflowY: "auto" }}>
            <SubjectsPanelData sdb={sdb} yearId={currentYear.id} showCapacity={showCapacity} />
          </div>
        ) : (
          <div className="card" style={{ flex: 1, padding: 26, overflowY: "auto" }}>
            <FeeStructurePanelData sdb={sdb} yearId={currentYear.id} />
          </div>
        )}
      </div>
    </div>
  );
}

async function ClassesPanelData({ sdb, yearId, showCapacity, showCoTeacher, showRte }: { sdb: Awaited<ReturnType<typeof getScopedDb>>; yearId: string; showCapacity: boolean; showCoTeacher: boolean; showRte: boolean }) {
  const [classes, staff] = await Promise.all([
    sdb.class.findMany({
      where: { yearId },
      include: { classTeacher: { include: { user: true } }, _count: { select: { students: true } }, coTeachers: { include: { staff: { include: { user: true } } } } },
      orderBy: [{ grade: "asc" }, { section: "asc" }],
    }),
    sdb.staffProfile.findMany({ include: { user: true }, orderBy: { user: { name: "asc" } } }),
  ]);

  return (
    <InstituteClassesPanel
      classes={classes.map((c) => ({
        id: c.id,
        grade: c.grade,
        section: c.section,
        studentCount: c._count.students,
        classTeacherId: c.classTeacherStaffId,
        classTeacherName: c.classTeacher?.user.name ?? null,
        maxStrength: c.maxStrength,
        board: c.board,
        rteQuotaSeats: c.rteQuotaSeats,
        coTeachers: c.coTeachers.map((ct) => ({ staffId: ct.staffId, name: ct.staff.user.name })),
      }))}
      staff={staff.map((s) => ({ id: s.id, name: s.user.name }))}
      showCapacity={showCapacity}
      showCoTeacher={showCoTeacher}
      showRte={showRte}
    />
  );
}

async function FeeStructurePanelData({ sdb, yearId }: { sdb: Awaited<ReturnType<typeof getScopedDb>>; yearId: string }) {
  const [classes, feeDefaults] = await Promise.all([
    sdb.class.findMany({ where: { yearId }, orderBy: [{ grade: "asc" }, { section: "asc" }] }),
    sdb.classFeeDefault.findMany({ where: { yearId } }),
  ]);

  const feeByGrade = new Map(feeDefaults.map((f) => [f.grade, Number(f.actualFee)]));
  const sectionCountByGrade = new Map<string, number>();
  for (const c of classes) sectionCountByGrade.set(c.grade, (sectionCountByGrade.get(c.grade) ?? 0) + 1);

  const grades = [...sectionCountByGrade.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  return (
    <FeeStructurePanel
      grades={grades.map((grade) => ({
        grade,
        sectionCount: sectionCountByGrade.get(grade) ?? 0,
        actualFee: feeByGrade.get(grade) ?? null,
      }))}
    />
  );
}

async function SubjectsPanelData({ sdb, yearId, showCapacity }: { sdb: Awaited<ReturnType<typeof getScopedDb>>; yearId: string; showCapacity: boolean }) {
  const [subjects, classes, staff] = await Promise.all([
    sdb.subject.findMany({ orderBy: { name: "asc" } }),
    sdb.class.findMany({ where: { yearId }, orderBy: [{ grade: "asc" }, { section: "asc" }] }),
    sdb.staffProfile.findMany({ include: { user: true }, orderBy: { user: { name: "asc" } } }),
  ]);

  const classIds = classes.map((c) => c.id);
  const assignments = classIds.length > 0 ? await sdb.classSubjectTeacher.findMany({ where: { classId: { in: classIds } } }) : [];

  const teacherByClassBySubject = new Map<string, Record<string, string>>();
  for (const a of assignments) {
    const map = teacherByClassBySubject.get(a.subjectId) ?? {};
    map[a.classId] = a.staffId;
    teacherByClassBySubject.set(a.subjectId, map);
  }

  return (
    <InstituteSubjectsPanel
      subjects={subjects.map((s) => ({ id: s.id, name: s.name, teacherByClass: teacherByClassBySubject.get(s.id) ?? {}, isElective: s.isElective, credits: s.credits }))}
      classes={classes.map((c) => ({ id: c.id, grade: c.grade, section: c.section }))}
      staff={staff.map((s) => ({ id: s.id, name: s.user.name }))}
      showCapacity={showCapacity}
    />
  );
}
