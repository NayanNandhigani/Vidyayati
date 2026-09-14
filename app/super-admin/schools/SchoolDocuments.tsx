"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { IconPaperclip } from "@/components/icons";
import { uploadSchoolDocument, deleteSchoolDocument, type ManageFormState } from "./actions";

const CATEGORY_LABEL: Record<string, string> = {
  CONTRACT: "Contract",
  REGISTRATION: "Registration",
  ID_PROOF: "ID proof",
  OTHER: "Other",
};

export type SchoolDocumentRow = {
  id: string;
  name: string;
  category: "CONTRACT" | "REGISTRATION" | "ID_PROOF" | "OTHER";
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedByName: string | null;
};

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const initialState: ManageFormState = {};

export default function SchoolDocuments({ schoolId, documents, canManage }: { schoolId: string; documents: SchoolDocumentRow[]; canManage: boolean }) {
  const [state, formAction, pending] = useActionState(uploadSchoolDocument, initialState);
  const [showForm, setShowForm] = useState(false);
  const [deletePending, startDelete] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      setShowForm(false);
    }
  }, [state.success]);

  function remove(id: string) {
    if (!confirm("Delete this document? This can't be undone.")) return;
    startDelete(async () => {
      await deleteSchoolDocument(id);
    });
  }

  return (
    <div>
      {documents.length === 0 && !showForm && <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>No documents attached yet.</div>}

      {documents.map((d) => (
        <div key={d.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--line)" }}>
          <a href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0, textDecoration: "none", color: "inherit" }}>
            <IconPaperclip style={{ width: 15, height: 15, color: "var(--muted)", flex: "none" }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
              <div style={{ fontSize: 10.5, color: "var(--faint)" }}>
                {CATEGORY_LABEL[d.category]} · {formatSize(d.sizeBytes)} · {new Date(d.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              </div>
            </div>
          </a>
          {canManage && (
            <button onClick={() => remove(d.id)} disabled={deletePending} style={{ background: "none", border: "none", color: "var(--critical)", fontSize: 11.5, fontWeight: 600, cursor: deletePending ? "default" : "pointer", flex: "none", marginLeft: 8 }}>
              Delete
            </button>
          )}
        </div>
      ))}

      {canManage && (
        <>
          {!showForm ? (
            <button onClick={() => setShowForm(true)} style={{ marginTop: 10, background: "var(--paper)", border: "1px dashed var(--line)", borderRadius: 8, padding: "9px 0", width: "100%", fontSize: 12.5, fontWeight: 600, color: "var(--marigold-deep)", cursor: "pointer" }}>
              + Attach a document
            </button>
          ) : (
            <form ref={formRef} action={formAction} style={{ marginTop: 10, background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 9 }}>
              <input type="hidden" name="schoolId" value={schoolId} />
              <div className="field" style={{ gap: 8 }}>
                <input className="in" name="name" placeholder="Document name (optional)" style={{ fontSize: 12.5 }} />
                <select className="in" name="category" defaultValue="CONTRACT" style={{ fontSize: 12.5 }}>
                  <option value="CONTRACT">Contract</option>
                  <option value="REGISTRATION">Registration</option>
                  <option value="ID_PROOF">ID proof</option>
                  <option value="OTHER">Other</option>
                </select>
                <input className="in" type="file" name="file" required style={{ fontSize: 12 }} />
              </div>
              {state.error && <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--critical)" }}>{state.error}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" disabled={pending} style={{ flex: 1, background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 0", fontSize: 12.5, fontWeight: 700, cursor: pending ? "default" : "pointer" }}>
                  {pending ? "Uploading…" : "Upload"}
                </button>
                <button type="button" onClick={() => setShowForm(false)} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
