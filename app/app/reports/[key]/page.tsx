import { notFound } from "next/navigation";
import Link from "next/link";
import { getScopedDb } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { REPORT_KEYS, REPORT_TITLES, getReportData, type ReportKey } from "@/lib/reports";

export default async function ReportDetailPage({ params }: { params: Promise<{ key: string }> }) {
  await requireModuleAccess("Reports", "VIEW");

  const { key } = await params;
  if (!REPORT_KEYS.includes(key as ReportKey)) notFound();
  const reportKey = key as ReportKey;

  const sdb = await getScopedDb();
  const { columns, rows } = await getReportData(reportKey, sdb);

  return (
    <div style={{ padding: "26px 34px", display: "flex", flexDirection: "column", gap: 16, height: "100dvh", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <Link href="/app/reports" style={{ fontSize: 12.5, color: "var(--muted)", textDecoration: "none" }}>
            ← Back to Reports
          </Link>
          <div className="disp" style={{ fontSize: 21, marginTop: 4 }}>
            {REPORT_TITLES[reportKey]} <span className="mono" style={{ fontSize: 14, fontWeight: 500, color: "var(--faint)" }}>· {rows.length} rows</span>
          </div>
        </div>
        <a
          href={`/api/reports/${reportKey}/export`}
          style={{ background: "var(--marigold)", color: "#fff", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, textDecoration: "none" }}
        >
          Download as Excel ↓
        </a>
      </div>

      <div className="card" style={{ padding: 0, flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns.length}, 1fr)`,
            padding: "12px 20px",
            borderBottom: "1px solid var(--line)",
            fontSize: 11,
            color: "var(--faint)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            flex: "none",
          }}
        >
          {columns.map((c) => (
            <div key={c}>{c}</div>
          ))}
        </div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          {rows.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>No data for this report yet.</div>}
          {rows.map((row, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${columns.length}, 1fr)`,
                padding: "10px 20px",
                borderBottom: "1px solid var(--line)",
                fontSize: 12.5,
              }}
            >
              {row.map((cell, j) => (
                <div key={j} className={typeof cell === "number" ? "mono" : undefined}>
                  {cell}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
