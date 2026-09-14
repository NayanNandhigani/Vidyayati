"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { initials } from "@/lib/format";
import { avatarColorFor } from "@/lib/academic";
import type { AccessLevel } from "@prisma/client";
import { PLATFORM_MODULES } from "@/lib/platform-modules";
import { cyclePlatformPermission, togglePlatformStaffStatus } from "./actions";

const LEVEL_STYLE: Record<AccessLevel, { bg: string; fg: string; label: string }> = {
  NONE: { bg: "var(--line)", fg: "var(--faint)", label: "No access" },
  VIEW: { bg: "var(--marigold-tint)", fg: "var(--marigold-deep)", label: "View only" },
  EDIT: { bg: "var(--teal-tint)", fg: "var(--teal)", label: "View + Edit" },
};

export type PlatformStaffRow = {
  userId: string;
  staffId: string | null; // null for a true Super Admin row (no PlatformStaffProfile)
  name: string;
  username: string;
  phone: string | null;
  role: "SUPER_ADMIN" | "PLATFORM_STAFF";
  status: "ACTIVE" | "INACTIVE";
  title: string | null;
  department: string | null;
  dateJoined: string | null;
  permissions: Record<string, AccessLevel>;
};

export default function PlatformStaffDetail({ staff, canManage }: { staff: PlatformStaffRow; canManage: boolean }) {
  const [perms, setPerms] = useState(staff.permissions);
  const [status, setStatus] = useState(staff.status);
  const [pending, startTransition] = useTransition();

  function togglePerm(moduleName: string) {
    if (!canManage || !staff.staffId) return;
    startTransition(async () => {
      const res = await cyclePlatformPermission(staff.staffId!, moduleName);
      setPerms((prev) => ({ ...prev, [moduleName]: res.accessLevel }));
    });
  }

  function toggleStatus() {
    if (!canManage) return;
    startTransition(async () => {
      await togglePlatformStaffStatus(staff.userId);
      setStatus((prev) => (prev === "ACTIVE" ? "INACTIVE" : "ACTIVE"));
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16 }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", fontSize: 17, background: avatarColorFor(staff.userId), display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#fff", flex: "none" }}>
          {initials(staff.name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 16.5 }}>{staff.name}</div>
            <span className="pill" style={{ background: status === "ACTIVE" ? "var(--good-tint)" : "var(--critical-tint)", color: status === "ACTIVE" ? "var(--good)" : "var(--critical)" }}>
              {status === "ACTIVE" ? "Active" : "Deactivated"}
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
            {staff.role === "SUPER_ADMIN" ? "Super Admin" : staff.title ?? "Platform Staff"} {staff.department && `· ${staff.department}`}
          </div>
        </div>
        <Link href="/super-admin/staff" style={{ cursor: "pointer", color: "var(--muted)", fontSize: 17, textDecoration: "none", flex: "none" }}>
          ×
        </Link>
      </div>

      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <SectionTitle>Contact</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 18px", marginBottom: 4 }}>
          <Field label="Username" value={staff.username} mono />
          <Field label="Phone" value={staff.phone ?? "—"} mono />
          <Field label="Date joined" value={staff.dateJoined ? new Date(staff.dateJoined).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"} />
        </div>

        <SectionTitle>Access &amp; permissions</SectionTitle>
        {staff.role === "SUPER_ADMIN" ? (
          <div style={{ background: "var(--good-tint)", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "var(--good)", fontWeight: 600 }}>
            Super Admin — full access to every platform module. Permissions can't be restricted for this role.
          </div>
        ) : (
          <>
            <div style={{ background: "var(--teal-tint)", borderRadius: 8, padding: "10px 12px", fontSize: 11.5, color: "var(--teal)", marginBottom: 14, lineHeight: 1.4 }}>
              Access is granted per module and action, not by a fixed role. {canManage ? "Click a permission to cycle its level." : "Only a Super Admin can change these."}
            </div>
            {PLATFORM_MODULES.map((m) => {
              const level = perms[m] ?? "NONE";
              const style = LEVEL_STYLE[level];
              return (
                <div key={m} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10.5px 0", borderBottom: "1px solid var(--line)" }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{m}</div>
                  <span className="pill" onClick={() => togglePerm(m)} style={{ background: style.bg, color: style.fg, cursor: canManage ? "pointer" : "default", opacity: pending ? 0.6 : 1 }}>
                    {style.label}
                  </span>
                </div>
              );
            })}
          </>
        )}
      </div>

      {staff.role === "PLATFORM_STAFF" && canManage && (
        <button
          onClick={toggleStatus}
          disabled={pending}
          style={{
            marginTop: 14,
            flex: "none",
            background: status === "ACTIVE" ? "var(--critical-tint)" : "var(--good-tint)",
            color: status === "ACTIVE" ? "var(--critical)" : "var(--good)",
            border: "none",
            borderRadius: 8,
            padding: "10px 0",
            fontSize: 13,
            fontWeight: 700,
            cursor: pending ? "default" : "pointer",
          }}
        >
          {status === "ACTIVE" ? "Deactivate account" : "Reactivate account"}
        </button>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "18px 0 10px" }}>{children}</div>;
}
function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{label}</div>
      <div className={mono ? "mono" : undefined} style={{ fontSize: 13, fontWeight: 600 }}>
        {value}
      </div>
    </div>
  );
}
