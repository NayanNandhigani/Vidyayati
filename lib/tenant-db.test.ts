import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeBaseClient, type RecordedCall } from "@/lib/test-utils/fake-prisma";

vi.mock("@/lib/db", async () => {
  const { createFakeBaseClient } = await import("@/lib/test-utils/fake-prisma");
  const { client } = createFakeBaseClient();
  return { db: client };
});

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { scopedDb, getScopedDb, AUDITED_MODELS, scopedCreateData } from "@/lib/tenant-db";

const fakeDb = db as unknown as ReturnType<typeof createFakeBaseClient>["client"];
const mockedAuth = vi.mocked(auth);

function callsFor(calls: RecordedCall[], model: string, operation: string) {
  return calls.filter((c) => c.model === model && c.operation === operation);
}

beforeEach(() => {
  fakeDb.reset();
  mockedAuth.mockReset();
});

describe("scopedDb() — schoolId injection", () => {
  const SCHOOL_ID = "school-abc";

  it("stamps schoolId onto a create's data for a tenant-scoped model", async () => {
    const sdb = scopedDb(SCHOOL_ID);
    await sdb.class.create({ data: { grade: "5", section: "A", yearId: "year-1" } as any });

    const [call] = callsFor(fakeDb.calls, "Class", "create");
    expect(call.args.data.schoolId).toBe(SCHOOL_ID);
    expect(call.args.data.grade).toBe("5");
  });

  it("merges schoolId into where for reads, preserving the caller's own filters", async () => {
    const sdb = scopedDb(SCHOOL_ID);
    await sdb.class.findMany({ where: { grade: "5" } });

    const [call] = callsFor(fakeDb.calls, "Class", "findMany");
    expect(call.args.where).toEqual({ grade: "5", schoolId: SCHOOL_ID });
  });

  it("merges schoolId into where when the caller passed no where at all", async () => {
    const sdb = scopedDb(SCHOOL_ID);
    await sdb.class.findMany({});

    const [call] = callsFor(fakeDb.calls, "Class", "findMany");
    expect(call.args.where).toEqual({ schoolId: SCHOOL_ID });
  });

  it("merges schoolId into where for update and delete", async () => {
    const sdb = scopedDb(SCHOOL_ID);
    await sdb.class.update({ where: { id: "class-1" }, data: { section: "B" } });
    await sdb.class.delete({ where: { id: "class-1" } });

    expect(callsFor(fakeDb.calls, "Class", "update")[0].args.where).toEqual({ id: "class-1", schoolId: SCHOOL_ID });
    expect(callsFor(fakeDb.calls, "Class", "delete")[0].args.where).toEqual({ id: "class-1", schoolId: SCHOOL_ID });
  });

  it("stamps schoolId into BOTH where and create for upsert", async () => {
    const sdb = scopedDb(SCHOOL_ID);
    await sdb.class.upsert({
      where: { id: "class-1" },
      create: { grade: "5", section: "A", yearId: "year-1" } as any,
      update: { section: "B" } as any,
    });

    const [call] = callsFor(fakeDb.calls, "Class", "upsert");
    expect(call.args.where).toEqual({ id: "class-1", schoolId: SCHOOL_ID });
    expect(call.args.create.schoolId).toBe(SCHOOL_ID);
  });

  it("stamps schoolId onto every row of a createMany", async () => {
    const sdb = scopedDb(SCHOOL_ID);
    await sdb.class.createMany({ data: [{ grade: "5", section: "A" }, { grade: "5", section: "B" }] as any });

    const [call] = callsFor(fakeDb.calls, "Class", "createMany");
    expect(call.args.data).toEqual([
      { grade: "5", section: "A", schoolId: SCHOOL_ID },
      { grade: "5", section: "B", schoolId: SCHOOL_ID },
    ]);
  });

  it("does NOT touch a platform-level model that has no schoolId column", async () => {
    const sdb = scopedDb(SCHOOL_ID);
    await sdb.school.findMany({ where: { status: "TRIAL" } });
    await sdb.subscriptionPlan.create({ data: { name: "Basic", billingCycle: "MONTHLY", price: 100 } as any });

    expect(callsFor(fakeDb.calls, "School", "findMany")[0].args.where).toEqual({ status: "TRIAL" });
    const createCall = callsFor(fakeDb.calls, "SubscriptionPlan", "create")[0];
    expect(createCall.args.data.schoolId).toBeUndefined();
  });

  it("scopedCreateData is an identity function at runtime (compile-time-only typing helper)", () => {
    const payload = { name: "X" };
    expect(scopedCreateData(payload as any)).toBe(payload);
  });
});

