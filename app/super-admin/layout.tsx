import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { signOutAction } from "@/app/app/actions";
import { IconHome, IconSchool, IconReceipt, IconWallet, IconBarChart, IconSettings, IconLogOut, IconUsers, IconFileText, IconLock, IconClipboard, IconTag, IconTarget } from "@/components/icons";
import { initials } from "@/lib/format";
import { getPlatformPermissionMap } from "@/lib/permissions";
import type { PlatformModule } from "@/lib/platform-modules";

const NAV: { label: string; href: string; icon: typeof IconHome; module?: PlatformModule }[] = [
  { label: "Dashboard", href: "/super-admin/dashboard", icon: IconHome },
  { label: "Schools", href: "/super-admin/schools", icon: IconSchool, module: "Schools" },
  { label: "Leads", href: "/super-admin/leads", icon: IconTarget, module: "Leads" },
  { label: "Subscriptions & Billing", href: "/super-admin/subscriptions", icon: IconReceipt, module: "Subscriptions & Billing" },
  { label: "Plans", href: "/super-admin/plans", icon: IconTag, module: "Plans" },
  { label: "Accounts", href: "/super-admin/accounts", icon: IconWallet, module: "Accounts" },
  { label: "Contracts", href: "/super-admin/contracts", icon: IconFileText, module: "Contracts" },
  { label: "Staff", href: "/super-admin/staff", icon: IconUsers, module: "Staff" },
  { label: "Reports", href: "/super-admin/reports", icon: IconBarChart, module: "Reports" },
  { label: "Audit Log", href: "/super-admin/audit-log", icon: IconClipboard, module: "Audit Log" },
  { label: "Settings", href: "/super-admin/settings", icon: IconSettings },
];

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "SUPER_ADMIN" && session.user.role !== "PLATFORM_STAFF")) {
    redirect("/login");
  }

  // SUPER_ADMIN sees every module; PLATFORM_STAFF only the ones they have
  // at least VIEW access to (getPlatformPermissionMap returns null for
  // SUPER_ADMIN to mean "unrestricted").
  const permissionMap = await getPlatformPermissionMap();
  const nav = NAV.filter((item) => !item.module || !permissionMap || (permissionMap[item.module] ?? "NONE") !== "NONE");

  return (
    <div style={{ display: "flex" }}>
      <aside className="print-hide" style={{ width: 236, flex: "none", background: "var(--sidebar)", color: "#fff", display: "flex", flexDirection: "column", height: "100dvh", position: "sticky", top: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "20px 16px 14px" }}>
          <IconSchool style={{ width: 20, height: 20, color: "var(--marigold)" }} />
          <div>
            <div className="disp" style={{ fontSize: 15.5, lineHeight: 1.1 }}>
              Vidya Yati
            </div>
            <div style={{ fontSize: 10.5, color: "#7f8bb0", marginTop: 2 }}>Platform Admin</div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: "0 8px" }}>
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="navitem" style={{ margin: "0 0 2px" }}>
                <Icon className="icon" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ borderTop: "1px solid rgba(255,255,255,.08)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--marigold)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flex: "none" }}>
            {initials(session.user.name ?? "VY")}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{session.user.name}</div>
            <div style={{ fontSize: 10.5, color: "#7f8bb0" }}>{session.user.role === "SUPER_ADMIN" ? "Super Admin" : "Platform Staff"}</div>
          </div>
          <Link href="/super-admin/change-password" title="Change password" style={{ color: "#aeb8d6", padding: 4, display: "flex" }}>
            <IconLock style={{ width: 16, height: 16 }} />
          </Link>
          <form action={signOutAction}>
            <button type="submit" title="Sign out" style={{ background: "none", border: "none", color: "#aeb8d6", cursor: "pointer", padding: 4, display: "flex" }}>
              <IconLogOut style={{ width: 16, height: 16 }} />
            </button>
          </form>
        </div>
      </aside>
      <div style={{ flex: 1, minWidth: 0, background: "var(--paper)" }}>{children}</div>
    </div>
  );
}
