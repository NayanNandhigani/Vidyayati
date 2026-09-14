import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { getScopedDb } from "@/lib/tenant-db";
import { requireModuleAccess, getPermittedClassIds } from "@/lib/permissions";
import { studentName } from "@/lib/format";
import { feeStatusFor, FEE_STATUS_STYLE, gradeFor, gradeForScale } from "@/lib/academic";
import { getSchoolFeatures } from "@/lib/feature-flags";
import { getSiblings } from "../depth-actions";
import ProfileTabs from "./ProfileTabs";
import Avatar from "@/components/Avatar";
import ProfilePhotoUpload from "@/components/ProfilePhotoUpload";
import { setStudentPhoto } from "../../settings/id-card-actions";

export default async function StudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await requireModuleAccess("Students", "VIEW");
  const { id } = await params;
  const sdb = await getScopedDb();
  const permittedClassIds = await getPermittedClassIds("Students");

  // findFirst (not findUnique) so a staffer restricted to specific classes
  // can't view a student outside them just by putting the id in the URL.
  const classWhere = permittedClassIds === "ALL" ? {} : { classId: { in: [...permittedClassIds] } };

  const student = await sdb.student.findFirst({
    where: { id, ...classWhere },
    include: {
      class: true,
      parentLinks: { include: { parent: true } },
      transportAssignment: { include: { route: { include: { vehicle: true } }, stop: true } },
      attendance: { orderBy: { date: "desc" }, take: 15 },
      feePayments: { include: { feeStructure: true }, orderBy: { paidOn: "desc" } },
      marks: {
        include: { examSubject: { include: { exam: true, subject: true } } },
        orderBy: { examSubject: { exam: { startDate: "desc" } } },
      },
      emergencyContacts: { orderBy: { priority: "asc" } },
      documents: { where: { subjectType: "STUDENT" }, orderBy: { uploadedAt: "desc" } },
      admissionEnquiry: true,
    },
  });
  if (!student) notFound();

  const session = await auth();
  const schoolFeatures = await getSchoolFeatures(session!.user.schoolId!);
  const siblings = schoolFeatures["students.siblings"] ? await getSiblings(student.id) : [];

  const currentYear = await sdb.academicYear.findFirst({ where: { isCurrent: true }, include: { gradeScale: { include: { bands: true } } } });
  const gradeBands = currentYear?.gradeScale?.bands.map((b) => ({ label: b.label, minPercent: Number(b.minPercent), maxPercent: Number(b.maxPercent) })) ?? [];
  const gradeForPct = (pct: number) => gradeForScale(pct, gradeBands) ?? gradeFor(pct);

  const feeStructures = currentYear ? await sdb.feeStructure.findMany({ where: { yearId: currentYear.id, classId: student.classId } }) : [];
  const classFeeDefault = currentYear
    ? await sdb.classFeeDefault.findUnique({ where: { yearId_grade: { yearId: currentYear.id, grade: student.class.grade } } })
    : null;
  const classActualFee = classFeeDefault ? Number(classFeeDefault.actualFee) : null;

  // Attendance stat totals (all recorded days, not just the last 15 shown)
  const allAttendance = await sdb.attendance.groupBy({ by: ["status"], where: { studentId: student.id }, _count: true });
  const attendanceTotals = { PRESENT: 0, ABSENT: 0, HALF_DAY: 0 };
  for (const row of allAttendance) attendanceTotals[row.status] = row._count;
  const attendanceTotal = attendanceTotals.PRESENT + attendanceTotals.ABSENT + attendanceTotals.HALF_DAY;
  const attendancePct = attendanceTotal ? Math.round((attendanceTotals.PRESENT / attendanceTotal) * 100) : null;

  // Exam marks grouped by exam
  const examGroups = new Map<string, { examName: string; date: Date; obtained: number; max: number }>();
  for (const mark of student.marks) {
    const exam = mark.examSubject.exam;
    const entry = examGroups.get(exam.id) ?? { examName: exam.name, date: exam.startDate, obtained: 0, max: 0 };
    entry.obtained += Number(mark.marksObtained);
    entry.max += mark.examSubject.maxMarks;
    examGroups.set(exam.id, entry);
  }
  const examResults = [...examGroups.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
  const latestExamPct = examResults[0] ? Math.round((examResults[0].obtained / examResults[0].max) * 100) : null;
  const latestExamGrade = latestExamPct !== null ? gradeForPct(latestExamPct) : null;

  const totalFeeDue = feeStructures.reduce((s, f) => s + Number(f.amount), 0);
  const totalFeePaid = student.feePayments.reduce((s, p) => s + Number(p.amount), 0);
  const feeStatus = feeStatusFor(totalFeeDue, totalFeePaid, feeStructures.some((f) => f.dueDate < new Date()) && totalFeePaid < totalFeeDue);
  const feeStyle = FEE_STATUS_STYLE[feeStatus];

  return (
    <div style={{ padding: "26px 34px", display: "flex", flexDirection: "column", gap: 16, height: "100dvh", boxSizing: "border-box", overflowY: "auto" }}>
      <div>
        <Link href="/app/students" style={{ fontSize: 12.5, color: "var(--muted)", textDecoration: "none" }}>
          ← Back to Students
        </Link>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ position: "relative" }}>
          <Avatar photoPath={student.photoPath} seed={student.id} name={studentName(student)} size={56} fontSize={18} />
          {session!.user.role === "SCHOOL_ADMIN" && <ProfilePhotoUpload onUpload={setStudentPhoto.bind(null, student.id)} />}
        </div>
        <div>
          <div className="disp" style={{ fontSize: 20 }}>
            {studentName(student)}
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
            Class {student.class.grade}-{student.class.section} · Adm. No. {student.admissionNo}
          </div>
        </div>
      </div>

      {/* Quick info band — basic details, attendance, academic performance at a glance */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
          <QuickStat label="Attendance" value={attendancePct === null ? "—" : `${attendancePct}%`} color="var(--teal)" />
          <QuickStat label="Latest exam" value={latestExamGrade ?? "—"} sub={latestExamPct !== null ? `${latestExamPct}%` : undefined} />
          <QuickStat label="Fee status" value={feeStyle.label} color={feeStyle.fg} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, fontSize: 12.5 }}>
          <BasicRow label="Date of birth" value={student.dob ? student.dob.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"} />
          <BasicRow label="Gender" value={student.gender ? student.gender[0] + student.gender.slice(1).toLowerCase() : "—"} />
          <BasicRow label="Parent / guardian" value={student.parentLinks[0]?.parent.name ?? "—"} />
          <BasicRow label="Contact" value={student.parentLinks[0]?.parent.phone ?? "—"} mono />
        </div>
      </div>

      <ProfileTabs
        student={student}
        attendancePct={attendancePct}
        attendanceTotals={attendanceTotals}
        examResults={examResults}
        latestExamGrade={latestExamGrade}
        latestExamPct={latestExamPct}
        feeStructures={feeStructures}
        features={{
          medicalInfo: schoolFeatures["students.medicalInfo"],
          priorSchool: schoolFeatures["students.priorSchool"],
          siblings: schoolFeatures["students.siblings"],
          documents: schoolFeatures["students.documents"],
        }}
        medical={{ address: student.address, bloodGroup: student.bloodGroup, medicalNotes: student.medicalNotes }}
        emergencyContacts={student.emergencyContacts}
        priorSchool={{
          previousSchoolName: student.previousSchoolName,
          previousTcNo: student.previousTcNo,
          previousTcDate: student.previousTcDate?.toISOString() ?? null,
          priorPerformanceNote: student.priorPerformanceNote,
        }}
        siblings={siblings}
        documents={student.documents.map((d) => ({
          id: d.id,
          category: d.category,
          label: d.label,
          filePath: d.filePath,
          expiryDate: d.expiryDate?.toISOString() ?? null,
          uploadedAt: d.uploadedAt.toISOString(),
        }))}
        admission={
          student.admissionEnquiry
            ? {
                dob: student.admissionEnquiry.dob?.toISOString() ?? null,
                gender: student.admissionEnquiry.gender,
                bloodGroup: student.admissionEnquiry.bloodGroup,
                nationality: student.admissionEnquiry.nationality,
                caste: student.admissionEnquiry.caste,
                religionCategory: student.admissionEnquiry.religionCategory,
                motherTongue: student.admissionEnquiry.motherTongue,
                studentAadhaarNumber: student.admissionEnquiry.studentAadhaarNumber,
                fatherName: student.admissionEnquiry.fatherName,
                motherName: student.admissionEnquiry.motherName,
                guardianName: student.admissionEnquiry.guardianName,
                fatherOccupation: student.admissionEnquiry.fatherOccupation,
                motherOccupation: student.admissionEnquiry.motherOccupation,
                annualIncome: student.admissionEnquiry.annualIncome,
                parentContact: student.admissionEnquiry.parentContact,
                contactNumber2: student.admissionEnquiry.contactNumber2,
                email: student.admissionEnquiry.email,
                parentAadhaarNumber: student.admissionEnquiry.parentAadhaarNumber,
                permanentAddress: student.admissionEnquiry.permanentAddress,
                currentAddress: student.admissionEnquiry.currentAddress,
                pincode: student.admissionEnquiry.pincode,
                allergiesConditions: student.admissionEnquiry.allergiesConditions,
                emergencyContactName: student.admissionEnquiry.emergencyContactName,
                emergencyContactNumber: student.admissionEnquiry.emergencyContactNumber,
                familyDoctorContact: student.admissionEnquiry.familyDoctorContact,
                udiseNumber: student.admissionEnquiry.udiseNumber,
                penNumber: student.admissionEnquiry.penNumber,
              }
            : null
        }
        actualFee={classActualFee}
        chargedFee={student.chargedFee != null ? Number(student.chargedFee) : null}
        isAdmin={session!.user.role === "SCHOOL_ADMIN"}
      />
    </div>
  );
}

function QuickStat({ label, value, sub, color }: { label: string; value: React.ReactNode; sub?: string; color?: string }) {
  return (
    <div style={{ background: "var(--paper)", borderRadius: 8, padding: "12px 14px" }}>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{label}</div>
      <div className="mono" style={{ fontSize: 19, fontWeight: 700, color: color ?? "var(--ink)" }}>
        {value} {sub && <span style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)" }}>({sub})</span>}
      </div>
    </div>
  );
}

function BasicRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ color: "var(--muted)", marginBottom: 3 }}>{label}</div>
      <div className={mono ? "mono" : undefined} style={{ fontWeight: 600 }}>
        {value}
      </div>
    </div>
  );
}
