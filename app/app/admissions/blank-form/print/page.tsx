import { auth } from "@/auth";
import { getScopedDb } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { requireFeature } from "@/lib/feature-flags";
import PrintButton from "../../[id]/print/PrintButton";

function Field({ label }: { label: string }) {
  return (
    <div>
      <div style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.05em", color: "#666" }}>{label}</div>
      <div style={{ fontSize: 12.5, borderBottom: "1px solid #ccc", minHeight: 18, paddingBottom: 2 }}>&nbsp;</div>
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

// A blank copy of the same admission application form as
// app/app/admissions/[id]/print — for handing out to a prospective family
// to fill by hand, or printing spare office copies, before an Enquiry
// record even exists yet. Field labels/layout are kept in exact lockstep
// with the filled version; only the values differ (always blank here).
export default async function BlankAdmissionFormPrintPage() {
  await requireModuleAccess("Admissions", "VIEW");
  const session = await auth();
  await requireFeature(session!.user.schoolId, "admissions.detailedForm");

  const sdb = await getScopedDb();
  const school = await sdb.school.findUniqueOrThrow({ where: { id: session!.user.schoolId! }, select: { name: true, addressLine: true, city: true, state: true } });

  return (
    <div style={{ padding: "28px 36px", display: "flex", flexDirection: "column", gap: 16, minHeight: "100dvh", boxSizing: "border-box", background: "var(--paper)" }}>
      <div className="print-hide" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>Blank Admission Form</div>
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
          <Field label="Full name" />
          <Field label="Class/grade applying for" />
          <Field label="Date of birth" />
          <Field label="Gender" />
          <Field label="Blood group" />
          <Field label="Nationality" />
          <Field label="Caste" />
          <Field label="Religion/Category" />
          <Field label="Mother tongue" />
          <Field label="Aadhaar number (student)" />
        </div>

        <SectionHeading>Parent / Guardian</SectionHeading>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Father's name" />
          <Field label="Mother's name" />
          <Field label="Guardian's name" />
          <Field label="Father's occupation" />
          <Field label="Mother's occupation" />
          <Field label="Annual income" />
          <Field label="Contact number 1" />
          <Field label="Contact number 2" />
          <Field label="Email address" />
          <Field label="Aadhaar number (parents)" />
        </div>

        <SectionHeading>Address</SectionHeading>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Permanent address" />
          <Field label="Current/correspondence address" />
          <Field label="Pincode" />
        </div>

        <SectionHeading>Health / Emergency</SectionHeading>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Known allergies/medical conditions" />
          <Field label="Family doctor contact" />
          <Field label="Emergency contact name" />
          <Field label="Emergency contact number" />
        </div>

        <SectionHeading>Academic Reference Details</SectionHeading>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="UDISE Number" />
          <Field label="PEN Number" />
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
