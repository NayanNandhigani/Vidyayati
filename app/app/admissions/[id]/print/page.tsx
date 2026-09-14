import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getScopedDb } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { requireFeature } from "@/lib/feature-flags";
import PrintButton from "./PrintButton";

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.05em", color: "#666" }}>{label}</div>
      <div style={{ fontSize: 12.5, borderBottom: "1px solid #ccc", minHeight: 18, paddingBottom: 2 }}>{value || " "}</div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#333", background: "#f0f0f0", padding: "5px 10px", marginTop: 18, marginBottom: 10 }}>
      {children}
    </div>
  );
}

export default async function ApplicationPrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requireModuleAccess("Admissions", "VIEW");
  const session = await auth();
  await requireFeature(session!.user.schoolId, "admissions.detailedForm");

  const { id } = await params;
  const sdb = await getScopedDb();
  const [e, school] = await Promise.all([
    sdb.admissionEnquiry.findUnique({ where: { id } }),
    sdb.school.findUniqueOrThrow({ where: { id: session!.user.schoolId! }, select: { name: true, addressLine: true, city: true, state: true } }),
  ]);
  if (!e) notFound();

  const fmt = (d: Date | null) => (d ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : null);

  return (
    <div style={{ padding: "28px 36px", display: "flex", flexDirection: "column", gap: 16, minHeight: "100dvh", boxSizing: "border-box", background: "var(--paper)" }}>
      <div className="print-hide" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>Admission Form — {e.applicantName}</div>
        <PrintButton />
      </div>

      <div className="print-page card" style={{ maxWidth: 780, margin: "0 auto", width: "100%", padding: "48px 56px", color: "#111" }}>
        <div style={{ textAlign: "center", borderBottom: "2px solid #111", paddingBottom: 16, marginBottom: 10 }}>
          <div className="disp" style={{ fontSize: 22 }}>
            {school.name}
          </div>
          <div style={{ fontSize: 11.5, color: "#555", marginTop: 2 }}>
            {[school.addressLine, school.city, school.state].filter(Boolean).join(", ")}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 12, letterSpacing: "0.03em" }}>ADMISSION APPLICATION FORM</div>
        </div>

        <SectionHeading>Student</SectionHeading>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Full name" value={e.applicantName} />
          <Field label="Class/grade applying for" value={e.classApplied} />
          <Field label="Date of birth" value={fmt(e.dob)} />
          <Field label="Gender" value={e.gender} />
          <Field label="Blood group" value={e.bloodGroup} />
          <Field label="Nationality" value={e.nationality} />
          <Field label="Caste" value={e.caste} />
          <Field label="Religion/Category" value={e.religionCategory} />
          <Field label="Mother tongue" value={e.motherTongue} />
          <Field label="Aadhaar number (student)" value={e.studentAadhaarNumber} />
        </div>

        <SectionHeading>Parent / Guardian</SectionHeading>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Father's name" value={e.fatherName} />
          <Field label="Mother's name" value={e.motherName} />
          <Field label="Guardian's name" value={e.guardianName} />
          <Field label="Father's occupation" value={e.fatherOccupation} />
          <Field label="Mother's occupation" value={e.motherOccupation} />
          <Field label="Annual income" value={e.annualIncome} />
          <Field label="Contact number 1" value={e.parentContact} />
          <Field label="Contact number 2" value={e.contactNumber2} />
          <Field label="Email address" value={e.email} />
          <Field label="Aadhaar number (parents)" value={e.parentAadhaarNumber} />
        </div>

        <SectionHeading>Address</SectionHeading>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Permanent address" value={e.permanentAddress} />
          <Field label="Current/correspondence address" value={e.currentAddress} />
          <Field label="Pincode" value={e.pincode} />
        </div>

        <SectionHeading>Health / Emergency</SectionHeading>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Known allergies/medical conditions" value={e.allergiesConditions} />
          <Field label="Family doctor contact" value={e.familyDoctorContact} />
          <Field label="Emergency contact name" value={e.emergencyContactName} />
          <Field label="Emergency contact number" value={e.emergencyContactNumber} />
        </div>

        <SectionHeading>Academic Reference Details</SectionHeading>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="UDISE Number" value={e.udiseNumber} />
          <Field label="PEN Number" value={e.penNumber} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 40, marginTop: 64 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ borderTop: "1px solid #111", paddingTop: 6, fontSize: 11.5, color: "#333" }}>Parent's Signature</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ borderTop: "1px solid #111", paddingTop: 6, fontSize: 11.5, color: "#333" }}>Guardian's Signature</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ borderTop: "1px solid #111", paddingTop: 6, fontSize: 11.5, color: "#333" }}>Principal's Signature</div>
          </div>
        </div>
      </div>
    </div>
  );
}
