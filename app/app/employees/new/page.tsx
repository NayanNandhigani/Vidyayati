import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getScopedDb } from "@/lib/tenant-db";
import { hasFeature } from "@/lib/feature-flags";
import NewStaffForm from "./NewStaffForm";
import NewStaffDetailedForm from "./NewStaffDetailedForm";

export default async function NewStaffPage() {
  const session = await auth();
  if (session!.user.role !== "SCHOOL_ADMIN") redirect("/app/employees");

  const showDetailed = await hasFeature(session!.user.schoolId, "employees.detailedProfile");
  const sdb = await getScopedDb();
  const staff = showDetailed ? await sdb.staffProfile.findMany({ include: { user: true }, orderBy: { user: { name: "asc" } } }) : [];

  return (
    <div style={{ padding: "26px 34px" }}>
      <div className="disp" style={{ fontSize: 21, marginBottom: 4 }}>
        Add Staff
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 0, marginBottom: 22 }}>Create a login for a new staff member. Share the password with them directly — they can't self-register.</p>
      <div className="card" style={{ padding: 24, maxWidth: showDetailed ? 760 : 540 }}>
        {showDetailed ? <NewStaffDetailedForm staff={staff.map((s) => ({ id: s.id, name: s.user.name }))} /> : <NewStaffForm />}
      </div>
    </div>
  );
}
