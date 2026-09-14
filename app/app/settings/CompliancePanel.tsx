"use client";

import { useRef, useState, useTransition } from "react";
import { updateUdiseFields, uploadComplianceDocument, deleteComplianceDocument, exportUdiseCsv } from "./compliance-actions";

type Doc = { id: string; documentType: string; documentNo: string | null; issuedDate: string | null; expiryDate: string | null; filePath: string | null };

function expiryStyle(dateStr: string | null): { color: string; label: string } | null {
  if (!dateStr) return null;
  const days = (new Date(dateStr).getTime() - Date.now()) / 86400000;
  if (days < 0) return { color: "var(--critical)", label: "Expired" };
  if (days <= 60) return { color: "var(--warn)", label: `${Math.ceil(days)}d left` };
  return { color: "var(--good)", label: "Valid" };
}

export default function CompliancePanel({
  udiseCode,
  affiliationBoard,
  affiliationNumber,
  documents,
}: {
  udiseCode: string | null;
  affiliationBoard: string | null;
  affiliationNumber: string | null;
  documents: Doc[];
}) {
  const [, startTransition] = useTransition();
  const [udise, setUdise] = useState(udiseCode ?? "");
  const [board, setBoard] = useState(affiliationBoard ?? "");
  const [affNo, setAffNo] = useState(affiliationNumber ?? "");
  const [form, setForm] = useState({ documentType: "", documentNo: "", issuedDate: "", expiryDate: "" });
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadPending, startUpload] = useTransition();
  const [exporting, setExporting] = useState(false);

  function saveUdise(nextUdise: string, nextBoard: string, nextAffNo: string) {
    startTransition(() => updateUdiseFields(nextUdise, nextBoard, nextAffNo));
  }

  function submitDocument() {
    if (!form.documentType.trim()) return;
    const fd = new FormData();
    fd.set("documentType", form.documentType);
    fd.set("documentNo", form.documentNo);
    fd.set("issuedDate", form.issuedDate);
    fd.set("expiryDate", form.expiryDate);
    if (fileRef.current?.files?.[0]) fd.set("file", fileRef.current.files[0]);
    startUpload(async () => {
      await uploadComplianceDocument(fd);
      setForm({ documentType: "", documentNo: "", issuedDate: "", expiryDate: "" });
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  async function doExport() {
    setExporting(true);
    try {
      const csv = await exportUdiseCsv();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "udise-export.csv";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 620 }}>
      <div>
        <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 10 }}>
          UDISE+ &amp; affiliation
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <label className="field">
            UDISE+ code
            <input className="in mono" value={udise} onChange={(e) => setUdise(e.target.value)} onBlur={() => saveUdise(udise, board, affNo)} placeholder="29260100109" />
          </label>
          <label className="field">
            Affiliation board
            <input className="in" value={board} onChange={(e) => setBoard(e.target.value)} onBlur={() => saveUdise(udise, board, affNo)} placeholder="CBSE" />
          </label>
        </div>
        <label className="field" style={{ marginTop: 14 }}>
          Affiliation number
          <input className="in mono" value={affNo} onChange={(e) => setAffNo(e.target.value)} onBlur={() => saveUdise(udise, board, affNo)} placeholder="1234567" />
        </label>
        <span onClick={doExport} style={{ display: "inline-block", marginTop: 12, fontSize: 12.5, fontWeight: 700, color: "var(--marigold-deep)", cursor: exporting ? "default" : "pointer" }}>
          {exporting ? "Exporting…" : "Export UDISE+ CSV ↓"}
        </span>
        <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 4 }}>
          A best-effort UDISE+-shaped layout — verify field mapping against the current year's official spec before filing.
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 18 }}>
        <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 10 }}>
          Compliance documents
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {documents.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>No compliance documents on file yet.</div>}
          {documents.map((d) => {
            const style = expiryStyle(d.expiryDate);
            return (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--paper)", borderRadius: 8, padding: "9px 12px", fontSize: 12.5 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {d.documentType} {d.documentNo && <span style={{ color: "var(--muted)", fontWeight: 400 }}>· {d.documentNo}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--faint)" }}>
                    {d.expiryDate ? `Expires ${new Date(d.expiryDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}` : "No expiry set"}
                    {d.filePath && (
                      <>
                        {" · "}
                        <a href={`/api/person-documents/${d.filePath}`} target="_blank" rel="noreferrer" style={{ color: "var(--marigold-deep)", fontWeight: 600 }}>
                          View file ↗
                        </a>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {style && <span style={{ color: style.color, fontWeight: 700, fontSize: 11 }}>{style.label}</span>}
                  <span onClick={() => startTransition(() => deleteComplianceDocument(d.id))} style={{ color: "var(--critical)", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                    Delete
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, border: "1px solid var(--line)", borderRadius: 10, padding: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input className="in" placeholder="Document type (e.g. Affiliation Certificate)" value={form.documentType} onChange={(e) => setForm({ ...form, documentType: e.target.value })} style={{ fontSize: 12.5 }} />
            <input className="in mono" placeholder="Document no." value={form.documentNo} onChange={(e) => setForm({ ...form, documentNo: e.target.value })} style={{ fontSize: 12.5 }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--muted)" }}>
              Issued
              <input className="in mono" type="date" value={form.issuedDate} onChange={(e) => setForm({ ...form, issuedDate: e.target.value })} style={{ flex: 1, fontSize: 11.5 }} />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--muted)" }}>
              Expires
              <input className="in mono" type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} style={{ flex: 1, fontSize: 11.5 }} />
            </label>
          </div>
          <input ref={fileRef} type="file" style={{ fontSize: 12 }} />
          <button
            type="button"
            disabled={uploadPending}
            onClick={submitDocument}
            style={{ alignSelf: "flex-start", background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, fontWeight: 700, cursor: uploadPending ? "default" : "pointer" }}
          >
            {uploadPending ? "Saving…" : "Add document"}
          </button>
        </div>
      </div>
    </div>
  );
}
