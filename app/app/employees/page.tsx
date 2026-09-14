import Link from "next/link";
import { auth } from "@/auth";
import { getScopedDb } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import Avatar from "@/components/Avatar";
import { SortableHeader, resolveSort } from "@/components/SortableHeader";
import type { Prisma } from "@prisma/client";
import StatutoryRatesPanel from "./StatutoryRatesPanel";
import { hasFeature } from "@/lib/feature-flags";

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ q?: string; sortBy?: string; sortDir?: string }> }) {
  await requireModuleAccess("Employees", "VIEW");
  const session = await auth();
  const isAdmin = session!.user.role === "SCHOOL_ADMIN";
  const params = await searchParams;
  const sdb = await getScopedDb();

  const orderBy = resolveSort<Prisma.StaffProfileOrderByWithRelationInput>(
    params,
    {
      name: (dir) => ({ user: { name: dir } }),
      designation: (dir) => ({ designation: dir }),
      department: (dir) => ({ department: dir }),
      contact: (dir) => ({ user: { phone: dir } }),
      status: (dir) => ({ employmentStatus: dir }),
    },
    { user: { name: "asc" } }
  );

  const staffList = await sdb.staffProfile.findMany({
    where: params.q ? { user: { name: { contains: params.q, mode: "insensitive" } } } : undefined,
    include: { user: true },
    orderBy,
  });

  const totalStaff = staffList.length;
  const teachingStaff = staffList.filter((s) => (s.designation ?? "").toLowerCase().includes("teacher")).length;
  const onLeaveToday = staffList.filter((s) => s.employmentStatus === "ON_LEAVE").length;

  const showStructuredPayroll = await hasFeature(session!.user.schoolId, "payroll.structuredSalary");
  const school = showStructuredPayroll && isAdmin
    ? await sdb.school.findUnique({ where: { id: session!.user.schoolId! }, select: { pfPercent: true, esiPercent: true, ptFixedAmount: true, tdsPercent: true } })
    : null;

  return (
    <div style={{ padding: "26px 34px", display: "flex", flexDirection: "column", gap: 16, height: "100dvh", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="disp" style={{ fontSize: 21 }}>
          Employees <span className="mono" style={{ fontSize: 14, fontWeight: 500, color: "var(--faint)" }}>· {totalStaff}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {school && (
            <StatutoryRatesPanel
              pfPercent={school.pfPercent ? Number(school.pfPercent) : null}
              esiPercent={school.esiPercent ? Number(school.esiPercent) : null}
              ptFixedAmount={school.ptFixedAmount ? Number(school.ptFixedAmount) : null}
              tdsPercent={school.tdsPercent ? Number(school.tdsPercent) : null}
            />
          )}
          {isAdmin && (
            <Link href="/app/employees/new" style={{ background: "var(--marigold)", color: "#fff", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
              + Add Staff
            </Link>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 13 }}>
        <Stat label="Total staff" value={totalStaff} />
        <Stat label="Teaching staff" value={teachingStaff} color="var(--teal)" />
        <Stat label="Non-teaching staff" value={totalStaff - teachingStaff} />
        <Stat label="On leave" value={onLeaveToday} color="var(--warn)" />
      </div>

      <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", background: "var(--paper)" }}>
          <form method="GET" style={{ display: "flex", gap: 10 }}>
            <input type="hidden" name="sortBy" value={params.sortBy ?? ""} />
            <input type="hidden" name="sortDir" value={params.sortDir ?? ""} />
            <input className="in" name="q" defaultValue={params.q} placeholder="Search staff…" style={{ flex: 1, background: "var(--card)" }} />
            <button type="submit" style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "0 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Search
            </button>
          </form>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.9fr 1.6fr 1.1fr 1.3fr 0.9fr 0.8fr", padding: "12px 20px", borderBottom: "1px solid var(--line)", fontSize: 11, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          <div><SortableHeader label="Staff" field="name" basePath="/app/employees" currentParams={params} /></div>
          <div><SortableHeader label="Designation" field="designation" basePath="/app/employees" currentParams={params} /></div>
          <div><SortableHeader label="Department" field="department" basePath="/app/employees" currentParams={params} /></div>
          <div><SortableHeader label="Contact" field="contact" basePath="/app/employees" currentParams={params} /></div>
          <div><SortableHeader label="Status" field="status" basePath="/app/employees" currentParams={params} /></div>
          <div />
        </div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          {staffList.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>No staff found.</div>}
          {staffList.map((s) => (
            <div
              key={s.id}
              style={{ display: "grid", gridTemplateColumns: "1.9fr 1.6fr 1.1fr 1.3fr 0.9fr 0.8fr", alignItems: "center", padding: "12px 20px", borderBottom: "1px solid var(--line)" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar photoPath={s.photoPath} seed={s.id} name={s.user.name} size={34} fontSize={12} />
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{s.user.name}</div>
              </div>
              <div style={{ fontSize: 12.5 }}>{s.designation ?? "—"}</div>
              <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{s.department ?? "—"}</div>
              <div className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>{s.user.phone ?? "—"}</div>
              <div>
                <span className="pill" style={{ background: s.employmentStatus === "ACTIVE" ? "var(--good-tint)" : "var(--warn-tint)", color: s.employmentStatus === "ACTIVE" ? "var(--good)" : "var(--warn)" }}>
                  {s.employmentStatus === "ACTIVE" ? "Active" : "On Leave"}
                </span>
              </div>
              <div>
                <Link
                  href={`/app/employees/${s.id}`}
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 700, color: "var(--marigold-deep)", textDecoration: "none" }}
                >
                  Open →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="card" style={{ padding: "14px 17px" }}>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 6 }}>{label}</div>
      <div className="mono" style={{ fontSize: 21, fontWeight: 700, color: color ?? "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}
