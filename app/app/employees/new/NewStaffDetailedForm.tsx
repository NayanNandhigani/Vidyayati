"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { createStaffDetailed } from "../detailed-profile-actions";
import { suggestEmployeeId } from "../detailed-profile-actions";
import type { StaffFormState } from "../actions";

const initialState: StaffFormState = {};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16, marginTop: 4 }}>
      <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 12 }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>{children}</div>;
}

export default function NewStaffDetailedForm({ staff }: { staff: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(createStaffDetailed, initialState);
  const [staffType, setStaffType] = useState<"teaching" | "nonTeaching">("teaching");
  const employeeIdRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  function suggest() {
    startTransition(async () => {
      const value = await suggestEmployeeId();
      if (employeeIdRef.current) employeeIdRef.current.value = value;
    });
  }

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <input type="hidden" name="staffCategory" value={staffType === "teaching" ? "TEACHING" : "NON_TEACHING"} />
      <div style={{ display: "flex", gap: 8 }}>
        <span
          onClick={() => setStaffType("teaching")}
          className="pill"
          style={{ cursor: "pointer", background: staffType === "teaching" ? "var(--marigold)" : "var(--card)", color: staffType === "teaching" ? "#fff" : "var(--ink2)", border: "1px solid var(--line)" }}
        >
          Teaching staff
        </span>
        <span
          onClick={() => setStaffType("nonTeaching")}
          className="pill"
          style={{ cursor: "pointer", background: staffType === "nonTeaching" ? "var(--marigold)" : "var(--card)", color: staffType === "nonTeaching" ? "#fff" : "var(--ink2)", border: "1px solid var(--line)" }}
        >
          Non-teaching staff
        </span>
      </div>

      <Row>
        <label className="field">
          Full name
          <input className="in" name="name" required placeholder="Priya Kapoor" />
        </label>
        <label className="field">
          Username (for login)
          <input className="in" name="username" required placeholder="e.g. priya.kapoor" />
        </label>
      </Row>
      <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Default password: <span className="mono">12345</span> — the staff member can change it after logging in.</div>

      <Section title="Personal details">
        <Row>
          <label className="field">
            Date of birth
            <input className="in mono" type="date" name="dob" />
          </label>
          <label className="field">
            Gender
            <select className="in" name="gender" defaultValue="">
              <option value="">—</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
        </Row>
        <Row>
          <label className="field">
            Blood group
            <input className="in" name="bloodGroup" placeholder="O+" />
          </label>
          <label className="field">
            Marital status
            <input className="in" name="maritalStatus" placeholder="Married" />
          </label>
        </Row>
        <Row>
          <label className="field">
            Nationality
            <input className="in" name="nationality" placeholder="Indian" />
          </label>
          <label className="field">
            Aadhaar number
            <input className="in mono" name="aadhaarNumber" placeholder="XXXX XXXX XXXX" />
          </label>
        </Row>
        <label className="field">
          PAN number
          <input className="in mono" name="panNumber" placeholder="ABCDE1234F" style={{ maxWidth: 220 }} />
        </label>
      </Section>

      <Section title="Contact details">
        <Row>
          <label className="field">
            Mobile number (primary)
            <input className="in mono" name="mobilePrimary" placeholder="+91 98XXX XXXXX" />
          </label>
          <label className="field">
            Mobile number (alternate)
            <input className="in mono" name="mobileAlternate" placeholder="+91 98XXX XXXXX" />
          </label>
        </Row>
        <label className="field">
          Personal email address
          <input className="in" type="email" name="personalEmail" placeholder="priya.kapoor@example.com" />
        </label>
        <Row>
          <label className="field">
            Current address
            <textarea className="in" name="currentAddress" rows={2} />
          </label>
          <label className="field">
            Permanent address
            <textarea className="in" name="permanentAddress" rows={2} />
          </label>
        </Row>
        <Row>
          <label className="field">
            Emergency contact name
            <input className="in" name="emergencyContactName" />
          </label>
          <label className="field">
            Emergency contact number
            <input className="in mono" name="emergencyContactPhone" />
          </label>
        </Row>
      </Section>

      <Section title="Employment details">
        <Row>
          <label className="field">
            Employee ID
            <div style={{ display: "flex", gap: 6 }}>
              <input ref={employeeIdRef} className="in mono" name="employeeId" placeholder="EMP-0001" style={{ flex: 1 }} />
              <span onClick={suggest} style={{ fontSize: 11.5, fontWeight: 700, color: "var(--marigold-deep)", cursor: "pointer", whiteSpace: "nowrap", alignSelf: "center" }}>
                Suggest
              </span>
            </div>
          </label>
          <label className="field">
            Designation/role
            <input className="in" name="designation" placeholder={staffType === "teaching" ? "Teacher" : "Accountant"} />
          </label>
        </Row>
        <Row>
          <label className="field">
            Department
            <input className="in" name="department" placeholder={staffType === "teaching" ? "Academic" : "Non-academic"} />
          </label>
          <label className="field">
            Employment type
            <select className="in" name="employmentType" defaultValue="">
              <option value="">—</option>
              <option value="Full-time">Full-time</option>
              <option value="Part-time">Part-time</option>
              <option value="Contract">Contract</option>
            </select>
          </label>
        </Row>
        <Row>
          <label className="field">
            Reporting manager
            <select className="in" name="reportingManagerId" defaultValue="">
              <option value="">— None —</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Work location/campus
            <input className="in" name="workLocation" placeholder="Main campus" />
          </label>
        </Row>
        {staffType === "nonTeaching" && (
          <label className="field">
            Driver's license number <span style={{ fontWeight: 400, color: "var(--muted)" }}>(if applicable)</span>
            <input className="in mono" name="driversLicenseNo" />
          </label>
        )}
        {staffType === "teaching" && (
          <div style={{ fontSize: 11.5, color: "var(--faint)" }}>Subjects taught &amp; classes assigned are set from Academic Management → Subjects, once this staff member is added.</div>
        )}
      </Section>

      <Section title="Qualification & experience">
        <Row>
          <label className="field">
            Highest educational qualification
            <input className="in" name="qualifications" placeholder="M.Sc. Mathematics" />
          </label>
          <label className="field">
            Specialization
            <input className="in" name="specialization" placeholder="Mathematics, Grades 6-10" />
          </label>
        </Row>
        {staffType === "teaching" && (
          <label className="field">
            Teaching certification <span style={{ fontWeight: 400, color: "var(--muted)" }}>(B.Ed, etc.)</span>
            <input className="in" name="teachingCertification" />
          </label>
        )}
        <Row>
          <label className="field">
            Total years of experience
            <input className="in mono" type="number" min={0} name="yearsOfExperience" />
          </label>
          <label className="field">
            Previous employer name
            <input className="in" name="previousEmployerName" />
          </label>
        </Row>
        <label className="field">
          Previous designation
          <input className="in" name="previousDesignation" style={{ maxWidth: 260 }} />
        </label>
      </Section>

      <Section title="Compensation & banking">
        <Row>
          <label className="field">
            Salary/pay grade
            <input className="in" name="salaryPayGrade" placeholder="Grade III" />
          </label>
          <label className="field">
            Bank name
            <input className="in" name="bankName" />
          </label>
        </Row>
        <Row>
          <label className="field">
            Bank account number
            <input className="in mono" name="bankAccountNumber" />
          </label>
          <label className="field">
            IFSC code
            <input className="in mono" name="ifscCode" />
          </label>
        </Row>
        <Row>
          <label className="field">
            PF number
            <input className="in mono" name="pfNumber" />
          </label>
          <label className="field">
            UAN
            <input className="in mono" name="uanNumber" />
          </label>
        </Row>
        <label className="field">
          ESI number <span style={{ fontWeight: 400, color: "var(--muted)" }}>(if applicable)</span>
          <input className="in mono" name="esiNumber" style={{ maxWidth: 220 }} />
        </label>
      </Section>

      {state.error && (
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--critical)", background: "var(--critical-tint)", border: "1px solid var(--critical-border)", borderRadius: 8, padding: "8px 11px" }}>
          {state.error}
        </p>
      )}

      <div style={{ display: "flex", gap: 10, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
        <button type="submit" disabled={pending} style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13.5, fontWeight: 700, cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1 }}>
          {pending ? "Adding…" : "Add staff"}
        </button>
        <Link href="/app/employees" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "9px 18px", fontSize: 13.5, fontWeight: 600, textDecoration: "none", color: "var(--ink)" }}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
