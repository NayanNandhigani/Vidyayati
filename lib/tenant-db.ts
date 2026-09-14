import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { auth } from "@/auth";

// Every model below platform level carries a direct `schoolId` column (see
// prisma/schema.prisma header comment). We discover that set from the DMMF
// at module load rather than hardcoding it, so a new model automatically
// gets scoped the moment someone adds a schoolId field to it — the whole
// point of centralizing this is that call sites should never be the thing
// that has to remember tenant scoping.
const TENANT_SCOPED_MODELS = new Set(
  Prisma.dmmf.datamodel.models
    .filter((model) => model.fields.some((field) => field.name === "schoolId"))
    .map((model) => model.name)
);

// Models whose mutations matter enough to record who changed what — not
// every tenant-scoped model, just the ones a School Admin would actually
// want to answer "who changed this" about. Add a model here (not at call
// sites) to start auditing it.
export const AUDITED_MODELS = new Set([
  "Mark",
  "Student",
  "FeePayment",
  "FeeDiscount",
  "FeeAdjustment",
  "AccountsTransaction",
  "StaffPermission",
  "PayrollRun",
  "Attendance",
  "HostelAllocation",
  "Exam",
]);

export const AUDITED_MODEL_LABEL: Record<string, string> = {
  Mark: "Mark",
  Student: "Student",
  FeePayment: "Fee Payment",
  FeeDiscount: "Fee Discount",
  FeeAdjustment: "Fee Adjustment",
  AccountsTransaction: "Accounts Transaction",
  StaffPermission: "Staff Permission",
  PayrollRun: "Payroll Run",
  Attendance: "Attendance",
  HostelAllocation: "Hostel Allocation",
  Exam: "Exam",
};

const FILTER_BY_WHERE_OPS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "deleteMany",
  "update",
  "delete",
]);

const AUDITED_OPS = new Set(["create", "update", "upsert", "delete"]);

// "StaffPermission" -> "staffPermission" — the same PascalCase-to-camelCase
// convention Prisma itself uses for client delegate property names.
type FindUniqueDelegate = { findUnique: (args: { where: unknown }) => Promise<unknown> };
function delegateFor(model: string): FindUniqueDelegate | undefined {
  return (db as unknown as Record<string, FindUniqueDelegate | undefined>)[model.charAt(0).toLowerCase() + model.slice(1)];
}

// Unwrap Prisma's `{ set: x }` scalar update-operator shape to the plain
// value being set. Only matches plain object literals (constructor ===
// Object) so Decimal/Date instances — which have their own constructors —
// pass through untouched and stringify correctly via String() below.
function unwrapUpdateValue(value: unknown): unknown {
  if (value !== null && typeof value === "object" && value.constructor === Object && "set" in value) {
    return (value as { set: unknown }).set;
  }
  return value;
}

function diffFields(before: Record<string, unknown>, data: Record<string, unknown>): Record<string, { before: string; after: string }> | null {
  const changes: Record<string, { before: string; after: string }> = {};
  for (const key of Object.keys(data)) {
    if (!(key in before)) continue; // relation/nested-write keys etc. — not a plain scalar column
    const nextValue = unwrapUpdateValue(data[key]);
    const beforeStr = String(before[key]);
    const afterStr = String(nextValue);
    if (beforeStr !== afterStr) changes[key] = { before: beforeStr, after: afterStr };
  }
  return Object.keys(changes).length > 0 ? changes : null;
}

