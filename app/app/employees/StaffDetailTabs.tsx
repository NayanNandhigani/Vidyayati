"use client";

import { useState, useTransition } from "react";
import type { AccessLevel } from "@prisma/client";
import { cyclePermission, removeClassPermission, runPayroll } from "./actions";
import { addStaffDocument } from "./depth-actions";
import { addSalaryComponent, removeSalaryComponent, runStructuredPayroll } from "./payroll-depth-actions";
import { updateStaffProfileDetails, createLeaveType, deleteLeaveType, applyForStaffLeave, actOnStaffLeave } from "./hr-depth-actions";
import PersonDocumentsPanel, { type PersonDocumentRow } from "@/components/PersonDocumentsPanel";

const MODULES = ["Students", "Employees", "Attendance", "Exams", "Homework", "Timetable", "Teaching", "Fees", "Accounts", "Admissions", "Transport", "Library", "Events", "Certificates", "Communication", "Reports"];

// Only these modules act on one class at a time — the rest (Fees, Accounts,
// Admissions, etc.) don't have a per-class concept, so they only ever get
// the school-wide row and no "+ add class override" control.
const CLASS_SCOPED_MODULES = new Set(["Students", "Attendance", "Exams", "Homework", "Timetable"]);

const LEVEL_STYLE: Record<AccessLevel, { bg: string; fg: string; label: string }> = {
  NONE: { bg: "var(--line)", fg: "var(--faint)", label: "No access" },
  VIEW: { bg: "var(--marigold-tint)", fg: "var(--marigold-deep)", label: "View only" },
  EDIT: { bg: "var(--teal-tint)", fg: "var(--teal)", label: "View + Edit" },
};

type Staff = {
  id: string;
  designation: string | null;
  department: string | null;
  dateJoined: string | null;
  employmentStatus: "ACTIVE" | "ON_LEAVE";
  user: { name: string; username: string; phone: string | null };
  qualifications: string | null;
  specialization: string | null;
  shiftStart: string | null;
  isSelf: boolean;
};

type PermRow = { moduleName: string; classId: string | null; accessLevel: AccessLevel };
type ClassOption = { id: string; grade: string; section: string };
type LeaveType = { id: string; name: string; quota: number; used: number; remaining: number };
type LeaveRequest = { id: string; leaveTypeName: string; dateFrom: string; dateTo: string; reason: string; status: "PENDING" | "APPROVED" | "REJECTED" };

type Props = {
  staff: Staff;
  isAdmin: boolean;
  attendanceTotals: { PRESENT: number; ABSENT: number; HALF_DAY: number };
  recentAttendance: { date: string; status: "PRESENT" | "ABSENT" | "HALF_DAY"; checkInTime: string | null }[];
  payrollRuns: { month: string; amount: number; status: "PENDING" | "PAID"; paidOn: string | null; grossAmount: number | null; pfAmount: number | null; esiAmount: number | null; tdsAmount: number | null; ptAmount: number | null; lopAmount: number | null }[];
  permissions: PermRow[];
  classes: ClassOption[];
  showDocuments: boolean;
  documents: PersonDocumentRow[];
  showStructuredPayroll: boolean;
  salaryComponents: { id: string; name: string; amount: number }[];
  showLeave: boolean;
  leaveTypes: LeaveType[];
  allLeaveTypes: { id: string; name: string }[];
  leaveRequests: LeaveRequest[];
  pendingLeaveRequests: (LeaveRequest & { staffName: string })[];
};

const BASE_TABS = ["Profile", "Attendance", "Payroll", "Access & Permissions"] as const;

