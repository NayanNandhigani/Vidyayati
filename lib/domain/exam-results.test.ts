import { describe, it, expect, vi } from "vitest";

const { getScopedDbMock } = vi.hoisted(() => ({ getScopedDbMock: vi.fn() }));
vi.mock("@/lib/tenant-db", () => ({
  getScopedDb: getScopedDbMock,
  scopedCreateData: (data: unknown) => data,
}));

import { calculateExamResults } from "@/lib/domain/exam-results";

type FakeSdb = {
  exam: { findUniqueOrThrow: ReturnType<typeof vi.fn> };
  examSubject: { findMany: ReturnType<typeof vi.fn> };
  student: { findMany: ReturnType<typeof vi.fn> };
  mark: { findMany: ReturnType<typeof vi.fn> };
  academicYear: { findUniqueOrThrow: ReturnType<typeof vi.fn> };
  studentResult: { upsert: ReturnType<typeof vi.fn> };
};

function makeFakeSdb(opts: {
  examSubjects: { id: string; maxMarks: number }[];
  students: { id: string }[];
  marks: { studentId: string; examSubjectId: string; marksObtained: number }[];
  gradeBands?: { label: string; minPercent: number; maxPercent: number }[];
}): FakeSdb {
  return {
    exam: { findUniqueOrThrow: vi.fn(async () => ({ classId: "class-1", yearId: "year-1" })) },
    examSubject: { findMany: vi.fn(async () => opts.examSubjects) },
    student: { findMany: vi.fn(async () => opts.students) },
    mark: { findMany: vi.fn(async () => opts.marks) },
    academicYear: {
      findUniqueOrThrow: vi.fn(async () => ({
        gradeScale: opts.gradeBands ? { bands: opts.gradeBands } : null,
      })),
    },
    studentResult: { upsert: vi.fn(async (args: any) => ({ id: "result-1", ...args.create, ...args.update })) },
  };
}

