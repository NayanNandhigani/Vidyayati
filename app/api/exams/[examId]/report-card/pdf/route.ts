import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getScopedDb } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { studentName } from "@/lib/format";
import { gradeFor, gradeForScale } from "@/lib/academic";
import { ReportCardDocument, type ReportCardStudent } from "@/lib/report-card-pdf";

/**
 * GET /api/exams/[examId]/report-card/pdf            — every student in the exam's class
 * GET /api/exams/[examId]/report-card/pdf?studentId=X — just that one student
 *
 * Rank is always computed across the whole class (not just whichever
 * student(s) end up in the PDF), so a single-student download still shows
 * their real rank among classmates. Streamed `inline` (not `attachment`)
 * so the browser's own PDF viewer gives both "print" and "download" from
 * one link, matching the "print or download" ask.
 */
export async function GET(req: Request, { params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const studentId = new URL(req.url).searchParams.get("studentId");

  const sdb = await getScopedDb();
  const exam = await sdb.exam.findFirst({ where: { id: examId }, include: { class: true, school: true } });
  if (!exam) return NextResponse.json({ error: "Not found." }, { status: 404 });

  try {
    await requireModuleAccess("Exams", "VIEW", exam.classId);
  } catch {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const examSubjects = await sdb.examSubject.findMany({ where: { examId }, include: { subject: true }, orderBy: { subject: { name: "asc" } } });
  const classStudents = await sdb.student.findMany({ where: { classId: exam.classId, status: "ACTIVE" }, orderBy: [{ firstName: "asc" }, { surname: "asc" }] });
  if (classStudents.length === 0) return NextResponse.json({ error: "No active students in this class." }, { status: 404 });

  const marks = await sdb.mark.findMany({ where: { examSubjectId: { in: examSubjects.map((es) => es.id) }, studentId: { in: classStudents.map((s) => s.id) } } });
  const marksByStudent = new Map<string, Map<string, number>>();
  for (const m of marks) {
    const map = marksByStudent.get(m.studentId) ?? new Map();
    map.set(m.examSubjectId, Number(m.marksObtained));
    marksByStudent.set(m.studentId, map);
  }

  const currentYear = await sdb.academicYear.findFirst({ where: { isCurrent: true }, include: { gradeScale: { include: { bands: true } } } });
  const gradeBands = currentYear?.gradeScale?.bands.map((b) => ({ label: b.label, minPercent: Number(b.minPercent), maxPercent: Number(b.maxPercent) })) ?? [];
  const gradeForPct = (pct: number) => gradeForScale(pct, gradeBands) ?? gradeFor(pct);

  const maxTotal = examSubjects.reduce((s, es) => s + es.maxMarks, 0);
  const className = `${exam.class.grade}-${exam.class.section}`;

  const totals = classStudents.map((st) => {
    const map = marksByStudent.get(st.id) ?? new Map();
    return { student: st, total: examSubjects.reduce((s, es) => s + (map.get(es.id) ?? 0), 0) };
  });
  const ranked = [...totals].sort((a, b) => b.total - a.total);

  let rows: ReportCardStudent[] = totals.map(({ student: st, total }) => {
    const map = marksByStudent.get(st.id) ?? new Map();
    const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
    return {
      name: studentName(st),
      admissionNo: st.admissionNo,
      className,
      subjects: examSubjects.map((es) => ({ name: es.subject.name, obtained: map.get(es.id) ?? 0, max: es.maxMarks })),
      total,
      maxTotal,
      pct,
      grade: gradeForPct(pct),
      rank: ranked.findIndex((r) => r.student.id === st.id) + 1,
      outOf: ranked.length,
    };
  });

  if (studentId) {
    rows = rows.filter((_, i) => totals[i].student.id === studentId);
    if (rows.length === 0) return NextResponse.json({ error: "Student not found in this class." }, { status: 404 });
  }

  const examDates = `${exam.startDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} – ${exam.endDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;
  const schoolAddress = [exam.school.addressLine, exam.school.city, exam.school.state].filter(Boolean).join(", ");

  const buffer = await renderToBuffer(ReportCardDocument({ schoolName: exam.school.name, schoolAddress, examName: exam.name, examDates, students: rows }));

  const fileName = studentId
    ? `Report-Card-${rows[0].name.replace(/[^a-zA-Z0-9]+/g, "-")}.pdf`
    : `Report-Cards-${exam.name.replace(/[^a-zA-Z0-9]+/g, "-")}-${className}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${fileName}"`, "Cache-Control": "private, no-store" },
  });
}