export default function StaffDetailTabs({
  staff,
  isAdmin,
  attendanceTotals,
  recentAttendance,
  payrollRuns,
  permissions,
  classes,
  showDocuments,
  documents,
  showStructuredPayroll,
  salaryComponents,
  showLeave,
  leaveTypes,
  allLeaveTypes,
  leaveRequests,
  pendingLeaveRequests,
}: Props) {
  const [componentName, setComponentName] = useState("");
  const [componentAmount, setComponentAmount] = useState("");
  const [structuredResult, setStructuredResult] = useState<{ gross: number; pf: number; esi: number; tds: number; pt: number; lop: number; net: number } | null>(null);
  const [qualifications, setQualifications] = useState(staff.qualifications ?? "");
  const [specialization, setSpecialization] = useState(staff.specialization ?? "");
  const [shiftStart, setShiftStart] = useState(staff.shiftStart ?? "");
  const [leaveTypeName, setLeaveTypeName] = useState("");
  const [leaveTypeQuota, setLeaveTypeQuota] = useState("");
  // Not seeded from allLeaveTypes[0] here — that array can still be empty
  // at first mount and gain entries later in the same session (an admin
  // just added a leave type), and a useState initializer only runs once,
  // so an id chosen then would go stale. Resolved at use-time instead
  // (see effectiveLeaveTypeId below), same fix pattern as FeesView.
  const [applyLeaveTypeId, setApplyLeaveTypeId] = useState("");
  const effectiveLeaveTypeId = applyLeaveTypeId || allLeaveTypes[0]?.id || "";
  const [applyFrom, setApplyFrom] = useState("");
  const [applyTo, setApplyTo] = useState("");
  const [applyReason, setApplyReason] = useState("");

  function saveProfileDetails() {
    startTransition(() => updateStaffProfileDetails(staff.id, qualifications, specialization, shiftStart));
  }

  function addLeaveType() {
    if (!leaveTypeName.trim() || !leaveTypeQuota) return;
    startTransition(async () => {
      await createLeaveType(leaveTypeName, Number(leaveTypeQuota));
      setLeaveTypeName("");
      setLeaveTypeQuota("");
    });
  }

  function submitLeaveRequest() {
    if (!effectiveLeaveTypeId || !applyFrom || !applyTo || !applyReason.trim()) return;
    startTransition(async () => {
      await applyForStaffLeave(staff.id, effectiveLeaveTypeId, applyFrom, applyTo, applyReason);
      setApplyFrom("");
      setApplyTo("");
      setApplyReason("");
    });
  }

  function addComponent() {
    if (!componentName.trim() || !componentAmount) return;
    startTransition(async () => {
      await addSalaryComponent(staff.id, componentName, Number(componentAmount));
      setComponentName("");
      setComponentAmount("");
    });
  }

  function runStructured() {
    startTransition(async () => {
      const res = await runStructuredPayroll(staff.id, currentMonth);
      setStructuredResult(res);
    });
  }
  const TABS = [...BASE_TABS, ...(showLeave ? (["Leave"] as const) : []), ...(showDocuments ? (["Documents"] as const) : [])];
  const [tab, setTab] = useState<(typeof TABS)[number]>("Profile");
  const [perms, setPerms] = useState(permissions);
  const [addingOverrideFor, setAddingOverrideFor] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [payAmount, setPayAmount] = useState("");

  const attendanceTotal = attendanceTotals.PRESENT + attendanceTotals.ABSENT + attendanceTotals.HALF_DAY;
  const attendancePct = attendanceTotal ? Math.round((attendanceTotals.PRESENT / attendanceTotal) * 100) : null;
  const currentMonth = new Date().toISOString().slice(0, 7);
  const latestPay = payrollRuns[0];

  function togglePerm(moduleName: string, classId: string | null) {
    if (!isAdmin) return;
    startTransition(async () => {
      const res = await cyclePermission(staff.id, moduleName, classId);
      setPerms((prev) => {
        const idx = prev.findIndex((p) => p.moduleName === moduleName && p.classId === classId);
        if (idx === -1) return [...prev, { moduleName, classId, accessLevel: res.accessLevel }];
        const next = [...prev];
        next[idx] = { ...next[idx], accessLevel: res.accessLevel };
        return next;
      });
    });
  }

  function addOverride(moduleName: string, classId: string) {
    setAddingOverrideFor(null);
    togglePerm(moduleName, classId);
  }

  function removeOverride(moduleName: string, classId: string) {
    if (!isAdmin) return;
    startTransition(async () => {
      await removeClassPermission(staff.id, moduleName, classId);
      setPerms((prev) => prev.filter((p) => !(p.moduleName === moduleName && p.classId === classId)));
    });
  }

  function pay() {
    const amount = Number(payAmount);
    if (!amount || amount <= 0) return;
    startTransition(async () => {
      await runPayroll(staff.id, currentMonth, amount);
      setPayAmount("");
    });
  }

  return (
    <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 4, background: "var(--paper)", borderRadius: 8, padding: 4, marginBottom: 16 }}>
        {TABS.map((t) => (
          <span
            key={t}
            onClick={() => setTab(t)}
            style={{ flex: t === "Access & Permissions" ? 1.4 : 1, textAlign: "center", padding: "7px 2px", fontSize: 12, borderRadius: 6, cursor: "pointer", userSelect: "none", color: tab === t ? "var(--ink)" : "var(--muted)", fontWeight: tab === t ? 700 : 400, background: tab === t ? "var(--card)" : "transparent", boxShadow: tab === t ? "0 1px 2px rgba(0,0,0,.06)" : "none" }}
          >
            {t}
          </span>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {tab === "Profile" && (
          <>
            <SectionTitle>Employment</SectionTitle>
            <FieldGrid>
              <Field label="Designation" value={staff.designation ?? "—"} />
              <Field label="Department" value={staff.department ?? "—"} />
              <Field label="Date of Joining" value={staff.dateJoined ? new Date(staff.dateJoined).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"} />
              <Field label="Status" value={staff.employmentStatus === "ACTIVE" ? "Active" : "On Leave"} />
            </FieldGrid>
            <SectionTitle>Contact</SectionTitle>
            <FieldGrid>
              <Field label="Phone" value={staff.user.phone ?? "—"} mono />
              <Field label="Username" value={staff.user.username} mono />
            </FieldGrid>
            {showStructuredPayroll && (
              <>
                <SectionTitle>Qualifications & specialization</SectionTitle>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 420 }}>
                  <label className="field">
                    Qualifications
                    <textarea className="in" value={qualifications} onChange={(e) => setQualifications(e.target.value)} onBlur={saveProfileDetails} rows={2} readOnly={!isAdmin} />
                  </label>
                  <label className="field">
                    Specialization
                    <input className="in" value={specialization} onChange={(e) => setSpecialization(e.target.value)} onBlur={saveProfileDetails} readOnly={!isAdmin} placeholder="e.g. Mathematics, Grades 6-10" />
                  </label>
                  <label className="field">
                    Shift start
                    <input className="in mono" type="time" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} onBlur={saveProfileDetails} disabled={!isAdmin} style={{ width: 120 }} />
                  </label>
                </div>
              </>
            )}
          </>
        )}

        {tab === "Attendance" && (
          <>
            <SectionTitle>All-time</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 4 }}>
              <StatTile label="Present Days" value={attendanceTotals.PRESENT} color="var(--good)" />
              <StatTile label="Absent" value={attendanceTotals.ABSENT} color="var(--critical)" />
              <StatTile label="Half day" value={attendanceTotals.HALF_DAY} color="var(--warn)" />
              <StatTile label="Attendance" value={attendancePct === null ? "—" : `${attendancePct}%`} />
            </div>
            <SectionTitle>Last recorded days</SectionTitle>
            {recentAttendance.length === 0 ? (
              <div style={{ color: "var(--muted)", fontSize: 13 }}>No attendance recorded yet.</div>
            ) : (
              recentAttendance.map((a, i) => {
                const style = a.status === "PRESENT" ? { bg: "var(--good-tint)", fg: "var(--good)", label: "Present" } : a.status === "ABSENT" ? { bg: "var(--critical-tint)", fg: "var(--critical)", label: "Absent" } : { bg: "var(--warn-tint)", fg: "var(--warn)", label: "Half day" };
                const d = new Date(a.date);
                const isLate = staff.shiftStart && a.checkInTime && a.checkInTime > staff.shiftStart;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--line)", fontSize: 12.5 }}>
                    <div>
                      <span style={{ color: "var(--ink2)", fontWeight: 600 }}>{d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
                      <span style={{ color: "var(--faint)", fontSize: 11.5, marginLeft: 6 }}>{d.toLocaleDateString("en-IN", { weekday: "short" })}</span>
                      {a.checkInTime && <span className="mono" style={{ fontSize: 11, color: isLate ? "var(--critical)" : "var(--muted)", marginLeft: 8 }}>{a.checkInTime}{isLate && " · Late"}</span>}
                    </div>
                    <span className="pill" style={{ background: style.bg, color: style.fg }}>
                      {style.label}
                    </span>
                  </div>
                );
              })
            )}
          </>
        )}

        {tab === "Leave" && (
          <>
            <SectionTitle>Leave balance — {new Date().getFullYear()}</SectionTitle>
            {leaveTypes.length === 0 ? (
              <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 14 }}>No leave types configured yet.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 18 }}>
                {leaveTypes.map((t) => (
                  <div key={t.id} style={{ background: "var(--paper)", borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 3 }}>{t.name}</div>
                    <div className="mono" style={{ fontSize: 15, fontWeight: 700 }}>{t.remaining}/{t.quota}</div>
                  </div>
                ))}
              </div>
            )}

            {(staff.isSelf || isAdmin) && allLeaveTypes.length > 0 && (
              <>
                <SectionTitle>Apply for leave</SectionTitle>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
                  <select className="in" value={effectiveLeaveTypeId} onChange={(e) => setApplyLeaveTypeId(e.target.value)}>
                    {allLeaveTypes.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input className="in" type="date" value={applyFrom} onChange={(e) => setApplyFrom(e.target.value)} style={{ flex: 1 }} />
                    <input className="in" type="date" value={applyTo} onChange={(e) => setApplyTo(e.target.value)} style={{ flex: 1 }} />
                  </div>
                  <input className="in" placeholder="Reason" value={applyReason} onChange={(e) => setApplyReason(e.target.value)} />
                  <button onClick={submitLeaveRequest} style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                    Submit request
                  </button>
                </div>
              </>
            )}

            <SectionTitle>Requests</SectionTitle>
            {leaveRequests.length === 0 ? (
              <div style={{ color: "var(--muted)", fontSize: 13 }}>No leave requests yet.</div>
            ) : (
              leaveRequests.map((r) => {
                const style = r.status === "APPROVED" ? { bg: "var(--good-tint)", fg: "var(--good)" } : r.status === "REJECTED" ? { bg: "var(--critical-tint)", fg: "var(--critical)" } : { bg: "var(--warn-tint)", fg: "var(--warn)" };
                return (
                  <div key={r.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{r.leaveTypeName}</span>
                      <span className="pill" style={{ background: style.bg, color: style.fg, fontSize: 10.5 }}>{r.status}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>
                      {new Date(r.dateFrom).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} – {new Date(r.dateTo).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} · {r.reason}
                    </div>
                    {isAdmin && r.status === "PENDING" && (
                      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                        <span onClick={() => startTransition(() => actOnStaffLeave(r.id, true))} style={{ fontSize: 11, fontWeight: 700, color: "var(--good)", cursor: "pointer" }}>Approve</span>
                        <span onClick={() => startTransition(() => actOnStaffLeave(r.id, false))} style={{ fontSize: 11, fontWeight: 700, color: "var(--critical)", cursor: "pointer" }}>Reject</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {isAdmin && (
              <>
                <SectionTitle>Leave types (school-wide)</SectionTitle>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {allLeaveTypes.map((t) => (
                    <span key={t.id} className="pill" style={{ background: "var(--paper)", border: "1px solid var(--line)", fontSize: 11, display: "flex", alignItems: "center", gap: 5 }}>
                      {t.name}
                      <span onClick={() => startTransition(() => deleteLeaveType(t.id))} style={{ cursor: "pointer", color: "var(--critical)" }}>×</span>
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <input className="in" placeholder="e.g. Casual Leave" value={leaveTypeName} onChange={(e) => setLeaveTypeName(e.target.value)} style={{ flex: 1, fontSize: 12 }} />
                  <input className="in mono" type="number" placeholder="Quota/yr" value={leaveTypeQuota} onChange={(e) => setLeaveTypeQuota(e.target.value)} style={{ width: 80, fontSize: 12 }} />
                  <button onClick={addLeaveType} style={{ fontSize: 12, fontWeight: 700, background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 6, padding: "0 12px", cursor: "pointer" }}>
                    Add
                  </button>
                </div>
              </>
            )}

            {isAdmin && pendingLeaveRequests.length > 0 && (
              <>
                <SectionTitle>Pending approvals (all staff)</SectionTitle>
                {pendingLeaveRequests.map((r) => (
                  <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", fontSize: 12 }}>
                    <span>{r.staffName} — {r.leaveTypeName} ({new Date(r.dateFrom).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })})</span>
                    <span style={{ display: "flex", gap: 8 }}>
                      <span onClick={() => startTransition(() => actOnStaffLeave(r.id, true))} style={{ color: "var(--good)", fontWeight: 700, cursor: "pointer" }}>Approve</span>
                      <span onClick={() => startTransition(() => actOnStaffLeave(r.id, false))} style={{ color: "var(--critical)", fontWeight: 700, cursor: "pointer" }}>Reject</span>
                    </span>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {tab === "Payroll" && (
          <>
            <SectionTitle>Run payroll — {currentMonth}</SectionTitle>
            {isAdmin && (
              <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                <input className="in mono" type="number" placeholder="Amount" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} style={{ flex: 1 }} />
                <button onClick={pay} disabled={pending} style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "0 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Pay
                </button>
              </div>
            )}
            {latestPay && (
              <div style={{ background: "var(--good-tint)", borderRadius: 8, padding: "12px 14px", margin: "0 0 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--good)" }}>Latest — {latestPay.month}</span>
                <span className="mono" style={{ fontSize: 19, fontWeight: 700, color: "var(--good)" }}>
                  ₹{latestPay.amount.toLocaleString("en-IN")}
                </span>
              </div>
            )}
            {showStructuredPayroll && (
              <>
                <SectionTitle>Salary structure</SectionTitle>
                {salaryComponents.length === 0 ? (
                  <div style={{ color: "var(--muted)", fontSize: 12.5, marginBottom: 8 }}>No components added yet.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                    {salaryComponents.map((c) => (
                      <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                        <span>{c.name}</span>
                        <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <span className="mono">₹{c.amount.toLocaleString("en-IN")}</span>
                          {isAdmin && (
                            <span onClick={() => startTransition(() => removeSalaryComponent(c.id))} style={{ color: "var(--critical)", cursor: "pointer", fontWeight: 700 }}>
                              ×
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700, borderTop: "1px solid var(--line)", paddingTop: 6 }}>
                      <span>Gross</span>
                      <span className="mono">₹{salaryComponents.reduce((s, c) => s + c.amount, 0).toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                )}
                {isAdmin && (
                  <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                    <input className="in" placeholder="e.g. Basic" value={componentName} onChange={(e) => setComponentName(e.target.value)} style={{ flex: 1, fontSize: 12 }} />
                    <input className="in mono" type="number" placeholder="Component amount" value={componentAmount} onChange={(e) => setComponentAmount(e.target.value)} style={{ width: 100, fontSize: 12 }} />
                    <button onClick={addComponent} style={{ fontSize: 12, fontWeight: 700, background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 6, padding: "0 12px", cursor: "pointer" }}>
                      Add
                    </button>
                  </div>
                )}
                {isAdmin && salaryComponents.length > 0 && (
                  <button
                    onClick={runStructured}
                    disabled={pending}
                    style={{ background: "var(--teal)", color: "#fff", border: "none", borderRadius: 8, padding: 10, textAlign: "center", fontSize: 13, fontWeight: 700, cursor: "pointer", width: "100%", marginBottom: 14 }}
                  >
                    Run structured payroll — {currentMonth}
                  </button>
                )}
                {structuredResult && (
                  <div style={{ background: "var(--paper)", borderRadius: 8, padding: 12, marginBottom: 18, fontSize: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span>Gross</span><span className="mono">₹{structuredResult.gross.toLocaleString("en-IN")}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "var(--critical)" }}><span>PF</span><span className="mono">−₹{structuredResult.pf.toLocaleString("en-IN")}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "var(--critical)" }}><span>ESI</span><span className="mono">−₹{structuredResult.esi.toLocaleString("en-IN")}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "var(--critical)" }}><span>TDS</span><span className="mono">−₹{structuredResult.tds.toLocaleString("en-IN")}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "var(--critical)" }}><span>Professional Tax</span><span className="mono">−₹{structuredResult.pt.toLocaleString("en-IN")}</span></div>
                    {structuredResult.lop > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", color: "var(--critical)" }}><span>Loss of Pay</span><span className="mono">−₹{Math.round(structuredResult.lop).toLocaleString("en-IN")}</span></div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, borderTop: "1px solid var(--line)", marginTop: 4, paddingTop: 4 }}><span>Net pay</span><span className="mono">₹{Math.round(structuredResult.net).toLocaleString("en-IN")}</span></div>
                  </div>
                )}
              </>
            )}
            <SectionTitle>Payslips</SectionTitle>
            {payrollRuns.length === 0 ? (
              <div style={{ color: "var(--muted)", fontSize: 13 }}>No payroll runs yet.</div>
            ) : (
              payrollRuns.map((p) => (
                <div key={p.month} style={{ padding: "9px 0", borderBottom: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{p.month}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="mono" style={{ fontSize: 12.5, color: "var(--muted)" }}>
                        ₹{p.amount.toLocaleString("en-IN")}
                      </span>
                      <span className="pill" style={{ background: p.status === "PAID" ? "var(--good-tint)" : "var(--warn-tint)", color: p.status === "PAID" ? "var(--good)" : "var(--warn)" }}>
                        {p.status === "PAID" ? "Paid" : "Pending"}
                      </span>
                    </div>
                  </div>
                  {p.grossAmount != null && (
                    <div style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 2 }}>
                      Gross ₹{p.grossAmount.toLocaleString("en-IN")} · PF ₹{(p.pfAmount ?? 0).toLocaleString("en-IN")} · ESI ₹{(p.esiAmount ?? 0).toLocaleString("en-IN")} · TDS ₹{(p.tdsAmount ?? 0).toLocaleString("en-IN")} · PT ₹{(p.ptAmount ?? 0).toLocaleString("en-IN")}
                      {p.lopAmount != null && p.lopAmount > 0 && ` · LOP ₹${Math.round(p.lopAmount).toLocaleString("en-IN")}`}
                    </div>
                  )}
                </div>
              ))
            )}
          </>
        )}

        {tab === "Access & Permissions" && (
          <>
            <div style={{ background: "var(--teal-tint)", borderRadius: 8, padding: "10px 12px", fontSize: 11.5, color: "var(--teal)", marginBottom: 14, lineHeight: 1.4 }}>
              Access is granted per module, not by a fixed role. {isAdmin ? "Click a permission to cycle its level. Class-scoped modules can also be restricted to specific classes." : "Only a School Admin can change these."}
            </div>
            {MODULES.map((m) => {
              const schoolWide = perms.find((p) => p.moduleName === m && p.classId === null);
              const level = schoolWide?.accessLevel ?? "NONE";
              const style = LEVEL_STYLE[level];
              const classOverrides = perms.filter((p) => p.moduleName === m && p.classId !== null);
              const availableClasses = classes.filter((c) => !classOverrides.some((o) => o.classId === c.id));
              const isClassScoped = CLASS_SCOPED_MODULES.has(m);

              return (
                <div key={m} style={{ padding: "10.5px 0", borderBottom: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{m}</div>
                    <span className="pill" onClick={() => togglePerm(m, null)} style={{ background: style.bg, color: style.fg, cursor: isAdmin ? "pointer" : "default" }}>
                      {style.label}
                    </span>
                  </div>

                  {isClassScoped && classOverrides.length > 0 && (
                    <div style={{ marginTop: 8, marginLeft: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                      {classOverrides.map((o) => {
                        const cls = classes.find((c) => c.id === o.classId);
                        const oStyle = LEVEL_STYLE[o.accessLevel];
                        return (
                          <div key={o.classId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ fontSize: 12, color: "var(--muted)" }}>{cls ? `${cls.grade}-${cls.section}` : "Unknown class"}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span className="pill" onClick={() => togglePerm(m, o.classId)} style={{ background: oStyle.bg, color: oStyle.fg, fontSize: 11, cursor: isAdmin ? "pointer" : "default" }}>
                                {oStyle.label}
                              </span>
                              {isAdmin && (
                                <span onClick={() => removeOverride(m, o.classId!)} style={{ cursor: "pointer", color: "var(--faint)", fontSize: 14, lineHeight: 1 }} title="Remove override">
                                  ×
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {isAdmin && isClassScoped && availableClasses.length > 0 && (
                    <div style={{ marginTop: 8, marginLeft: 12 }}>
                      {addingOverrideFor === m ? (
                        <select
                          className="in"
                          autoFocus
                          defaultValue=""
                          onChange={(e) => e.target.value && addOverride(m, e.target.value)}
                          onBlur={() => setAddingOverrideFor(null)}
                          style={{ fontSize: 11.5, padding: "3px 6px", width: 160 }}
                        >
                          <option value="" disabled>
                            Choose a class…
                          </option>
                          {availableClasses.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.grade}-{c.section}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span onClick={() => setAddingOverrideFor(m)} style={{ fontSize: 11, color: "var(--marigold-deep)", fontWeight: 600, cursor: "pointer" }}>
                          + Restrict to a class
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {tab === "Documents" && (
          <PersonDocumentsPanel
            documents={documents}
            redirectPath={`/app/employees/${staff.id}`}
            onUpload={(category, formData) => addStaffDocument(staff.id, category, formData)}
            assetUrlBase="/api/person-documents"
          />
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "18px 0 10px" }}>{children}</div>;
}
function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 18px" }}>{children}</div>;
}
function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{label}</div>
      <div className={mono ? "mono" : undefined} style={{ fontSize: 13, fontWeight: 600 }}>
        {value}
      </div>
    </div>
  );
}
function StatTile({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, padding: "11px 13px" }}>
      <div style={{ fontSize: 10.5, color: "var(--muted)", marginBottom: 5 }}>{label}</div>
      <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: color ?? "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}
