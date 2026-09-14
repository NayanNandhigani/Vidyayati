import { db } from "@/lib/db";
import { requirePlatformModuleAccess } from "@/lib/permissions";
import { AUDITED_MODEL_LABEL } from "@/lib/tenant-db";
import AuditLogTable, { type AuditLogRow } from "@/components/AuditLogTable";

export default async function SuperAdminAuditLogPage({ searchParams }: { searchParams: Promise<{ entityType?: string; actorUserId?: string; schoolId?: string; from?: string; to?: string }> }) {
  await requirePlatformModuleAccess("Audit Log", "VIEW");

  const params = await searchParams;

  const [rowsRaw, actors, schools] = await Promise.all([
    db.mutationAuditLog.findMany({
      where: {
        ...(params.entityType ? { entityType: params.entityType } : {}),
        ...(params.actorUserId ? { actorUserId: params.actorUserId } : {}),
        ...(params.schoolId ? { schoolId: params.schoolId } : {}),
        ...(params.from || params.to
          ? {
              occurredAt: {
                ...(params.from ? { gte: new Date(params.from) } : {}),
                ...(params.to ? { lte: new Date(new Date(params.to).getTime() + 24 * 60 * 60 * 1000) } : {}),
              },
            }
          : {}),
      },
      orderBy: { occurredAt: "desc" },
      take: 200,
      include: { actor: { select: { name: true } }, school: { select: { name: true } } },
    }),
    db.user.findMany({ where: { role: { in: ["SCHOOL_ADMIN", "STAFF"] } }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 }),
    db.school.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const rows: AuditLogRow[] = rowsRaw.map((r) => ({
    id: r.id,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    changes: r.changes,
    occurredAt: r.occurredAt.toISOString(),
    actorName: r.actor?.name ?? null,
    schoolName: r.school?.name ?? null,
  }));

  return (
    <div style={{ padding: "28px 36px", display: "flex", flexDirection: "column", gap: 18, height: "100dvh", boxSizing: "border-box" }}>
      <div>
        <div className="disp" style={{ fontSize: 22 }}>
          Audit log
        </div>
        <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 2 }}>Who changed what, across every school on the platform</div>
      </div>

      <form method="GET" className="card" style={{ padding: 16, display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <label className="field">
          School
          <select className="in" name="schoolId" defaultValue={params.schoolId ?? ""}>
            <option value="">All</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Entity type
          <select className="in" name="entityType" defaultValue={params.entityType ?? ""}>
            <option value="">All</option>
            {Object.entries(AUDITED_MODEL_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Actor
          <select className="in" name="actorUserId" defaultValue={params.actorUserId ?? ""}>
            <option value="">All</option>
            {actors.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          From
          <input className="in mono" type="date" name="from" defaultValue={params.from ?? ""} />
        </label>
        <label className="field">
          To
          <input className="in mono" type="date" name="to" defaultValue={params.to ?? ""} />
        </label>
        <button type="submit" style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Filter
        </button>
      </form>

      <div className="card" style={{ padding: 22, flex: 1, minHeight: 0, overflowY: "auto" }}>
        <AuditLogTable rows={rows} showSchool />
      </div>
    </div>
  );
}
