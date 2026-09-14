import { auth } from "@/auth";
import { getScopedDb } from "@/lib/tenant-db";
import { requireModuleAccess, getPermittedClassIds } from "@/lib/permissions";
import NewHomeworkForm from "./NewHomeworkForm";

export default async function NewHomeworkPage() {
  await requireModuleAccess("Homework", "VIEW");
  const session = await auth();
  const sdb = await getScopedDb();
  const permittedClassIds = await getPermittedClassIds("Homework", "EDIT");
  const isAdmin = session!.user.role === "SCHOOL_ADMIN";
  const [classesRaw, subjects, staff] = await Promise.all([
    sdb.class.findMany({ orderBy: [{ grade: "asc" }, { section: "asc" }] }),
    sdb.subject.findMany({ orderBy: { name: "asc" } }),
    isAdmin ? sdb.staffProfile.findMany({ include: { user: true }, orderBy: { user: { name: "asc" } } }) : [],
  ]);
  const classes = permittedClassIds === "ALL" ? classesRaw : classesRaw.filter((c) => permittedClassIds.has(c.id));

  return (
    <div style={{ padding: "26px 34px" }}>
      <div className="disp" style={{ fontSize: 21, marginBottom: 4 }}>
        New Assignment
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 0, marginBottom: 22 }}>Assign homework to a class.</p>
      <div className="card" style={{ padding: 24, maxWidth: 540 }}>
        <NewHomeworkForm
          classes={classes.map((c) => ({ id: c.id, grade: c.grade, section: c.section, classTeacherStaffId: c.classTeacherStaffId }))}
          subjects={subjects}
          isAdmin={isAdmin}
          staff={staff.map((s) => ({ id: s.id, name: s.user.name }))}
        />
      </div>
    </div>
  );
}
