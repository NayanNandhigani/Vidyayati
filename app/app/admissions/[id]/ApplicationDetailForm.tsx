"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Gender, AdmissionStage, AdmissionApprovalStatus } from "@prisma/client";
import { updateApplicationDetails, submitForAdmitApproval, approveAdmissionWithFee, rejectAdmission, type ApplicationFields } from "../depth-actions";

type Enquiry = ApplicationFields & {
  id: string;
  applicantName: string;
  parentContact: string;
  classApplied: string;
  stage: AdmissionStage;
  approvalStatus: AdmissionApprovalStatus;
  parentName: string | null;
  address: string | null;
};

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

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  NONE: { bg: "var(--line)", fg: "var(--muted)" },
  PENDING: { bg: "var(--warn-tint)", fg: "var(--warn)" },
  APPROVED: { bg: "var(--good-tint)", fg: "var(--good)" },
  REJECTED: { bg: "var(--critical-tint)", fg: "var(--critical)" },
};

type ClassOption = { id: string; grade: string; section: string; actualFee: number | null };

export default function ApplicationDetailForm({ enquiry, classes, canEdit, isAdmin }: { enquiry: Enquiry; classes: ClassOption[]; canEdit: boolean; isAdmin: boolean }) {
  const [pending, startTransition] = useTransition();
  const [fields, setFields] = useState<ApplicationFields>({
    photoPath: enquiry.photoPath,
    dob: enquiry.dob,
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
  });
  const [saved, setSaved] = useState(false);
  const [approving, setApproving] = useState(false);
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [feeDesc, setFeeDesc] = useState("Admission fee");
  const [feeAmount, setFeeAmount] = useState("");
  const [chargedFee, setChargedFee] = useState("");

  const selectedClass = classes.find((c) => c.id === classId);
  const actualFee = selectedClass?.actualFee ?? null;
  const scholarship = actualFee != null && chargedFee !== "" ? actualFee - Number(chargedFee) : null;

  function set<K extends keyof ApplicationFields>(key: K, value: ApplicationFields[K]) {
    setFields((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  function save() {
    startTransition(async () => {
      await updateApplicationDetails(enquiry.id, fields);
      setSaved(true);
    });
  }

  function submit() {
    startTransition(() => submitForAdmitApproval(enquiry.id));
  }
  function approve() {
    if (!classId) return;
    if (chargedFee !== "" && actualFee != null && Number(chargedFee) > actualFee) {
      alert("Charged fee can't be more than the actual fee.");
      return;
    }
    startTransition(async () => {
      await approveAdmissionWithFee(enquiry.id, classId, feeDesc, feeAmount ? Number(feeAmount) : null, chargedFee ? Number(chargedFee) : null);
    });
  }
  function reject() {
    startTransition(() => rejectAdmission(enquiry.id));
  }

  const disabled = !canEdit || enquiry.stage === "ADMITTED";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
          Applying for <b>{enquiry.classApplied}</b> · {enquiry.parentContact}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="pill" style={{ background: STATUS_STYLE[enquiry.approvalStatus].bg, color: STATUS_STYLE[enquiry.approvalStatus].fg }}>
            {enquiry.stage === "ADMITTED" ? "Admitted" : enquiry.approvalStatus === "NONE" ? "Draft" : enquiry.approvalStatus}
          </span>
          <Link href={`/app/admissions/${enquiry.id}/print`} target="_blank" style={{ fontSize: 12, fontWeight: 700, color: "var(--marigold-deep)", textDecoration: "none" }}>
            Printable form ↗
          </Link>
        </div>
      </div>

      <Section title="Student">
        <Row>
          <label className="field">
            Date of birth
            <input className="in mono" type="date" value={fields.dob ?? ""} onChange={(e) => set("dob", e.target.value || null)} disabled={disabled} />
          </label>
          <label className="field">
            Gender
            <select className="in" value={fields.gender ?? ""} onChange={(e) => set("gender", (e.target.value || null) as Gender | null)} disabled={disabled}>
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
            <input className="in" value={fields.bloodGroup ?? ""} onChange={(e) => set("bloodGroup", e.target.value || null)} disabled={disabled} />
          </label>
          <label className="field">
            Nationality
            <input className="in" value={fields.nationality ?? ""} onChange={(e) => set("nationality", e.target.value || null)} disabled={disabled} />
          </label>
        </Row>
        <Row>
          <label className="field">
            Caste
            <input className="in" value={fields.caste ?? ""} onChange={(e) => set("caste", e.target.value || null)} disabled={disabled} />
          </label>
          <label className="field">
            Religion/Category
            <select className="in" value={fields.religionCategory ?? ""} onChange={(e) => set("religionCategory", e.target.value || null)} disabled={disabled}>
              <option value="">—</option>
              <option>General</option>
              <option>OBC</option>
              <option>SC</option>
              <option>ST</option>
              <option>EWS</option>
            </select>
          </label>
        </Row>
        <Row>
          <label className="field">
            Mother tongue
            <input className="in" value={fields.motherTongue ?? ""} onChange={(e) => set("motherTongue", e.target.value || null)} disabled={disabled} />
          </label>
          <label className="field">
            Aadhaar number (student)
            <input className="in mono" value={fields.studentAadhaarNumber ?? ""} onChange={(e) => set("studentAadhaarNumber", e.target.value || null)} disabled={disabled} />
          </label>
        </Row>
      </Section>

      <Section title="Parent/Guardian">
        <Row>
          <label className="field">
            Father's name
            <input className="in" value={fields.fatherName ?? ""} onChange={(e) => set("fatherName", e.target.value || null)} disabled={disabled} />
          </label>
          <label className="field">
            Mother's name
            <input className="in" value={fields.motherName ?? ""} onChange={(e) => set("motherName", e.target.value || null)} disabled={disabled} />
          </label>
        </Row>
        <Row>
          <label className="field">
            Guardian's name <span style={{ fontWeight: 400, color: "var(--muted)" }}>(if applicable)</span>
            <input className="in" value={fields.guardianName ?? ""} onChange={(e) => set("guardianName", e.target.value || null)} disabled={disabled} />
          </label>
          <label className="field">
            Contact number 2
            <input className="in mono" value={fields.contactNumber2 ?? ""} onChange={(e) => set("contactNumber2", e.target.value || null)} disabled={disabled} />
          </label>
        </Row>
        <Row>
          <label className="field">
            Father's occupation
            <input className="in" value={fields.fatherOccupation ?? ""} onChange={(e) => set("fatherOccupation", e.target.value || null)} disabled={disabled} />
          </label>
          <label className="field">
            Mother's occupation
            <input className="in" value={fields.motherOccupation ?? ""} onChange={(e) => set("motherOccupation", e.target.value || null)} disabled={disabled} />
          </label>
        </Row>
        <Row>
          <label className="field">
            Annual income
            <input className="in" value={fields.annualIncome ?? ""} onChange={(e) => set("annualIncome", e.target.value || null)} disabled={disabled} />
          </label>
          <label className="field">
            Email address
            <input className="in" type="email" value={fields.email ?? ""} onChange={(e) => set("email", e.target.value || null)} disabled={disabled} />
          </label>
        </Row>
        <label className="field">
          Aadhaar number (parents)
          <input className="in mono" value={fields.parentAadhaarNumber ?? ""} onChange={(e) => set("parentAadhaarNumber", e.target.value || null)} disabled={disabled} style={{ maxWidth: 260 }} />
        </label>
      </Section>

      <Section title="Address">
        <Row>
          <label className="field">
            Permanent address
            <textarea className="in" rows={2} value={fields.permanentAddress ?? ""} onChange={(e) => set("permanentAddress", e.target.value || null)} disabled={disabled} />
          </label>
          <label className="field">
            Current/correspondence address
            <textarea className="in" rows={2} value={fields.currentAddress ?? ""} onChange={(e) => set("currentAddress", e.target.value || null)} disabled={disabled} />
          </label>
        </Row>
        <label className="field">
          Pincode
          <input className="in mono" value={fields.pincode ?? ""} onChange={(e) => set("pincode", e.target.value || null)} disabled={disabled} style={{ maxWidth: 140 }} />
        </label>
      </Section>

      <Section title="Health / emergency">
        <label className="field">
          Known allergies/medical conditions
          <textarea className="in" rows={2} value={fields.allergiesConditions ?? ""} onChange={(e) => set("allergiesConditions", e.target.value || null)} disabled={disabled} />
        </label>
        <Row>
          <label className="field">
            Emergency contact name
            <input className="in" value={fields.emergencyContactName ?? ""} onChange={(e) => set("emergencyContactName", e.target.value || null)} disabled={disabled} />
          </label>
          <label className="field">
            Emergency contact number
            <input className="in mono" value={fields.emergencyContactNumber ?? ""} onChange={(e) => set("emergencyContactNumber", e.target.value || null)} disabled={disabled} />
          </label>
        </Row>
        <label className="field">
          Family doctor contact
          <input className="in mono" value={fields.familyDoctorContact ?? ""} onChange={(e) => set("familyDoctorContact", e.target.value || null)} disabled={disabled} style={{ maxWidth: 260 }} />
        </label>
      </Section>

      <Section title="Academic reference details">
        <Row>
          <label className="field">
            UDISE Number
            <input className="in mono" value={fields.udiseNumber ?? ""} onChange={(e) => set("udiseNumber", e.target.value || null)} disabled={disabled} />
          </label>
          <label className="field">
            PEN Number
            <input className="in mono" value={fields.penNumber ?? ""} onChange={(e) => set("penNumber", e.target.value || null)} disabled={disabled} />
          </label>
        </Row>
      </Section>

      {!disabled && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", borderTop: "1px solid var(--line)", paddingTop: 16 }}>
          <button type="button" onClick={save} disabled={pending} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, color: "var(--ink)", cursor: pending ? "default" : "pointer" }}>
            {pending ? "Saving…" : "Save application"}
          </button>
          {saved && <span style={{ fontSize: 12, color: "var(--good)", fontWeight: 600 }}>Saved.</span>}

          {enquiry.stage === "APPLICATION" && (enquiry.approvalStatus === "NONE" || enquiry.approvalStatus === "REJECTED") && (
            <button type="button" onClick={submit} disabled={pending} style={{ marginLeft: "auto", background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: pending ? "default" : "pointer" }}>
              {enquiry.approvalStatus === "REJECTED" ? "Resubmit for approval" : "Admit →"}
            </button>
          )}
        </div>
      )}

      {enquiry.approvalStatus === "PENDING" && isAdmin && (
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }}>
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 12 }}>
            Admit approval
          </div>
          {!approving ? (
            <button type="button" onClick={() => setApproving(true)} style={{ background: "var(--good)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Review & approve
            </button>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 420 }}>
              <label className="field">
                Class
                <select className="in" value={classId} onChange={(e) => setClassId(e.target.value)}>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.grade}-{c.section}
                    </option>
                  ))}
                </select>
              </label>
              <Row>
                <label className="field">
                  Opening fee description <span style={{ fontWeight: 400, color: "var(--muted)" }}>(optional)</span>
                  <input className="in" value={feeDesc} onChange={(e) => setFeeDesc(e.target.value)} />
                </label>
                <label className="field">
                  Opening fee amount (₹)
                  <input className="in mono" type="number" min={0} value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} placeholder="0" />
                </label>
              </Row>
              <Row>
                <label className="field">
                  Actual fee (₹) <span style={{ fontWeight: 400, color: "var(--muted)" }}>from Class {selectedClass?.grade}'s Fee Structure</span>
                  <input className="in mono" value={actualFee != null ? `₹${actualFee.toLocaleString("en-IN")}` : "Not set"} disabled />
                </label>
                <label className="field">
                  Charged fee (₹)
                  <input className="in mono" type="number" min={0} value={chargedFee} onChange={(e) => setChargedFee(e.target.value)} placeholder="0" />
                </label>
              </Row>
              <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
                Scholarship: <span className="mono" style={{ fontWeight: 700, color: scholarship ? "var(--good)" : "var(--faint)" }}>{scholarship !== null ? `₹${scholarship.toLocaleString("en-IN")}` : "—"}</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={approve} disabled={pending} style={{ background: "var(--good)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: pending ? "default" : "pointer" }}>
                  {pending ? "Approving…" : "Approve & create student"}
                </button>
                <button type="button" onClick={reject} disabled={pending} style={{ background: "var(--card)", border: "1px solid var(--critical)", color: "var(--critical)", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: pending ? "default" : "pointer" }}>
                  Reject
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