describe("calculateExamResults()", () => {
  it("computes total/percentage/rank per student, best score ranked first", async () => {
    const sdb = makeFakeSdb({
      examSubjects: [
        { id: "es-1", maxMarks: 50 },
        { id: "es-2", maxMarks: 50 },
      ],
      students: [{ id: "stu-A" }, { id: "stu-B" }],
      marks: [
        { studentId: "stu-A", examSubjectId: "es-1", marksObtained: 40 },
        { studentId: "stu-A", examSubjectId: "es-2", marksObtained: 45 },
        { studentId: "stu-B", examSubjectId: "es-1", marksObtained: 20 },
        { studentId: "stu-B", examSubjectId: "es-2", marksObtained: 20 },
      ],
    });
    getScopedDbMock.mockResolvedValue(sdb);

    const result = await calculateExamResults("exam-1");
    expect(result).toEqual({ computed: 2 });

    const upsertCalls = sdb.studentResult.upsert.mock.calls;
    const forA = upsertCalls.find((c: any) => c[0].where.examId_studentId.studentId === "stu-A")![0];
    const forB = upsertCalls.find((c: any) => c[0].where.examId_studentId.studentId === "stu-B")![0];

    expect(forA.create).toMatchObject({ totalMarks: 85, maxMarks: 100, percentage: 85, rank: 1 });
    expect(forB.create).toMatchObject({ totalMarks: 40, maxMarks: 100, percentage: 40, rank: 2 });
  });

  it("treats a missing Mark row as 0 for that subject rather than skipping the student", async () => {
    const sdb = makeFakeSdb({
      examSubjects: [{ id: "es-1", maxMarks: 100 }],
      students: [{ id: "stu-A" }],
      marks: [], // stu-A never got a mark recorded for es-1
    });
    getScopedDbMock.mockResolvedValue(sdb);

    await calculateExamResults("exam-1");
    const [args] = sdb.studentResult.upsert.mock.calls[0];
    expect(args.create.totalMarks).toBe(0);
    expect(args.create.percentage).toBe(0);
  });

  it("returns { computed: 0 } and writes nothing when the exam has no subjects yet", async () => {
    const sdb = makeFakeSdb({ examSubjects: [], students: [{ id: "stu-A" }], marks: [] });
    getScopedDbMock.mockResolvedValue(sdb);

    const result = await calculateExamResults("exam-1");
    expect(result).toEqual({ computed: 0 });
    expect(sdb.studentResult.upsert).not.toHaveBeenCalled();
  });

  it("returns { computed: 0 } and writes nothing when there are no active students in the class", async () => {
    const sdb = makeFakeSdb({ examSubjects: [{ id: "es-1", maxMarks: 100 }], students: [], marks: [] });
    getScopedDbMock.mockResolvedValue(sdb);

    const result = await calculateExamResults("exam-1");
    expect(result).toEqual({ computed: 0 });
    expect(sdb.studentResult.upsert).not.toHaveBeenCalled();
  });

  it("uses the school's configured GradeScale bands over the gradeFor() fallback when a band matches", async () => {
    const sdb = makeFakeSdb({
      examSubjects: [{ id: "es-1", maxMarks: 100 }],
      students: [{ id: "stu-A" }],
      marks: [{ studentId: "stu-A", examSubjectId: "es-1", marksObtained: 95 }],
      // A custom scale where 95% is "Distinction", unlike the gradeFor() default of "A+".
      gradeBands: [{ label: "Distinction", minPercent: 90, maxPercent: 100 }],
    });
    getScopedDbMock.mockResolvedValue(sdb);

    await calculateExamResults("exam-1");
    const [args] = sdb.studentResult.upsert.mock.calls[0];
    expect(args.create.grade).toBe("Distinction");
  });

  it("falls back to gradeFor() when the school has no GradeScale configured", async () => {
    const sdb = makeFakeSdb({
      examSubjects: [{ id: "es-1", maxMarks: 100 }],
      students: [{ id: "stu-A" }],
      marks: [{ studentId: "stu-A", examSubjectId: "es-1", marksObtained: 95 }],
    });
    getScopedDbMock.mockResolvedValue(sdb);

    await calculateExamResults("exam-1");
    const [args] = sdb.studentResult.upsert.mock.calls[0];
    expect(args.create.grade).toBe("A+"); // gradeFor()'s own >=90 band
  });

  it("doesn't divide by zero when every ExamSubject has maxMarks 0", async () => {
    const sdb = makeFakeSdb({
      examSubjects: [{ id: "es-1", maxMarks: 0 }],
      students: [{ id: "stu-A" }],
      marks: [],
    });
    getScopedDbMock.mockResolvedValue(sdb);

    await calculateExamResults("exam-1");
    const [args] = sdb.studentResult.upsert.mock.calls[0];
    expect(args.create.percentage).toBe(0);
    expect(Number.isFinite(args.create.percentage)).toBe(true);
  });

  it("gives tied totals consecutive ranks rather than a shared rank (documents actual, not necessarily desired, behavior)", async () => {
    const sdb = makeFakeSdb({
      examSubjects: [{ id: "es-1", maxMarks: 100 }],
      students: [{ id: "stu-A" }, { id: "stu-B" }, { id: "stu-C" }],
      marks: [
        { studentId: "stu-A", examSubjectId: "es-1", marksObtained: 80 },
        { studentId: "stu-B", examSubjectId: "es-1", marksObtained: 80 },
        { studentId: "stu-C", examSubjectId: "es-1", marksObtained: 50 },
      ],
    });
    getScopedDbMock.mockResolvedValue(sdb);

    await calculateExamResults("exam-1");
    const ranks = new Map(
      sdb.studentResult.upsert.mock.calls.map((c: any) => [c[0].where.examId_studentId.studentId, c[0].create.rank])
    );
    // stu-A and stu-B are tied on marks but get ranks 1 and 2, not both rank 1.
    expect(new Set([ranks.get("stu-A"), ranks.get("stu-B")])).toEqual(new Set([1, 2]));
    expect(ranks.get("stu-C")).toBe(3);
  });
});
