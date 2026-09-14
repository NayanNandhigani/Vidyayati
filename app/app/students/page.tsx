import Link from "next/link";
import { getScopedDb } from "@/lib/tenant-db";
import { requireModuleAccess, getPermittedClassIds } from "@/lib/permissions";
import { SortableHeader, resolveSort } from "@/components/SortableHeader";
import { hasFeature } from "@/lib/feature-flags";
import { auth } from "@/auth";
import StudentListBody from "./StudentListBody";
import type { StudentStatus, Prisma } from "@prisma/client";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; classId?: string; status?: string; sortBy?: string; sortDir?: string }>;
}) {
  await requireModuleAccess("Students", "VIEW");
  const params = await searchParams;
  const sdb = await getScopedDb();
  const permittedClassIds = await getPermittedClassIds("Students");

  const classesRaw = await sdb.class.findMany({ orderBy: [{ grade: "asc" }, { section: "asc" }] });
  // A staff member scoped to specific classes only sees (and can only pick
  // from) those classes — the module-wide "all classes" case is unaffected.
  const classes = permittedClassIds === "ALL" ? classesRaw : classesRaw.filter((c) => permittedClassIds.has(c.id));

  // Combine the query-string class filter (if any) with the permission
  // restriction — an explicit ?classId= outside what's permitted resolves
  // to "no results" rather than silently falling back to the full list.
  let classWhere: { classId?: string | { in: string[] } } = {};
  if (params.classId) {
    classWhere = permittedClassIds === "ALL" || permittedClassIds.has(params.classId) ? { classId: params.classId } : { classId: "__no_access__" };
  } else if (permittedClassIds !== "ALL") {
    classWhere = { classId: { in: [...permittedClassIds] } };
  }

  const orderBy = resolveSort<Prisma.StudentOrderByWithRelationInput[]>(
    params,
    {
      name: (dir) => [{ firstName: dir }, { surname: dir }],
      surname: (dir) => [{ surname: dir }, { firstName: dir }],
      class: (dir) => [{ class: { grade: dir } }, { class: { section: dir } }],
      section: (dir) => [{ class: { section: dir } }, { class: { grade: dir } }],
      admissionNo: (dir) => [{ admissionNo: dir }],
    },
    [{ firstName: "asc" }, { surname: "asc" }]
  );

  const students = await sdb.student.findMany({
    where: {
      ...(params.q
        ? { OR: [{ firstName: { contains: params.q, mode: "insensitive" } }, { surname: { contains: params.q, mode: "insensitive" } }, { admissionNo: { contains: params.q, mode: "insensitive" } }] }
        : {}),
      ...(params.status ? { status: params.status as StudentStatus } : {}),
      ...classWhere,
    },
    include: { class: true },
    orderBy,
  });

  const session = await auth();
  const showReshuffle = await hasFeature(session!.user.schoolId, "classes.coTeacherAndReshuffle");

  return (
    <div style={{ padding: "26px 34px", display: "flex", flexDirection: "column", gap: 16, height: "100dvh", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="disp" style={{ fontSize: 21 }}>
          Students <span className="mono" style={{ fontSize: 14, fontWeight: 500, color: "var(--faint)" }}>· {students.length}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link
            href="/app/students/bulk-import"
            style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, textDecoration: "none", color: "var(--ink)" }}
          >
            Bulk Import ↑
          </Link>
          <Link
            href="/app/students/new"
            style={{ background: "var(--marigold)", color: "#fff", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
          >
            + Add Student
          </Link>
        </div>
      </div>

      <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", background: "var(--paper)" }}>
          <form method="GET" style={{ display: "flex", gap: 10 }}>
            <input type="hidden" name="sortBy" value={params.sortBy ?? ""} />
            <input type="hidden" name="sortDir" value={params.sortDir ?? ""} />
            <input
              className="in"
              name="q"
              defaultValue={params.q}
              placeholder="Search students…"
              style={{ flex: 1, background: "var(--card)" }}
            />
            <select className="in" name="classId" defaultValue={params.classId ?? ""} style={{ width: "auto", background: "var(--card)", fontWeight: 600 }}>
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.grade}-{c.section}
                </option>
              ))}
            </select>
            <select className="in" name="status" defaultValue={params.status ?? ""} style={{ width: "auto", background: "var(--card)", fontWeight: 600 }}>
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="ALUMNI">Alumni</option>
            </select>
            <button
              type="submit"
              style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "0 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              Search
            </button>
          </form>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: showReshuffle ? "auto 1.9fr 1.3fr 0.7fr 0.7fr 1.2fr 0.8fr" : "1.9fr 1.3fr 0.7fr 0.7fr 1.2fr 0.8fr",
            padding: "12px 20px",
            borderBottom: "1px solid var(--line)",
            fontSize: 11,
            color: "var(--faint)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {showReshuffle && <div />}
          <div><SortableHeader label="Name" field="name" basePath="/app/students" currentParams={params} /></div>
          <div><SortableHeader label="Surname" field="surname" basePath="/app/students" currentParams={params} /></div>
          <div><SortableHeader label="Class" field="class" basePath="/app/students" currentParams={params} /></div>
          <div><SortableHeader label="Section" field="section" basePath="/app/students" currentParams={params} /></div>
          <div><SortableHeader label="Admission No." field="admissionNo" basePath="/app/students" currentParams={params} /></div>
          <div />
        </div>

        <StudentListBody
          students={students.map((s) => ({ id: s.id, firstName: s.firstName, surname: s.surname, admissionNo: s.admissionNo, photoPath: s.photoPath, class: { grade: s.class.grade, section: s.class.section } }))}
          classes={classes.map((c) => ({ id: c.id, grade: c.grade, section: c.section }))}
          showReshuffle={showReshuffle}
        />
      </div>
    </div>
  );
}
