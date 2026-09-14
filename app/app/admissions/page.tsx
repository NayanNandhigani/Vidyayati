import Link from "next/link";
import { auth } from "@/auth";
import { getScopedDb } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { hasFeature } from "@/lib/feature-flags";
import AdmissionsBoard from "./AdmissionsBoard";

export default async function AdmissionsPage() {
  const accessLevel = await requireModuleAccess("Admissions", "VIEW");
  const canEdit = accessLevel === "EDIT";
  const session = await auth();
  const sdb = await getScopedDb();

  const [enquiries, classes, showDetailedForm] = await Promise.all([
    sdb.admissionEnquiry.findMany({ orderBy: { createdAt: "desc" } }),
    sdb.class.findMany({ orderBy: [{ grade: "asc" }, { section: "asc" }] }),
    hasFeature(session!.user.schoolId, "admissions.detailedForm"),
  ]);

  return (
    <div style={{ padding: "26px 34px", display: "flex", flexDirection: "column", gap: 16, height: "100dvh", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="disp" style={{ fontSize: 21 }}>
          Admissions pipeline
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {showDetailedForm && (
            <Link
              href="/app/admissions/blank-form/print"
              target="_blank"
              style={{ background: "var(--card)", border: "1px solid var(--line)", color: "var(--ink)", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
            >
              View Admission Form
            </Link>
          )}
          {canEdit && (
            <Link href="/app/admissions/new" style={{ background: "var(--marigold)", color: "#fff", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
              + New Enquiry
            </Link>
          )}
        </div>
      </div>

      <AdmissionsBoard
        enquiries={enquiries.map((e) => ({ id: e.id, applicantName: e.applicantName, parentContact: e.parentContact, classApplied: e.classApplied, stage: e.stage, approvalStatus: e.approvalStatus }))}
        classes={classes}
        canEdit={canEdit}
        showDetailedForm={showDetailedForm}
      />
    </div>
  );
}
