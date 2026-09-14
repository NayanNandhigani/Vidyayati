"use client";

import { useState } from "react";
import { gradeColor, FEE_STATUS_STYLE } from "@/lib/academic";
import { IconUsers, IconCheckSquare, IconEdit, IconReceipt, IconTruck, IconFileText, IconPaperclip, IconClipboard } from "@/components/icons";
import type { AttendanceStatus } from "@prisma/client";
import RecordsPanel from "./RecordsPanel";
import PersonDocumentsPanel, { type PersonDocumentRow } from "@/components/PersonDocumentsPanel";
import { addStudentDocument } from "../depth-actions";
import GuardianRow from "./GuardianRow";
import StudentFeeAllocationPanel from "./StudentFeeAllocationPanel";

type StudentDetail = {
  id: string;
  dob: Date | null;
  gender: string | null;
  admissionNo: string;
  class: { grade: string; section: string };
  parentLinks: { id: string; relation: string; isPrimary: boolean; parent: { id: string; name: string; phone: string | null; preferredContactMethod: string | null } }[];
  transportAssignment: {
    route: { name: string; vehicle: { driverName: string | null; vehicleNo: string | null } | null };
    stop: { stopName: string; pickupTime: Date | null };
  } | null;
  attendance: { date: Date; status: AttendanceStatus }[];
  feePayments: { amount: unknown; paidOn: Date; feeStructure: { term: string } }[];
};

type ExamResult = { examName: string; date: Date; obtained: number; max: number };

type Props = {
  student: StudentDetail;
  attendancePct: number | null;
  attendanceTotals: { PRESENT: number; ABSENT: number; HALF_DAY: number };
  examResults: ExamResult[];
  latestExamGrade: string | null;
  latestExamPct: number | null;
  feeStructures: { id: string; term: string; amount: unknown; dueDate: Date }[];
  features: { medicalInfo: boolean; priorSchool: boolean; siblings: boolean; documents: boolean };
  medical: { address: string | null; bloodGroup: string | null; medicalNotes: string | null };
  emergencyContacts: { id: string; name: string; relation: string; phone: string; priority: number }[];
  priorSchool: { previousSchoolName: string | null; previousTcNo: string | null; previousTcDate: string | null; priorPerformanceNote: string | null };
  siblings: { id: string; name: string; className: string; admissionNo: string }[];
  documents: PersonDocumentRow[];
  admission: AdmissionDetail | null;
  actualFee: number | null;
  chargedFee: number | null;
  isAdmin: boolean;
};

// Everything captured on the Admissions detailed application form — carried
// over here read-only via the Student's linked AdmissionEnquiry
// (convertedStudentId), so nothing typed at admission time is lost once the
// enquiry becomes a Student. null for a student added directly (+Add
// Student / bulk import) rather than through an admission enquiry.
type AdmissionDetail = {
  dob: string | null;
  gender: string | null;
  bloodGroup: string | null;
  nationality: string | null;
  caste: string | null;
  religionCategory: string | null;
  motherTongue: string | null;
  studentAadhaarNumber: string | null;
  fatherName: string | null;
  motherName: string | null;
  guardianName: string | null;
  fatherOccupation: string | null;
  motherOccupation: string | null;
  annualIncome: string | null;
  parentContact: string | null;
  contactNumber2: string | null;
  email: string | null;
  parentAadhaarNumber: string | null;
  permanentAddress: string | null;
  currentAddress: string | null;
  pincode: string | null;
  allergiesConditions: string | null;
  emergencyContactName: string | null;
  emergencyContactNumber: string | null;
  familyDoctorContact: string | null;
  udiseNumber: string | null;
  penNumber: string | null;
};

const BASE_TABS = [
  { key: "Profile", label: "Profile", icon: IconUsers },
  { key: "Attendance", label: "Attendance", icon: IconCheckSquare },
  { key: "Academics", label: "Academic performance", icon: IconEdit },
  { key: "Fees", label: "Fees", icon: IconReceipt },
  { key: "Transport", label: "Transport", icon: IconTruck },
] as const;

