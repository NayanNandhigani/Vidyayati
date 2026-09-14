"use client";

import { useMemo, useState, useTransition } from "react";
import { BUILDER_ENTITIES, ENTITY_LABELS, ENTITY_COLUMNS, ENTITY_FILTERS, type BuilderEntity, type BuilderFilters, type ReportData } from "@/lib/report-builder";
import { previewCustomReport, exportCustomReportCsv } from "./builder-actions";

export default function ReportBuilderPanel({ classes }: { classes: { id: string; label: string }[] }) {
  const [entity, setEntity] = useState<BuilderEntity>("students");
  const [selectedColumns, setSelectedColumns] = useState<string[]>(ENTITY_COLUMNS.students.map((c) => c.key));
  const [filters, setFilters] = useState<BuilderFilters>({});
  const [preview, setPreview] = useState<ReportData | null>(null);
  const [pending, startTransition] = useTransition();
  const [exporting, setExporting] = useState(false);

  const columns = ENTITY_COLUMNS[entity];
  const filterDefs = ENTITY_FILTERS[entity];

  function changeEntity(next: BuilderEntity) {
    setEntity(next);
    setSelectedColumns(ENTITY_COLUMNS[next].map((c) => c.key));
    setFilters({});
    setPreview(null);
  }

  function toggleColumn(key: string) {
    setSelectedColumns((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function runPreview() {
    startTransition(async () => {
      const data = await previewCustomReport(entity, selectedColumns, filters);
      setPreview(data);
    });
  }

  async function doExport() {
    setExporting(true);
    try {
      const csv = await exportCustomReportCsv(entity, selectedColumns, filters);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${entity}-report.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const hasDateRange = useMemo(() => filterDefs.some((f) => f.type === "dateRange"), [filterDefs]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 8 }}>
          1. Choose an entity
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {BUILDER_ENTITIES.map((e) => (
            <span
              key={e}
              onClick={() => changeEntity(e)}
              className="pill"
              style={{ cursor: "pointer", background: entity === e ? "var(--marigold)" : "var(--card)", color: entity === e ? "#fff" : "var(--ink2)", border: "1px solid var(--line)" }}
            >
              {ENTITY_LABELS[e]}
            </span>
          ))}
        </div>
      </div>

      <div>
        <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 8 }}>
          2. Filters
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          {filterDefs.map((f) => {
            if (f.type === "class") {
              return (
                <label key={f.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
                  {f.label}
                  <select className="in" value={filters.classId ?? ""} onChange={(e) => setFilters({ ...filters, classId: e.target.value || undefined })} style={{ fontSize: 12 }}>
                    <option value="">All classes</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
              );
            }
            if (f.type === "select") {
              const value = f.key === "status" ? filters.status : f.key === "gender" ? filters.gender : filters.employmentStatus;
              return (
                <label key={f.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
                  {f.label}
                  <select
                    className="in"
                    value={value ?? ""}
                    onChange={(e) => setFilters({ ...filters, [f.key]: e.target.value || undefined })}
                    style={{ fontSize: 12 }}
                  >
                    <option value="">All</option>
                    {f.options?.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
              );
            }
            return null;
          })}
          {hasDateRange && (
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
              Date range
              <input className="in mono" type="date" value={filters.dateFrom ?? ""} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value || undefined })} style={{ fontSize: 12 }} />
              –
              <input className="in mono" type="date" value={filters.dateTo ?? ""} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value || undefined })} style={{ fontSize: 12 }} />
            </label>
          )}
        </div>
      </div>

      <div>
        <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 8 }}>
          3. Columns
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {columns.map((c) => (
            <label key={c.key} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5 }}>
              <input type="checkbox" checked={selectedColumns.includes(c.key)} onChange={() => toggleColumn(c.key)} />
              {c.label}
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="button"
          disabled={pending || selectedColumns.length === 0}
          onClick={runPreview}
          style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, color: "var(--ink)", cursor: pending ? "default" : "pointer" }}
        >
          {pending ? "Running…" : "Preview"}
        </button>
        <button
          type="button"
          disabled={exporting || selectedColumns.length === 0}
          onClick={doExport}
          style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: exporting ? "default" : "pointer" }}
        >
          {exporting ? "Exporting…" : "Export CSV ↓"}
        </button>
      </div>

      {preview && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "10px 16px", fontSize: 11.5, color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
            Preview — first {preview.rows.length} row{preview.rows.length === 1 ? "" : "s"} (export includes every matching row)
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr>
                  {preview.columns.map((c) => (
                    <th key={c} style={{ textAlign: "left", padding: "8px 14px", borderBottom: "1px solid var(--line)", color: "var(--faint)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.length === 0 ? (
                  <tr>
                    <td colSpan={preview.columns.length} style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>
                      No matching rows.
                    </td>
                  </tr>
                ) : (
                  preview.rows.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j} style={{ padding: "7px 14px", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
