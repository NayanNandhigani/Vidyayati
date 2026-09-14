import { getScopedDb } from "@/lib/tenant-db";
import { requireModuleAccess, getPermittedClassIds } from "@/lib/permissions";
import NewStudentForm from "./NewStudentForm";

export default async function NewStudentPage() {
  // Module-level VIEW is enough to reach this page at all — a staffer with
  // only class-specific EDIT (no school-wide grant) still needs to get
  // here; per-class write access is what actually gates which classes
  // they can enrol into, checked below and again in createStudent().
  await requireModuleAccess("Students", "VIEW");
  const sdb = await getScopedDb();
  const permittedClassIds = await getPermittedClassIds("Students", "EDIT");
  const classesRaw = await sdb.class.findMany({ orderBy: [{ grade: "asc" }, { section: "asc" }] });
  const classes = permittedClassIds === "ALL" ? classesRaw : classesRaw.filter((c) => permittedClassIds.has(c.id));

  return (
    <div style={{ padding: "26px 34px" }}>
      <div className="disp" style={{ fontSize: 21, marginBottom: 4 }}>
        Add Student
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 0, marginBottom: 22 }}>Enrol a new student into a class.</p>
      <div className="card" style={{ padding: 24, maxWidth: 520 }}>
        <NewStudentForm classes={classes} />
      </div>
    </div>
  );
}
