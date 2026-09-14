import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { getScopedDb } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { requireFeature } from "@/lib/feature-flags";
import ApplicationDetailForm from "./ApplicationDetailForm";

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const accessLevel = await requireModuleAccess("Admissions", "VIEW");
  const canEdit = accessLevel === "EDIT";
  const session = await auth();
  await requireFeature(session!.user.schoolId, "admissions.detailedForm");

  const { id } = await params;
  const sdb = await getScopedDb();
  const [enquiry, classes, feeDefaults] = await Promise.all([
    sdb.admissionEnquiry.findUnique({ where: { id } }),
    sdb.class.findMany({ orderBy: [{ grade: "asc" }, { section: "asc" }] }),
    sdb.academicYear.findFirst({ where: { isCurrent: true } }).then((y) => (y ? sdb.classFeeDefault.findMany({ where: { yearId: y.id } }) : [])),
  ]);
  if (!enquiry) notFound();

  const feeByGrade = new Map(feeDefaults.map((f) => [f.grade, Number(f.actualFee)]));

  return (
    <div style={{ padding: "26px 34px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <Link href="/app/admissions" style={{ fontSize: 12.5, color: "var(--muted)", textDecoration: "none" }}>
          ← Back to Admissions
        </Link>
        <div className="disp" style={{ fontSize: 21, marginTop: 4 }}>
          {enquiry.applicantName}
        </div>
      </div>
      <div className="card" style={{ padding: 24, maxWidth: 780 }}>
        <ApplicationDetailForm
          enquiry={{
            id: enquiry.id,
            applicantName: enquiry.applicantName,
            parentContact: enquiry.parentContact,
            classApplied: enquiry.classApplied,
            stage: enquiry.stage,
            approvalStatus: enquiry.approvalStatus,
            parentName: enquiry.parentName,
            address: enquiry.address,
            photoPath: enquiry.photoPath,
            dob: enquiry.dob?.toISOString().slice(0, 10) ?? null,
            gender: enquiry.gender,
            bloodGroup: enquiry.bloodGroup,
            nationality: enquiry.nationality,
            caste: enquiry.caste,
            religionCategory: enquiry.religionCategory,
            motherTongue: enquiry.motherTongue,
            studentAadhaarNumber: enquiry.studentAadhaarNumber,
            fatherName: enquiry.fatherName,
            motherName: enquiry.motherName,
            guardianName: enquiry.guardianName,
            fatherOccupation: enquiry.fatherOccupation,
            motherOccupation: enquiry.motherOccupation,
            contactNumber2: enquiry.contactNumber2,
            annualIncome: enquiry.annualIncome,
            email: enquiry.email,
            parentAadhaarNumber: enquiry.parentAadhaarNumber,
            permanentAddress: enquiry.permanentAddress,
            currentAddress: enquiry.currentAddress,
            pincode: enquiry.pincode,
            allergiesConditions: enquiry.allergiesConditions,
            emergencyContactName: enquiry.emergencyContactName,
            emergencyContactNumber: enquiry.emergencyContactNumber,
            familyDoctorContact: enquiry.familyDoctorContact,
            udiseNumber: enquiry.udiseNumber,
            penNumber: enquiry.penNumber,
          }}
          classes={classes.map((c) => ({
            id: c.id,
            grade: c.grade,
            section: c.section,
            actualFee: feeByGrade.get(c.grade) ?? null,
          }))}
          canEdit={canEdit}
          isAdmin={session!.user.role === "SCHOOL_ADMIN"}
        />
      </div>
    </div>
  );
}
