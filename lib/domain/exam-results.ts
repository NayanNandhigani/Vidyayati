import { Prisma } from "@prisma/client";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { gradeFor, gradeForScale } from "@/lib/academic";

/**
 * Computes and persists a StudentResult row per student for an exam —
 * total/percentage/grade/rank, using the exact same logic already used
 * inline by app/app/exams/page.tsx's Report Card panel (same maxTotal/
 * total/rank/grade derivation), so the persisted numbers always agree
 * with what that screen shows. Raw Marks stay the source of truth;
 * StudentResult is a computed snapshot, safe to recompute and overwrite
 * any time (e.g. if marks are corrected after an exam was approved).
 */
export async function calculateExamResults(examId: string) {
  const sdb = await getScopedDb();

  const exam = await sdb.exam.findUniqueOrThrow({ where: { id: examId }, select: { classId: true, yearId: true } });
  const examSubjects = await sdb.examSubject.findMany({ where: { examId }, select: { id: true, maxMarks: true } });
  const students = await sdb.student.findMany({ where: { classId: exam.classId, status: "ACTIVE" }, select: { id: true } });

  if (examSubjects.length === 0 || students.length === 0) return { computed: 0 };

  const marks = await sdb.mark.findMany({
    where: { examSubjectId: { in: examSubjects.map((es) => es.id) }, studentId: { in: students.map((s) => s.id) } },
    select: { studentId: true, examSubjectId: true, marksObtained: true },
  });

  const marksByStudent = new Map<string, Map<string, number>>();
  for (const m of marks) {
    if (!marksByStudent.has(m.studentId)) marksByStudent.set(m.studentId, new Map());
    marksByStudent.get(m.studentId)!.set(m.examSubjectId, Number(m.marksObtained));
  }

  const maxTotal = examSubjects.reduce((sum, es) => sum + es.maxMarks, 0);
  const totals = students.map((s) => {
    const row = marksByStudent.get(s.id);
    const total = examSubjects.reduce((sum, es) => sum + (row?.get(es.id) ?? 0), 0);
    return { studentId: s.id, total };
  });

  const year = await sdb.academicYear.findUniqueOrThrow({ where: { id: exam.yearId }, include: { gradeScale: { include: { bands: true } } } });
  const gradeBands = year.gradeScale?.bands.map((b) => ({ label: b.label, minPercent: Number(b.minPercent), maxPercent: Number(b.maxPercent) })) ?? [];

  const ranked = [...totals].sort((a, b) => b.total - a.total);

  for (const { studentId, total } of totals) {
    const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
    const rank = ranked.findIndex((r) => r.studentId === studentId) + 1;
    const grade = gradeForScale(pct, gradeBands) ?? gradeFor(pct);

    await sdb.studentResult.upsert({
      where: { examId_studentId: { examId, studentId } },
      update: { totalMarks: total, maxMarks: maxTotal, percentage: pct, grade, rank, computedAt: new Date() },
      create: scopedCreateData<Prisma.StudentResultUncheckedCreateInput>({
        examId,
        studentId,
        totalMarks: total,
        maxMarks: maxTotal,
        percentage: pct,
        grade,
        rank,
      }),
    });
  }

  return { computed: totals.length };
}
