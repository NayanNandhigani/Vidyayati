import { describe, it, expect, vi } from "vitest";

// Every test here passes its own fake `db` explicitly, so getScopedDb() is
// never actually called — but enrollment.ts imports it at module load time,
// and the real lib/tenant-db.ts transitively pulls in @/auth (NextAuth),
// which doesn't resolve cleanly under Vitest's Node environment. Mock the
// module boundary so this file only exercises enrollment.ts's own logic.
vi.mock("@/lib/tenant-db", () => ({
  getScopedDb: vi.fn(async () => {
    throw new Error("getScopedDb() should not be called — tests pass an explicit db");
  }),
  scopedCreateData: (data: unknown) => data,
}));

import { enrollStudent, promoteStudent } from "@/lib/domain/enrollment";

function makeFakeEnrollmentDb(overrides: {
  classYearId?: Record<string, string>;
  existingEnrollment?: any;
  currentActiveEnrollment?: any;
} = {}) {
  const classYearId = overrides.classYearId ?? {};
  const create = vi.fn(async (args: any) => ({ id: "new-enrollment", ...args.data }));
  const update = vi.fn(async (args: any) => ({ id: "updated-enrollment", ...args.data }));
  const findUnique = vi.fn(async () => overrides.existingEnrollment ?? null);
  const findFirst = vi.fn(async () => overrides.currentActiveEnrollment ?? null);

  const db = {
    class: {
      findUniqueOrThrow: vi.fn(async (args: any) => ({ yearId: classYearId[args.where.id] ?? "year-default" })),
    },
    enrollment: { create, update, findUnique, findFirst },
  };

  return { db, create, update, findUnique, findFirst };
}

describe("enrollStudent()", () => {
  it("creates a new ACTIVE enrollment row when none exists yet for the class's academic year", async () => {
    const { db, create, findUnique } = makeFakeEnrollmentDb({ classYearId: { "class-1": "year-2026" } });

    await enrollStudent("student-1", "class-1", "12", db as any);

    expect(findUnique).toHaveBeenCalledWith({
      where: { studentId_academicYearId: { studentId: "student-1", academicYearId: "year-2026" } },
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        studentId: "student-1",
        academicYearId: "year-2026",
        classId: "class-1",
        rollNumber: "12",
        status: "ACTIVE",
      },
    });
  });

  it("updates the existing enrollment in place (same-year reshuffle) instead of creating a duplicate", async () => {
    const { db, create, update } = makeFakeEnrollmentDb({
      classYearId: { "class-2": "year-2026" },
      existingEnrollment: { id: "enr-1", classId: "class-1", rollNumber: "5", status: "TRANSFERRED" },
    });

    await enrollStudent("student-1", "class-2", "9", db as any);

    expect(create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: { id: "enr-1" },
      data: { classId: "class-2", rollNumber: "9", status: "ACTIVE" },
    });
  });

  it("preserves the existing roll number when none is explicitly provided", async () => {
    const { db, update } = makeFakeEnrollmentDb({
      classYearId: { "class-2": "year-2026" },
      existingEnrollment: { id: "enr-1", classId: "class-1", rollNumber: "27", status: "ACTIVE" },
    });

    await enrollStudent("student-1", "class-2", undefined, db as any);

    expect(update).toHaveBeenCalledWith({
      where: { id: "enr-1" },
      data: { classId: "class-2", rollNumber: "27", status: "ACTIVE" },
    });
  });

  it("always re-activates status to ACTIVE even if the existing row had been closed out", async () => {
    const { db, update } = makeFakeEnrollmentDb({
      classYearId: { "class-2": "year-2026" },
      existingEnrollment: { id: "enr-1", classId: "class-1", rollNumber: null, status: "WITHDRAWN" },
    });

    await enrollStudent("student-1", "class-2", null, db as any);
    expect(update).toHaveBeenCalledWith({
      where: { id: "enr-1" },
      data: { classId: "class-2", rollNumber: null, status: "ACTIVE" },
    });
  });
});

describe("promoteStudent()", () => {
  it("same academic year: does NOT close the current enrollment, just reshuffles class in place", async () => {
    const { db, update, create } = makeFakeEnrollmentDb({
      classYearId: { "class-old": "year-2026", "class-new": "year-2026" },
      currentActiveEnrollment: { id: "enr-1", academicYearId: "year-2026", classId: "class-old" },
      existingEnrollment: { id: "enr-1", classId: "class-old", rollNumber: "1", status: "ACTIVE" },
    });

    await promoteStudent("student-1", "class-new", "PROMOTED", db as any);

    // Only the one enrollStudent()-driven update — no separate close-out update for
    // the old enrollment, since it never left the current year.
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({
      where: { id: "enr-1" },
      data: { classId: "class-new", rollNumber: "1", status: "ACTIVE" },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("different academic year: closes out the old enrollment with the given status, then opens a new one", async () => {
    const { db, update, create, findUnique } = makeFakeEnrollmentDb({
      classYearId: { "class-old": "year-2025", "class-new": "year-2026" },
      currentActiveEnrollment: { id: "enr-old", academicYearId: "year-2025", classId: "class-old" },
    });
    findUnique.mockResolvedValueOnce(null); // no existing row yet for year-2026

    await promoteStudent("student-1", "class-new", "PROMOTED", db as any);

    // First update call: close out the old year's row.
    expect(update).toHaveBeenNthCalledWith(1, {
      where: { id: "enr-old" },
      data: { status: "PROMOTED", endedOn: expect.any(Date) },
    });
    // Then a fresh enrollment is created for the new year.
    expect(create).toHaveBeenCalledWith({
      data: {
        studentId: "student-1",
        academicYearId: "year-2026",
        classId: "class-new",
        rollNumber: null,
        status: "ACTIVE",
      },
    });
  });

  it("supports TRANSFERRED and WITHDRAWN as the close-out status for a cross-year move", async () => {
    const { db, update } = makeFakeEnrollmentDb({
      classYearId: { "class-old": "year-2025", "class-new": "year-2026" },
      currentActiveEnrollment: { id: "enr-old", academicYearId: "year-2025", classId: "class-old" },
    });

    await promoteStudent("student-1", "class-new", "WITHDRAWN", db as any);
    expect(update).toHaveBeenNthCalledWith(1, {
      where: { id: "enr-old" },
      data: { status: "WITHDRAWN", endedOn: expect.any(Date) },
    });
  });

  it("with no current active enrollment at all, just creates a fresh one (doesn't throw)", async () => {
    const { db, create, update } = makeFakeEnrollmentDb({ classYearId: { "class-new": "year-2026" } });

    await promoteStudent("student-1", "class-new", "PROMOTED", db as any);
    expect(update).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalled();
  });
});
