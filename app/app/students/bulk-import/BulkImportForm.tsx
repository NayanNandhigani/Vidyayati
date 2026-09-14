"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { bulkImportStudents, type BulkImportResult } from "../bulk-import-actions";

export default function BulkImportForm() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<BulkImportResult | null>(null);

  function submit() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setResult(null);
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const res = await bulkImportStudents(fd);
      setResult(res);
      if (res.createdCount) {
        setFileName(null);
        if (fileRef.current) fileRef.current.value = "";
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, padding: "14px 16px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>1. Download the template</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>
          An Excel file with every field a student record supports, one example row, and a second sheet listing your school's valid class names.
        </div>
        <a
          href="/api/students/import-template"
          style={{ display: "inline-block", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 15px", fontSize: 12.5, fontWeight: 700, color: "var(--marigold-deep)", textDecoration: "none" }}
        >
          Download template ↓
        </a>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>2. Upload the filled-in file</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            style={{ fontSize: 12.5 }}
          />
        </div>
      </div>

      {result?.error && (
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--critical)", background: "var(--critical-tint)", border: "1px solid var(--critical-border)", borderRadius: 8, padding: "10px 13px" }}>
          <div>{result.error}</div>
          {result.rowErrors && result.rowErrors.length > 0 && (
            <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontWeight: 500 }}>
              {result.rowErrors.slice(0, 20).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
              {result.rowErrors.length > 20 && <li>…and {result.rowErrors.length - 20} more.</li>}
            </ul>
          )}
        </div>
      )}

      {result?.createdCount != null && (
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--good)", background: "var(--good-tint)", border: "1px solid var(--good-border, var(--line))", borderRadius: 8, padding: "10px 13px" }}>
          Imported {result.createdCount} student{result.createdCount === 1 ? "" : "s"} successfully.
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="button"
          disabled={pending || !fileName}
          onClick={submit}
          style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13.5, fontWeight: 700, cursor: pending ? "default" : "pointer", opacity: pending || !fileName ? 0.6 : 1 }}
        >
          {pending ? "Importing…" : "Import students"}
        </button>
        <Link href="/app/students" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "9px 18px", fontSize: 13.5, fontWeight: 600, textDecoration: "none", color: "var(--ink)" }}>
          Back to Students
        </Link>
      </div>
    </div>
  );
}
