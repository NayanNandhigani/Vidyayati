import Link from "next/link";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/format";
import { requirePlatformModuleAccess } from "@/lib/permissions";
import NewContractForm from "./NewContractForm";
import ContractDetail, { type ContractRow } from "./ContractDetail";

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  DRAFT: { bg: "var(--line)", fg: "var(--faint)", label: "Draft" },
  SENT: { bg: "var(--info-tint)", fg: "var(--info)", label: "Sent" },
  SIGNED: { bg: "var(--good-tint)", fg: "var(--good)", label: "Signed" },
  CANCELLED: { bg: "var(--critical-tint)", fg: "var(--critical)", label: "Cancelled" },
};

export default async function ContractsPage({ searchParams }: { searchParams: Promise<{ contract?: string; new?: string; school?: string }> }) {
  const access = await requirePlatformModuleAccess("Contracts", "VIEW");
  const params = await searchParams;
  const canManage = access === "EDIT";

  const [contracts, schools] = await Promise.all([
    db.contract.findMany({ include: { school: true }, orderBy: { createdAt: "desc" } }),
    db.school.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const rows: ContractRow[] = contracts.map((c) => ({
    id: c.id,
    contractNumber: c.contractNumber,
    schoolName: c.school.name,
    billingCycle: c.billingCycle,
    annualFee: Number(c.annualFee),
    startDate: c.startDate.toISOString(),
    endDate: c.endDate.toISOString(),
    status: c.status,
    signatoryName: c.signatoryName,
    signatoryTitle: c.signatoryTitle,
    signedDate: c.signedDate?.toISOString() ?? null,
  }));

  const total = rows.length;
  const signed = rows.filter((r) => r.status === "SIGNED").length;
  const awaitingSignature = rows.filter((r) => r.status === "SENT").length;
  const draft = rows.filter((r) => r.status === "DRAFT").length;

  const selected = rows.find((r) => r.id === params.contract);

  return (
    <div style={{ padding: "28px 36px", display: "flex", flexDirection: "column", gap: 18, height: "100dvh", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div className="disp" style={{ fontSize: 22 }}>
            Contracts
          </div>
          <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 2 }}>Legal onboarding agreements — printable and signable outside the platform</div>
        </div>
        {canManage && (
          <Link href="/super-admin/contracts?new=1" style={{ background: "var(--marigold)", color: "#fff", borderRadius: 8, padding: "9px 16px", fontSize: 13.5, fontWeight: 600, textDecoration: "none" }}>
            + Create contract
          </Link>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        <Stat label="Total contracts" value={total} />
        <Stat label="Draft" value={draft} color="var(--faint)" />
        <Stat label="Awaiting signature" value={awaitingSignature} color="var(--info)" />
        <Stat label="Signed" value={signed} color="var(--good)" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, flex: 1, minHeight: 0 }}>
        <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>All contracts</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
              Showing <span className="mono">{total}</span>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.1fr", fontSize: 11, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.04em", paddingBottom: 10, borderBottom: "1px solid var(--line)" }}>
            <div>School</div>
            <div>Fee</div>
            <div>Ends</div>
            <div>Status</div>
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {rows.length === 0 && <div style={{ padding: "24px 0", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No contracts yet.</div>}
            {rows.map((r) => {
              const style = STATUS_STYLE[r.status];
              const isSelected = r.id === selected?.id;
              return (
                <Link
                  key={r.id}
                  href={`/super-admin/contracts?contract=${r.id}`}
                  style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.1fr", alignItems: "center", padding: "13px 0", borderBottom: "1px solid var(--line)", fontSize: 13.5, textDecoration: "none", color: "inherit", background: isSelected ? "var(--marigold-tint)" : "transparent" }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{r.schoolName}</div>
                    <div className="mono" style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 1 }}>
                      {r.contractNumber}
                    </div>
                  </div>
                  <div className="mono" style={{ color: "var(--muted)" }}>
                    {formatINR(r.annualFee)}
                  </div>
                  <div className="mono" style={{ color: "var(--muted)" }}>
                    {new Date(r.endDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </div>
                  <div>
                    <span className="pill" style={{ background: style.bg, color: style.fg }}>
                      {style.label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
          {params.new && canManage ? (
            <NewContractForm schools={schools} defaultSchoolId={params.school} />
          ) : selected ? (
            <ContractDetail contract={selected} canManage={canManage} />
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
              Select a contract to view it, or create a new one to onboard a school.
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
