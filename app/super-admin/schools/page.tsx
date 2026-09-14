import Link from "next/link";
import { db } from "@/lib/db";
import { requirePlatformModuleAccess } from "@/lib/permissions";
import OnboardForm from "./OnboardForm";

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  ACTIVE: { bg: "var(--good-tint)", fg: "var(--good)", label: "Active" },
  TRIAL: { bg: "var(--info-tint)", fg: "var(--info)", label: "Trial" },
  EXPIRING: { bg: "var(--warn-tint)", fg: "var(--warn)", label: "Expiring soon" },
  OVERDUE: { bg: "var(--critical-tint)", fg: "var(--critical)", label: "Overdue" },
  CANCELLED: { bg: "var(--line)", fg: "var(--faint)", label: "Cancelled" },
};

export default async function SchoolsPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const access = await requirePlatformModuleAccess("Schools", "VIEW");
  const canManage = access === "EDIT";
  const params = await searchParams;

  const schools = await db.school.findMany({
    orderBy: { onboardedOn: "desc" },
  });
  const studentCounts = await db.student.groupBy({ by: ["schoolId"], where: { status: "ACTIVE" }, _count: true });
  const countMap = new Map(studentCounts.map((s) => [s.schoolId, s._count]));

  const total = schools.length;
  const active = schools.filter((s) => s.status === "ACTIVE").length;
  const trial = schools.filter((s) => s.status === "TRIAL").length;
  const issues = schools.filter((s) => s.status === "EXPIRING" || s.status === "OVERDUE").length;

  return (
    <div style={{ padding: "28px 36px", display: "flex", flexDirection: "column", gap: 18, height: "100dvh", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div className="disp" style={{ fontSize: 22 }}>
            Schools
          </div>
          <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 2 }}>Every school onboarded onto the Vidya Yati platform</div>
        </div>
        {canManage && (
          <Link href="/super-admin/schools?new=1" style={{ background: "var(--marigold)", color: "#fff", borderRadius: 8, padding: "9px 16px", fontSize: 13.5, fontWeight: 600, textDecoration: "none" }}>
            + Onboard a school
          </Link>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        <Stat label="Total schools" value={total} />
        <Stat label="Active" value={active} color="var(--good)" />
        <Stat label="Trial" value={trial} color="var(--info)" />
        <Stat label="Expiring / overdue" value={issues} color="var(--warn)" warnBg />
      </div>

      {issues > 0 && (
        <div style={{ background: "var(--warn-tint)", border: "1px solid #EED9B4", borderRadius: 10, padding: "13px 18px", fontSize: 13.5, color: "#7A5407" }}>
          <b>
            {issues} school{issues === 1 ? "" : "s"}
          </b>{" "}
          need attention — renewals expiring soon or payments overdue.
        </div>
      )}

      {params.new && canManage ? (
        <div className="card" style={{ padding: 20, maxWidth: 640 }}>
          <OnboardForm />
        </div>
      ) : (
        <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Schools directory</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
              Showing <span className="mono">{total}</span> schools
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2.4fr 1.2fr 0.85fr 1.15fr 1.15fr", fontSize: 11, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.04em", paddingBottom: 10, borderBottom: "1px solid var(--line)" }}>
            <div>School</div>
            <div>City</div>
            <div>Students</div>
            <div>Status</div>
            <div>Onboarded</div>
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {schools.map((s) => {
              const style = STATUS_STYLE[s.status];
              return (
                <Link key={s.id} href={`/super-admin/schools/${s.id}`} style={{ display: "grid", gridTemplateColumns: "2.4fr 1.2fr 0.85fr 1.15fr 1.15fr", alignItems: "center", padding: "13px 0", borderBottom: "1px solid var(--line)", fontSize: 13.5, textDecoration: "none", color: "inherit" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{s.name}</div>
                    <div className="mono" style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 1 }}>
                      {s.code}
                    </div>
                  </div>
                  <div style={{ color: "var(--muted)" }}>{s.city ?? "—"}</div>
                  <div className="mono">{countMap.get(s.id) ?? 0}</div>
                  <div>
                    <span className="pill" style={{ background: style.bg, color: style.fg }}>
                      {style.label}
                    </span>
                  </div>
                  <div className="mono" style={{ color: "var(--muted)" }}>
                    {s.onboardedOn.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color, warnBg }: { label: string; value: React.ReactNode; color?: string; warnBg?: boolean }) {
  return (
    <div className="card" style={{ padding: "16px 18px", ...(warnBg ? { borderColor: "#EED9B4", background: "var(--warn-tint)" } : {}) }}>
      <div style={{ fontSize: 12, color: warnBg ? "var(--warn)" : "var(--muted)", marginBottom: 8, fontWeight: warnBg ? 600 : 400 }}>{label}</div>
      <div className="mono" style={{ fontSize: 25, fontWeight: 600, color: color ?? "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}
