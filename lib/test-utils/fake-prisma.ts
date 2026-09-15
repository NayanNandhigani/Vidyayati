// A minimal stand-in for the generated PrismaClient, used only by tests.
// Not a real ORM: it just records every delegate call it sees and models
// enough of Prisma Client Extensions' $allOperations contract
// ({ model, operation, args, query }) for lib/tenant-db.ts's scopedDb() to
// run against it unmodified. There is no real database in this sandbox
// (embedded-postgres can't create its data directory here — permission
// denied on the repo root), so this is the mock-at-the-Prisma-boundary
// approach instead of skipping the tenant-scoping tests.

export type RecordedCall = { model: string; operation: string; args: any };

type OperationHandler = (operation: string, args: any) => any;

function pascalCase(delegateName: string): string {
  return delegateName.charAt(0).toUpperCase() + delegateName.slice(1);
}

function defaultResult(operation: string, args: any): any {
  switch (operation) {
    case "create":
      return { id: "fake-created-id", ...(args?.data ?? {}) };
    case "update":
      return { id: "fake-updated-id", ...(args?.data ?? {}) };
    case "upsert":
      return { id: "fake-upserted-id", ...(args?.update ?? args?.create ?? {}) };
    case "delete":
      return { id: "fake-deleted-id" };
    case "findMany":
    case "createManyAndReturn":
      return [];
    case "createMany":
      return { count: Array.isArray(args?.data) ? args.data.length : 0 };
    case "findUnique":
    case "findFirst":
      return null;
    case "findUniqueOrThrow":
    case "findFirstOrThrow":
      throw new Error("Record not found");
    case "count":
      return 0;
    default:
      return null;
  }
}

/**
 * Builds a fake base Prisma client (what `db` from lib/db.ts would be) that
 * supports `$extends()` the same shape lib/tenant-db.ts's scopedDb() calls
 * it with. Every delegate call — on the base client or on a client returned
 * from `$extends()` — is pushed onto `.calls` with its FINAL args (i.e.
 * after any $allOperations interceptor has mutated them), so tests can
 * assert on what actually would have hit Postgres.
 *
 * Per-model behavior can be overridden via `setHandler(modelName, fn)` —
 * `modelName` is the PascalCase Prisma model name (e.g. "Student"), not the
 * camelCase delegate property.
 */
export function createFakeBaseClient() {
  const calls: RecordedCall[] = [];
  const handlers = new Map<string, OperationHandler>();

  async function runBase(model: string, operation: string, args: any) {
    calls.push({ model, operation, args });
    const handler = handlers.get(model);
    return handler ? handler(operation, args) : defaultResult(operation, args);
  }

  function makeBaseDelegate(delegateName: string) {
    const model = pascalCase(delegateName);
    return new Proxy(
      {},
      {
        get(_t, operation: string) {
          return (args: any) => runBase(model, operation, args);
        },
      }
    );
  }

  function extend(config: any) {
    const allOperations = config.query.$allModels.$allOperations as (params: {
      model: string;
      operation: string;
      args: any;
      query: (args: any) => any;
    }) => any;

    function makeExtendedDelegate(delegateName: string) {
      const model = pascalCase(delegateName);
      return new Proxy(
        {},
        {
          get(_t, operation: string) {
            return (args: any) =>
              allOperations({
                model,
                operation,
                args,
                query: (finalArgs: any) => runBase(model, operation, finalArgs),
              });
          },
        }
      );
    }

    return new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "$extends") return extend;
          return makeExtendedDelegate(prop);
        },
      }
    );
  }

  const client = new Proxy(
    {
      calls,
      setHandler: (model: string, fn: OperationHandler) => handlers.set(model, fn),
      reset: () => {
        calls.length = 0;
        handlers.clear();
      },
    },
    {
      get(target, prop: string) {
        if (prop in target) return (target as any)[prop];
        if (prop === "$extends") return extend;
        return makeBaseDelegate(prop);
      },
    }
  );

  return { client: client as any, calls, setHandler: (model: string, fn: OperationHandler) => handlers.set(model, fn) };
}
