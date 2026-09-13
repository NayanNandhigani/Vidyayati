import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { requirePlatformModuleAccess } from "@/lib/permissions";
import { initials } from "@/lib/format";
import { avatarColorFor } from "@/lib/academic";
import NewPlatformStaffForm from "./NewPlatformStaffForm";
import PlatformStaffDetail, { type PlatformStaffRow } from "./PlatformStaffDetail";
import SetupLinkBanner from "@/components/SetupLinkBanner";
import type { AccessLevel } from "@prisma/client";

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ staff?: string; new?: string; setupToken?: string }> }) {
  await requirePlatformModuleAccess("Staff", "VIEW");
  const session = await auth();
  const params = await searchParams;

  const users = await db.user.findMany({
    where: { schoolId: null, role: { in: ["SUPER_ADMIN", "PLATFORM_STAFF"] } },
    include: { platformStaffProfile: { include: { permissions: true } } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  const rows: PlatformStaffRow[] = users.map((u) => ({
    userId: u.id,
    staffId: u.platformStaffProfile?.id ?? null,
    name: u.name,
    username: u.username,
    phone: u.phone,
    role: u.role as "SUPER_ADMIN" | "PLATFORM_STAFF",
    status: u.status,
    title: u.platformStaffProfile?.title ?? null,
    department: u.platformStaffProfile?.department ?? null,
    dateJoined: u.platformStaffProfile?.dateJoined?.toISOString() ?? null,
    permissions: Object.fromEntries((u.platformStaffProfile?.permissions ?? []).map((p) => [p.moduleName, p.accessLevel])) as Record<string, AccessLevel>,
  }));

  const total = rows.length;
  const superAdmins = rows.filter((r) => r.role === "SUPER_ADMIN").length;
  const platformStaff = rows.filter((r) => r.role === "PLATFORM_STAFF").length;
  const active = rows.filter((r) => r.status === "ACTIVE").length;

  const selected = rows.find((r) => r.userId === params.staff);
  const canManage = session?.user.role === "SUPER_ADMIN";

  return (
    <div style={{ padding: "28px 36px", display: "flex", flexDirection: "column", gap: 18, height: "100dvh", boxSizing: "border-box" }}>
      {params.setupToken && <SetupLinkBanner token={params.setupToken} />}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div className="disp" style={{ fontSize: 22 }}>
            Staff
          </div>
          <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 2 }}>Vidya Yati's own team — who has access to what on this platform</div>
        </div>
        {canManage && (
          <Link href="/super-admin/staff?new=1" style={{ background: "var(--marigold)", color: "#fff", borderRadius: 8, padding: "9px 16px", fontSize: 13.5, fontWeight: 600, textDecoration: "none" }}>
            + Add staff
          </Link>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        <Stat label="Total accounts" value={total} />
        <Stat label="Super Admins" value={superAdmins} color="var(--teal)" />
        <Stat label="Platform staff" value={platformStaff} color="var(--marigold-deep)" />
        <Stat label="Active" value={active} color="var(--good)" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, flex: 1, minHeight: 0 }}>
        <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Staff directory</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
              Showing <span className="mono">{total}</span> accounts
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1.3fr 1fr 0.9fr", fontSize: 11, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.04em", paddingBottom: 10, borderBottom: "1px solid var(--line)" }}>
            <div>Name</div>
            <div>Role</div>
            <div>Department</div>
            <div>Status</div>
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {rows.map((r) => {
              const isSelected = r.userId === selected?.userId;
              return (
                <Link
                  key={r.userId}
                  href={`/super-admin/staff?staff=${r.userId}`}
                  style={{ display: "grid", gridTemplateColumns: "2fr 1.3fr 1fr 0.9fr", alignItems: "center", padding: "11px 0", borderBottom: "1px solid var(--line)", fontSize: 13.5, textDecoration: "none", color: "inherit", background: isSelected ? "var(--marigold-tint)" : "transparent" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", fontSize: 11.5, background: avatarColorFor(r.userId), display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#fff", flex: "none" }}>
                      {initials(r.name)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                      <div className="mono" style={{ fontSize: 10.5, color: "var(--faint)" }}>
                        {r.username}
                      </div>
                    </div>
                  </div>
                  <div style={{ color: "var(--muted)" }}>{r.role === "SUPER_ADMIN" ? "Super Admin" : r.title ?? "Platform Staff"}</div>
                  <div style={{ color: "var(--muted)" }}>{r.department ?? "—"}</div>
                  <div>
                    <span className="pill" style={{ background: r.status === "ACTIVE" ? "var(--good-tint)" : "var(--critical-tint)", color: r.status === "ACTIVE" ? "var(--good)" : "var(--critical)" }}>
                      {r.status === "ACTIVE" ? "Active" : "Deactivated"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
          {params.new && canManage ? (
            <NewPlatformStaffForm />
          ) : selected ? (
            <PlatformStaffDetail staff={selected} canManage={canManage} />
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
              Select a staff account to view or edit their access, or add a new one.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="card" style={{ padding: "16px 18px" }}>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>{label}</div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: color ?? "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}
