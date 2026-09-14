"use client";

import { useRef, useState, useTransition } from "react";
import { deletePersonDocument } from "@/app/app/students/depth-actions";

export type PersonDocumentRow = {
  id: string;
  category: string;
  label: string;
  filePath: string;
  expiryDate: string | null;
  uploadedAt: string;
};

const CATEGORIES = ["ID Proof", "Certificate", "Medical", "Academic", "Other"];

/**
 * Shared document-repository UI for both Students (SIS) and Staff (HR) —
 * same shape either way (see PersonDocument in schema.prisma). `onUpload`
 * is the caller's bound server action (addStudentDocument or
 * addStaffDocument) so this component doesn't need to know which subject
 * type it's attached to.
 */
export default function PersonDocumentsPanel({
  documents,
  redirectPath,
  onUpload,
  onDelete,
  assetUrlBase,
}: {
  documents: PersonDocumentRow[];
  redirectPath: string;
  onUpload: (category: string, formData: FormData) => Promise<void>;
  /** Defaults to the Students/Staff deletePersonDocument (checks Students EDIT) — pass a subject-scoped one (e.g. Transport's deleteVehicleDocument) for any other subject type, so deletion is gated by the right module. */
  onDelete?: (redirectPath: string, id: string) => Promise<void>;
  assetUrlBase: string;
}) {
  const [, startTransition] = useTransition();
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [expiryDate, setExpiryDate] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function pickFile() {
    fileRef.current?.click();
  }

  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);
    if (expiryDate) formData.set("expiryDate", expiryDate);
    startTransition(() => onUpload(category, formData));
    e.target.value = "";
    setExpiryDate("");
  }

  function remove(id: string) {
    startTransition(() => (onDelete ?? deletePersonDocument)(redirectPath, id));
  }

  const isExpiringSoon = (d: string | null) => {
    if (!d) return false;
    const days = (new Date(d).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 30;
  };
  const isExpired = (d: string | null) => !!d && new Date(d).getTime() < Date.now();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
        <div>
          <label style={{ fontSize: 11, color: "var(--muted)" }}>Category</label>
          <select className="in" value={category} onChange={(e) => setCategory(e.target.value)} style={{ display: "block", marginTop: 4 }}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--muted)" }}>Expiry (optional)</label>
          <input className="in" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} style={{ display: "block", marginTop: 4 }} />
        </div>
        <button
          type="button"
          onClick={pickFile}
          style={{ fontSize: 13, fontWeight: 700, color: "#fff", background: "var(--marigold)", border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer" }}
        >
          + Upload document
        </button>
        <input ref={fileRef} type="file" onChange={onFileChosen} style={{ display: "none" }} />
      </div>

      {documents.length === 0 ? (
        <div style={{ color: "var(--muted)", fontSize: 13, padding: "16px 0" }}>No documents uploaded yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {documents.map((d) => (
            <div
              key={d.id}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto auto",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                background: "var(--paper)",
                borderRadius: 8,
                boxShadow: isExpired(d.expiryDate) ? "inset 3px 0 0 var(--critical)" : isExpiringSoon(d.expiryDate) ? "inset 3px 0 0 var(--warn)" : undefined,
              }}
            >
              <span className="pill" style={{ background: "var(--paper)", border: "1px solid var(--line)", fontSize: 11 }}>
                {d.category}
              </span>
              <a href={`${assetUrlBase}/${d.filePath}`} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", textDecoration: "none" }}>
                {d.label}
              </a>
              <span className="mono" style={{ fontSize: 11, color: isExpired(d.expiryDate) ? "var(--critical)" : isExpiringSoon(d.expiryDate) ? "var(--warn)" : "var(--muted)" }}>
                {d.expiryDate ? `${isExpired(d.expiryDate) ? "Expired" : "Expires"} ${new Date(d.expiryDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}` : "No expiry"}
              </span>
              <span onClick={() => remove(d.id)} style={{ fontSize: 11.5, fontWeight: 700, color: "var(--critical)", cursor: "pointer" }}>
                Delete
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