export default function ProfileTabs({
  student,
  attendancePct,
  attendanceTotals,
  examResults,
  latestExamGrade,
  latestExamPct,
  feeStructures,
  features,
  medical,
  emergencyContacts,
  priorSchool,
  siblings,
  documents,
  admission,
  actualFee,
  chargedFee,
  isAdmin,
}: Props) {
  const showRecords = features.medicalInfo || features.priorSchool || features.siblings;
  const TABS = [
    ...BASE_TABS,
    ...(showRecords ? [{ key: "Records" as const, label: "Records", icon: IconFileText }] : []),
    ...(features.documents ? [{ key: "Documents" as const, label: "Documents", icon: IconPaperclip }] : []),
    ...(admission ? [{ key: "Admission" as const, label: "Admission Details", icon: IconClipboard }] : []),
  ];
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("Profile");

  const totalDue = feeStructures.reduce((s, f) => s + Number(f.amount), 0);
  const totalPaid = student.feePayments.reduce((s, p) => s + Number(p.amount), 0);
  const totalDueRemaining = Math.max(0, totalDue - totalPaid);
  const paidStructureTerms = new Set(student.feePayments.map((p) => p.feeStructure.term));

  return (
    <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <span
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 5,
                flex: 1,
                textAlign: "center",
                padding: "10px 6px",
                borderRadius: 8,
                cursor: "pointer",
                userSelect: "none",
                color: active ? "var(--marigold-deep)" : "var(--muted)",
                fontWeight: active ? 700 : 500,
                background: active ? "var(--marigold-tint)" : "transparent",
                border: active ? "1px solid var(--marigold)" : "1px solid transparent",
              }}
            >
              <Icon style={{ width: 18, height: 18 }} />
              <span style={{ fontSize: 11.5 }}>{t.label}</span>
            </span>
          );
        })}
      </div>

      <div>
        {tab === "Profile" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, fontSize: 13.5, maxWidth: 560 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              <Row label="Date of birth" value={student.dob ? student.dob.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"} />
              <Row label="Gender" value={student.gender ? student.gender[0] + student.gender.slice(1).toLowerCase() : "—"} />
              <Row label="Admission number" value={student.admissionNo} mono />
              <Row label="Class" value={`${student.class.grade}-${student.class.section}`} mono last />
            </div>

            <div>
              <div style={{ fontSize: 11, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 9 }}>Parents / guardians</div>
              {student.parentLinks.length === 0 ? (
                <div style={{ color: "var(--muted)", fontSize: 13 }}>No guardian linked yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {student.parentLinks.map((link) => (
                    <GuardianRow key={link.id} studentId={student.id} link={link} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "Attendance" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
              <StatBox label="Present" value={attendanceTotals.PRESENT} color="var(--good)" />
              <StatBox label="Half day" value={attendanceTotals.HALF_DAY} color="var(--warn)" />
              <StatBox label="Absent" value={attendanceTotals.ABSENT} color="var(--critical)" />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
              <div style={{ fontSize: 11, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Last 15 recorded days</div>
              <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: "var(--teal)" }}>
                {attendancePct === null ? "No data" : `${attendancePct}% present`}
              </div>
            </div>
            {student.attendance.length === 0 ? (
              <div style={{ color: "var(--muted)", fontSize: 13, padding: "16px 0" }}>No attendance recorded yet.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(10,1fr)", gap: 6 }}>
                {[...student.attendance].reverse().map((a, i) => {
                  const styleMap = {
                    PRESENT: { bg: "var(--good-tint)", fg: "var(--good)", mark: "P" },
                    ABSENT: { bg: "var(--critical-tint)", fg: "var(--critical)", mark: "A" },
                    HALF_DAY: { bg: "var(--warn-tint)", fg: "var(--warn)", mark: "H" },
                  } as const;
                  const s = styleMap[a.status];
                  return (
                    <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, borderRadius: 6, padding: "7px 0", background: s.bg, color: s.fg }}>
                      <span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>
                        {a.date.getDate()}
                      </span>
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", opacity: 0.85 }}>{s.mark}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === "Academics" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
              <StatBox label="Latest score" value={latestExamPct === null ? "—" : `${latestExamPct}%`} color="var(--teal)" />
              <StatBox label="Latest grade" value={latestExamGrade ?? "—"} />
              <StatBox label="Exams recorded" value={examResults.length} />
            </div>
            <div style={{ fontSize: 11, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 9 }}>Recent exams</div>
            {examResults.length === 0 ? (
              <div style={{ color: "var(--muted)", fontSize: 13, padding: "16px 0" }}>No exam results recorded yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {examResults.map((e) => {
                  const pct = Math.round((e.obtained / e.max) * 100);
                  const grade = pct >= 90 ? "A+" : pct >= 80 ? "A" : pct >= 70 ? "B+" : pct >= 60 ? "B" : pct >= 50 ? "C" : "D";
                  return (
                    <div key={e.examName + e.date.toISOString()} style={{ display: "grid", gridTemplateColumns: "1.7fr 0.9fr 0.6fr auto", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--paper)", borderRadius: 8 }}>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{e.examName}</div>
                        <div style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 1 }}>{e.date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
                      </div>
                      <div className="mono" style={{ fontSize: 12.5, fontWeight: 700, textAlign: "right" }}>
                        {e.obtained}
                        <span style={{ color: "var(--faint)", fontWeight: 500 }}> / {e.max}</span>
                      </div>
                      <div className="mono" style={{ fontSize: 12.5, fontWeight: 700, textAlign: "right", color: gradeColor(grade) }}>
                        {pct}%
                      </div>
                      <span className="pill" style={{ background: "var(--paper)", color: gradeColor(grade), border: "1px solid var(--line)" }}>
                        {grade}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === "Fees" && (
          <>
            <StudentFeeAllocationPanel studentId={student.id} actualFee={actualFee} chargedFee={chargedFee} isAdmin={isAdmin} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
              <StatBox label="Total fee" value={`₹${totalDue.toLocaleString("en-IN")}`} />
              <StatBox label="Paid" value={`₹${totalPaid.toLocaleString("en-IN")}`} color="var(--good)" />
              <StatBox label="Due" value={`₹${totalDueRemaining.toLocaleString("en-IN")}`} color="var(--warn)" />
            </div>
            <div style={{ fontSize: 11, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 9 }}>Installments</div>
            {feeStructures.length === 0 ? (
              <div style={{ color: "var(--muted)", fontSize: 13, padding: "16px 0" }}>No fee structure set for this class yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {feeStructures.map((fs) => {
                  const paid = paidStructureTerms.has(fs.term);
                  const overdue = !paid && fs.dueDate < new Date();
                  const status = paid ? "PAID" : overdue ? "OVERDUE" : "PENDING";
                  const style = FEE_STATUS_STYLE[status];
                  return (
                    <div
                      key={fs.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.6fr 0.9fr auto",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        background: "var(--paper)",
                        borderRadius: 8,
                        boxShadow: overdue ? "inset 3px 0 0 var(--critical)" : undefined,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{fs.term}</div>
                        <div style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 1 }}>
                          {paid ? "Paid" : `Due ${fs.dueDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`}
                        </div>
                      </div>
                      <div className="mono" style={{ fontSize: 12.5, fontWeight: 700, textAlign: "right" }}>
                        ₹{Number(fs.amount).toLocaleString("en-IN")}
                      </div>
                      <span className="pill" style={{ background: style.bg, color: style.fg }}>
                        {style.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === "Transport" &&
          (student.transportAssignment ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 13, fontSize: 13.5, maxWidth: 480 }}>
              <Row label="Route" value={student.transportAssignment.route.name} />
              <Row label="Driver" value={student.transportAssignment.route.vehicle?.driverName ?? "—"} />
              <Row label="Vehicle number" value={student.transportAssignment.route.vehicle?.vehicleNo ?? "—"} mono />
              <Row label="Pickup stop" value={student.transportAssignment.stop.stopName} />
              <Row
                label="Pickup time"
                value={student.transportAssignment.stop.pickupTime ? student.transportAssignment.stop.pickupTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                mono
                last
              />
            </div>
          ) : (
            <div style={{ color: "var(--muted)", fontSize: 13, padding: "16px 0" }}>Not assigned to a transport route.</div>
          ))}

        {tab === "Records" && (
          <RecordsPanel
            studentId={student.id}
            showMedical={features.medicalInfo}
            showPriorSchool={features.priorSchool}
            showSiblings={features.siblings}
            medical={medical}
            contacts={emergencyContacts}
            priorSchool={priorSchool}
            siblings={siblings}
          />
        )}

        {tab === "Documents" && (
          <PersonDocumentsPanel
            documents={documents}
            redirectPath={`/app/students/${student.id}`}
            onUpload={(category, formData) => addStudentDocument(student.id, category, formData)}
            assetUrlBase="/api/person-documents"
          />
        )}

        {tab === "Admission" && admission && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20, fontSize: 13.5, maxWidth: 640 }}>
            <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
              Carried over from this student's admission application — read-only.
            </div>

            <AdmissionSection title="Student">
              <Row label="Date of birth" value={admission.dob ? new Date(admission.dob).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"} />
              <Row label="Gender" value={admission.gender ? admission.gender[0] + admission.gender.slice(1).toLowerCase() : "—"} />
              <Row label="Blood group" value={admission.bloodGroup ?? "—"} />
              <Row label="Nationality" value={admission.nationality ?? "—"} />
              <Row label="Caste" value={admission.caste ?? "—"} />
              <Row label="Religion / Category" value={admission.religionCategory ?? "—"} />
              <Row label="Mother tongue" value={admission.motherTongue ?? "—"} />
              <Row label="Aadhaar number (student)" value={admission.studentAadhaarNumber ?? "—"} mono last />
            </AdmissionSection>

            <AdmissionSection title="Parent / Guardian">
              <Row label="Father's name" value={admission.fatherName ?? "—"} />
              <Row label="Mother's name" value={admission.motherName ?? "—"} />
              <Row label="Guardian's name" value={admission.guardianName ?? "—"} />
              <Row label="Father's occupation" value={admission.fatherOccupation ?? "—"} />
              <Row label="Mother's occupation" value={admission.motherOccupation ?? "—"} />
              <Row label="Annual income" value={admission.annualIncome ?? "—"} />
              <Row label="Contact number 1" value={admission.parentContact ?? "—"} mono />
              <Row label="Contact number 2" value={admission.contactNumber2 ?? "—"} mono />
              <Row label="Email address" value={admission.email ?? "—"} />
              <Row label="Aadhaar number (parents)" value={admission.parentAadhaarNumber ?? "—"} mono last />
            </AdmissionSection>

            <AdmissionSection title="Address">
              <Row label="Permanent address" value={admission.permanentAddress ?? "—"} />
              <Row label="Current / correspondence address" value={admission.currentAddress ?? "—"} />
              <Row label="Pincode" value={admission.pincode ?? "—"} mono last />
            </AdmissionSection>

            <AdmissionSection title="Health / Emergency">
              <Row label="Known allergies / medical conditions" value={admission.allergiesConditions ?? "—"} />
              <Row label="Emergency contact name" value={admission.emergencyContactName ?? "—"} />
              <Row label="Emergency contact number" value={admission.emergencyContactNumber ?? "—"} mono />
              <Row label="Family doctor contact" value={admission.familyDoctorContact ?? "—"} mono last />
            </AdmissionSection>

            <AdmissionSection title="Academic Reference Details">
              <Row label="UDISE number" value={admission.udiseNumber ?? "—"} mono />
              <Row label="PEN number" value={admission.penNumber ?? "—"} mono last />
            </AdmissionSection>
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div style={{ background: "var(--paper)", borderRadius: 8, padding: 12 }}>
      <div style={{ fontSize: 10.5, color: "var(--faint)", marginBottom: 3 }}>{label}</div>
      <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: color ?? "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}

function AdmissionSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 9 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
    </div>
  );
}

function Row({ label, value, mono, last }: { label: string; value: string; mono?: boolean; last?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: last ? undefined : "1px solid var(--line)", paddingBottom: last ? 0 : 10 }}>
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span className={mono ? "mono" : undefined} style={{ fontWeight: 600 }}>
        {value}
      </span>
    </div>
  );
}
