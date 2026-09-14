"use client";

import { useActionState, useState, useTransition } from "react";
import {
  updateCertificateTemplate,
  removeCertificateTemplateLogo,
  createCustomCertificateTemplate,
  deleteCertificateTemplate,
  type FormState,
} from "../certificates/actions";

type Template = {
  id: string;
  type: string;
  label: string;
  title: string;
  bodyText: string;
  logoPath: string | null;
  issuedCount: number;
};

const initialState: FormState = {};

function assetUrl(path: string) {
  return `/api/certificate-assets/${path}`;
}

export default function CertificateBuilderPanel({ templates }: { templates: Template[] }) {
  const [showForm, setShowForm] = useState(false);
  const [state, formAction, pending] = useActionState(createCustomCertificateTemplate, initialState);

  return (
    <div style={{ maxWidth: 720, width: "100%" }}>
      <div style={{ marginBottom: 16 }}>
        <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 2 }}>
          Document Editor
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>
          Edit the wording and logo of every certificate — including the 4 built-in ones — or add an entirely
          custom certificate. Every printed certificate is always A4-sized. Changes here show up immediately in
          the Certificate Generator.
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {templates.map((t) => (
          <TemplateCard key={t.id} template={t} />
        ))}
      </div>

      {showForm ? (
        <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 12, border: "1px solid var(--line)", borderRadius: 10, padding: 16 }}>
          <label className="field">
            Certificate name
            <input className="in" name="label" placeholder="e.g. Sports Excellence Certificate" required />
          </label>
          {state.error && <div style={{ color: "var(--critical)", fontSize: 12.5 }}>{state.error}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" disabled={pending} style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              {pending ? "Adding…" : "Add certificate"}
            </button>
            <span onClick={() => setShowForm(false)} style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", cursor: "pointer", padding: "8px 4px" }}>
              Cancel
            </span>
          </div>
        </form>
      ) : (
        <span onClick={() => setShowForm(true)} style={{ display: "inline-block", fontSize: 13, fontWeight: 600, color: "var(--marigold-deep)", cursor: "pointer" }}>
          + Add custom certificate
        </span>
      )}
    </div>
  );
}

function TemplateCard({ template }: { template: Template }) {
  const [expanded, setExpanded] = useState(false);
  const [state, formAction, pending] = useActionState(updateCertificateTemplate, initialState);
  const [, startTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function removeLogo() {
    startTransition(() => removeCertificateTemplateLogo(template.id));
  }

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteCertificateTemplate(template.id);
      setDeleteError(res.error ?? null);
    });
  }

  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>{template.label}</div>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 2 }}>
            {template.issuedCount} issued{template.type === "CUSTOM" ? " · Custom" : ""}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span onClick={() => setExpanded((v) => !v)} style={{ fontSize: 12, fontWeight: 600, color: "var(--marigold-deep)", cursor: "pointer" }}>
            {expanded ? "Close" : "Edit"}
          </span>
          <span onClick={handleDelete} style={{ fontSize: 12, fontWeight: 600, color: "var(--critical)", cursor: "pointer" }}>
            Delete
          </span>
        </div>
      </div>
      {deleteError && <div style={{ color: "var(--critical)", fontSize: 12, padding: "0 16px 10px" }}>{deleteError}</div>}

      {expanded && (
        <form action={formAction} style={{ borderTop: "1px solid var(--line)", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <input type="hidden" name="id" value={template.id} />

          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 9 }}>Logo</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {template.logoPath ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={assetUrl(template.logoPath)} alt="" style={{ width: 40, height: 40, objectFit: "contain", borderRadius: 6, border: "1px solid var(--line)" }} />
                  <span onClick={removeLogo} style={{ fontSize: 11.5, fontWeight: 600, color: "var(--critical)", cursor: "pointer" }}>
                    Remove
                  </span>
                </>
              ) : (
                <div style={{ width: 40, height: 40, borderRadius: 6, background: "var(--paper)", border: "1px dashed var(--line)" }} />
              )}
              <input type="file" name="logo" accept="image/*" style={{ fontSize: 12, flex: 1 }} />
            </div>
          </div>

          <label className="field">
            Label (shown in the generator list)
            <input className="in" name="label" defaultValue={template.label} required />
          </label>
          <label className="field">
            Printed title
            <input className="in" name="title" defaultValue={template.title} required />
          </label>
          <label className="field">
            Certificate text
            <textarea
              className="in"
              name="bodyText"
              defaultValue={template.bodyText}
              rows={6}
              style={{ resize: "vertical", fontFamily: "inherit" }}
              required
            />
            <span style={{ fontSize: 11, color: "var(--faint)", marginTop: 4 }}>
              Merge fields: {"{{name}} {{admissionNo}} {{school}} {{class}} {{year}} {{pronoun}} {{possessive}}"}
            </span>
          </label>

          {state.error && <div style={{ color: "var(--critical)", fontSize: 12.5 }}>{state.error}</div>}
          <button
            type="submit"
            disabled={pending}
            style={{ alignSelf: "flex-start", background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            {pending ? "Saving…" : state.success ? "Saved ✓" : "Save changes"}
          </button>
        </form>
      )}
    </div>
  );
}