describe("scopedDb() — mutation audit logging", () => {
  const SCHOOL_ID = "school-abc";
  const ACTOR_ID = "user-1";

  it("writes a CREATE audit row for an audited model, attributed to the actor", async () => {
    expect(AUDITED_MODELS.has("Student")).toBe(true);
    const sdb = scopedDb(SCHOOL_ID, ACTOR_ID);
    await sdb.student.create({ data: { firstName: "Asha", surname: "Rao" } as any });

    const [audit] = callsFor(fakeDb.calls, "MutationAuditLog", "create");
    expect(audit).toBeDefined();
    expect(audit.args.data).toMatchObject({
      schoolId: SCHOOL_ID,
      actorUserId: ACTOR_ID,
      action: "CREATE",
      entityType: "Student",
      entityId: "fake-created-id",
    });
  });

  it("does NOT write an audit row for a tenant-scoped model that isn't in AUDITED_MODELS", async () => {
    expect(AUDITED_MODELS.has("Class")).toBe(false);
    const sdb = scopedDb(SCHOOL_ID, ACTOR_ID);
    await sdb.class.create({ data: { name: "Grade 5" } as any });

    expect(callsFor(fakeDb.calls, "MutationAuditLog", "create")).toHaveLength(0);
  });

  it("diffs before/after and writes an UPDATE audit row with the changed fields only", async () => {
    fakeDb.setHandler("Student", (operation: string, args: any) => {
      if (operation === "findUnique") return { id: "stu-1", firstName: "Asha", chargedFee: 1000 };
      if (operation === "update") return { id: "stu-1", firstName: "Asha", chargedFee: args.data.chargedFee };
      return null;
    });

    const sdb = scopedDb(SCHOOL_ID, ACTOR_ID);
    await sdb.student.update({ where: { id: "stu-1" }, data: { chargedFee: 1500 } });

    const [audit] = callsFor(fakeDb.calls, "MutationAuditLog", "create");
    expect(audit.args.data.action).toBe("UPDATE");
    expect(audit.args.data.entityId).toBe("stu-1");
    expect(audit.args.data.changes).toEqual({ chargedFee: { before: "1000", after: "1500" } });
  });

  it("writes no UPDATE audit row when the update didn't actually change any tracked field", async () => {
    fakeDb.setHandler("Student", (operation: string, args: any) => {
      if (operation === "findUnique") return { id: "stu-1", firstName: "Asha" };
      if (operation === "update") return { id: "stu-1", firstName: "Asha" };
      return null;
    });

    const sdb = scopedDb(SCHOOL_ID, ACTOR_ID);
    await sdb.student.update({ where: { id: "stu-1" }, data: { firstName: "Asha" } });

    expect(callsFor(fakeDb.calls, "MutationAuditLog", "create")).toHaveLength(0);
  });

  it("writes a DELETE audit row carrying the deleted row's prior state", async () => {
    fakeDb.setHandler("Student", (operation: string) => {
      if (operation === "findUnique") return { id: "stu-1", firstName: "Asha" };
      if (operation === "delete") return { id: "stu-1" };
      return null;
    });

    const sdb = scopedDb(SCHOOL_ID, ACTOR_ID);
    await sdb.student.delete({ where: { id: "stu-1" } });

    const [audit] = callsFor(fakeDb.calls, "MutationAuditLog", "create");
    expect(audit.args.data.action).toBe("DELETE");
    expect(audit.args.data.changes).toEqual({ deleted: { id: "stu-1", firstName: "Asha" } });
  });
});

describe("getScopedDb()", () => {
  it("throws when there is no session at all", async () => {
    mockedAuth.mockResolvedValue(null as any);
    await expect(getScopedDb()).rejects.toThrow(/authenticated session/i);
  });

  it("throws when the session has no schoolId (a Super Admin / Platform Staff session)", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "u1", role: "SUPER_ADMIN", schoolId: null } } as any);
    await expect(getScopedDb()).rejects.toThrow(/authenticated session/i);
  });

  it("scopes to the session's schoolId and attributes audit writes to the session's user id", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-77", role: "SCHOOL_ADMIN", schoolId: "school-77" } } as any);
    const sdb = await getScopedDb();
    await sdb.student.create({ data: { firstName: "Ravi" } as any });

    const [createCall] = callsFor(fakeDb.calls, "Student", "create");
    expect(createCall.args.data.schoolId).toBe("school-77");

    const [audit] = callsFor(fakeDb.calls, "MutationAuditLog", "create");
    expect(audit.args.data.schoolId).toBe("school-77");
    expect(audit.args.data.actorUserId).toBe("user-77");
  });

  it("never lets a query for one school's session see another school's data leak through unscoped", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "u-a", role: "SCHOOL_ADMIN", schoolId: "school-A" } } as any);
    const sdbA = await getScopedDb();
    await sdbA.student.findMany({ where: { id: { in: ["stu-from-school-B"] } } });

    const [call] = callsFor(fakeDb.calls, "Student", "findMany");
    // Even though the caller queried by a specific id, the school filter
    // is ALWAYS merged in — a cross-tenant id can never match.
    expect(call.args.where.schoolId).toBe("school-A");
  });
});