async function writeAuditLog(params: { schoolId: string; actorUserId?: string; action: "CREATE" | "UPDATE" | "DELETE"; entityType: string; entityId: string; changes?: unknown }) {
  await db.mutationAuditLog
    .create({
      data: {
        schoolId: params.schoolId,
        actorUserId: params.actorUserId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        changes: params.changes ? (params.changes as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    })
    .catch(() => {});
}

/**
 * Returns a Prisma client scoped to a single school: every query against a
 * tenant-scoped model gets `schoolId` merged into its `where`, and every
 * create gets `schoolId` stamped onto its `data`. This is the ONLY
 * sanctioned way to read/write tenant data outside the Super Admin portal —
 * route handlers and server actions should call getScopedDb() (below)
 * rather than importing the raw `db` export.
 *
 * Also audits create/update/upsert/delete on AUDITED_MODELS — see
 * MutationAuditLog in prisma/schema.prisma. `actorUserId` is who to
 * attribute those writes to; omit it only for system/seed-style writes
 * where there's no real user in the loop.
 */
export function scopedDb(schoolId: string, actorUserId?: string) {
  return db.$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_SCOPED_MODELS.has(model)) {
            return query(args);
          }

          const a = args as Record<string, unknown>;

          if (FILTER_BY_WHERE_OPS.has(operation)) {
            a.where = { ...((a.where as object) ?? {}), schoolId };
          } else if (operation === "upsert") {
            a.where = { ...((a.where as object) ?? {}), schoolId };
            a.create = { ...((a.create as object) ?? {}), schoolId };
          } else if (operation === "create") {
            a.data = { ...((a.data as object) ?? {}), schoolId };
          } else if (operation === "createMany" || operation === "createManyAndReturn") {
            const data = a.data;
            a.data = Array.isArray(data)
              ? data.map((row) => ({ ...row, schoolId }))
              : data;
          }

          if (!AUDITED_MODELS.has(model) || !AUDITED_OPS.has(operation)) {
            return query(args);
          }

          // Pre-mutation read for update/upsert/delete — needed to diff
          // against, and to tell an upsert-that-updates from an
          // upsert-that-creates. Reuses the same (now schoolId-merged)
          // `where` the real operation will use, so it works whether the
          // caller looked the row up by id or by a compound unique key.
          let before: Record<string, unknown> | null = null;
          if (operation !== "create") {
            const delegate = delegateFor(model);
            before = delegate ? ((await delegate.findUnique({ where: a.where }).catch(() => null)) as Record<string, unknown> | null) : null;
          }

          const result = await query(args);
          const entityId = (result as { id?: string } | null)?.id;
          if (!entityId) return result;

          if (operation === "create") {
            await writeAuditLog({ schoolId, actorUserId, action: "CREATE", entityType: model, entityId });
          } else if (operation === "delete") {
            await writeAuditLog({ schoolId, actorUserId, action: "DELETE", entityType: model, entityId, changes: before ? { deleted: before } : undefined });
          } else if (operation === "update" || operation === "upsert") {
            if (before) {
              const dataForDiff = (operation === "upsert" ? a.update : a.data) as Record<string, unknown> | undefined;
              const changes = dataForDiff ? diffFields(before, dataForDiff) : null;
              if (changes) await writeAuditLog({ schoolId, actorUserId, action: "UPDATE", entityType: model, entityId, changes });
            } else if (operation === "upsert") {
              // Row didn't exist yet — upsert took the create branch.
              await writeAuditLog({ schoolId, actorUserId, action: "CREATE", entityType: model, entityId });
            }
          }

          return result;
        },
      },
    },
  });
}

export type ScopedDb = ReturnType<typeof scopedDb>;

/**
 * Prisma's generated `create` input types require `schoolId` (or a nested
 * `school: { connect }`) even though scopedDb()'s extension stamps it in at
 * query time and overwrites whatever's passed. Wrap a create payload with
 * this to omit schoolId at the call site without an inline `as unknown as`
 * cast at every one — e.g. `data: scopedCreateData<Prisma.StudentUncheckedCreateInput>({ name, classId })`.
 */
export function scopedCreateData<T extends { schoolId?: string | null }>(data: Omit<T, "schoolId">): T {
  return data as unknown as T;
}

/**
 * Server-side helper for route handlers / server actions: pulls schoolId
 * and the current user's id off the session and returns a client scoped to
 * it. Throws if there's no session or no schoolId (Super Admin sessions
 * have none — Super Admin code should use `db` directly and query across
 * schools deliberately, since that's the one legitimate exception).
 */
export async function getScopedDb(): Promise<ScopedDb> {
  const session = await auth();
  if (!session?.user?.schoolId) {
    throw new Error(
      "getScopedDb() requires an authenticated session with a schoolId. " +
        "Super Admin routes should use `db` from lib/db.ts directly."
    );
  }
  return scopedDb(session.user.schoolId, session.user.id);
}
