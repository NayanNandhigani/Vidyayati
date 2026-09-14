import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/format";
import { requirePlatformModuleAccess } from "@/lib/permissions";
import PrintButton from "../../PrintButton";

export default async function ContractPrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformModuleAccess("Contracts", "VIEW");
  const { id } = await params;

  const contract = await db.contract.findUnique({ where: { id }, include: { school: true } });
  if (!contract) notFound();

  const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div style={{ padding: "28px 36px", display: "flex", flexDirection: "column", gap: 16, minHeight: "100dvh", boxSizing: "border-box", background: "var(--paper)" }}>
      <div className="print-hide" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>
          Contract <span className="mono">{contract.contractNumber}</span> — {contract.status[0] + contract.status.slice(1).toLowerCase()}
        </div>
        <PrintButton />
      </div>

      <div className="print-page card" style={{ maxWidth: 780, margin: "0 auto", width: "100%", padding: "48px 56px", color: "#111" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid #111", paddingBottom: 16, marginBottom: 28 }}>
          <div className="disp" style={{ fontSize: 22 }}>
            Vidya Yati
          </div>
          <div style={{ textAlign: "right", fontSize: 12 }}>
            <div style={{ fontWeight: 700 }}>Subscription Agreement</div>
            <div className="mono" style={{ color: "#555" }}>
              {contract.contractNumber}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28, fontSize: 13 }}>
          <div>
            <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: "#666", marginBottom: 4 }}>School</div>
            <div style={{ fontWeight: 700 }}>{contract.school.name}</div>
            <div style={{ color: "#555" }}>
              {contract.school.city}
              {contract.school.state ? `, ${contract.school.state}` : ""}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: "#666", marginBottom: 4 }}>Agreement details</div>
            <div>
              Fee: <b>{formatINR(Number(contract.annualFee))}</b> / {contract.billingCycle === "YEARLY" ? "year" : contract.billingCycle.toLowerCase()}
            </div>
            <div>
              Term: <b>{fmt(contract.startDate)}</b> to <b>{fmt(contract.endDate)}</b>
            </div>
          </div>
        </div>

        <div style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.65, color: "#1a1a1a" }}>{contract.termsBody}</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginTop: 64 }}>
          <SignatureBlock
            heading="For the School"
            name={contract.signatoryName}
            title={contract.signatoryTitle}
            date={contract.signedDate ? fmt(contract.signedDate) : null}
          />
          <SignatureBlock heading="For Vidya Yati" name={null} title="Authorized Signatory" date={null} />
        </div>
      </div>
    </div>
  );
}

function SignatureBlock({ heading, name, title, date }: { heading: string; name: string | null; title: string | null; date: string | null }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: "#666", marginBottom: 36 }}>{heading}</div>
      <div style={{ borderTop: "1px solid #333", paddingTop: 8, minHeight: 18, fontSize: 13, fontWeight: 600 }}>{name ?? " "}</div>
      <div style={{ fontSize: 11.5, color: "#555", marginTop: 2 }}>
        {title ?? "Signature"}
        {date ? ` · ${date}` : ""}
      </div>
    </div>
  );
}
