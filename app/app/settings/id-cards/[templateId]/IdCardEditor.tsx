"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { IdCardAudience, IdCardOrientation, IdCardElementType } from "@prisma/client";
import { CARD_SIZE, type MergeField } from "@/lib/id-cards";
import {
  addIdCardElement,
  renameTemplate,
  updateTemplateBackground,
  updateTemplateOrientation,
  getStudentCardContext,
  getStaffCardContext,
  setStudentPhoto,
  setStaffPhoto,
} from "../../id-card-actions";
import IdCardElement, { type IdCardElementData } from "./IdCardElement";

type PreviewPerson = { id: string; label: string };

export default function IdCardEditor({
  templateId,
  audience,
  initialName,
  orientation,
  backgroundColor,
  elements,
  mergeFields,
  sampleCtx,
  previewPeople,
}: {
  templateId: string;
  audience: IdCardAudience;
  initialName: string;
  orientation: IdCardOrientation;
  backgroundColor: string | null;
  elements: IdCardElementData[];
  mergeFields: MergeField[];
  sampleCtx: Record<string, string>;
  previewPeople: PreviewPerson[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [name, setName] = useState(initialName);
  const [previewId, setPreviewId] = useState<string>("");
  const [previewCtx, setPreviewCtx] = useState<Record<string, string> | null>(null);
  const [previewPhotoPath, setPreviewPhotoPath] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const size = CARD_SIZE[orientation];
  const mergeCtx = previewCtx ?? sampleCtx;
  const photoUrl = previewPhotoPath ? `/api/id-card-assets/${previewPhotoPath}` : null;
  const fields = mergeFields.map((f) => ({ token: f.token, label: f.label }));

  function add(type: IdCardElementType) {
    startTransition(() => addIdCardElement(templateId, type, { x: 24, y: 24 }));
  }

  function onSelectPreview(id: string) {
    setPreviewId(id);
    setSelectedId(null);
    if (!id) {
      setPreviewCtx(null);
      setPreviewPhotoPath(null);
      return;
    }
    setLoadingPreview(true);
    const fetcher = audience === "STAFF" ? getStaffCardContext : getStudentCardContext;
    fetcher(id).then((result) => {
      setPreviewCtx(result.ctx);
      setPreviewPhotoPath(result.photoPath);
      setLoadingPreview(false);
    });
  }

  function onPhotoChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !previewId) return;
    const formData = new FormData();
    formData.set("photo", file);
    setLoadingPreview(true);
    const setter = audience === "STAFF" ? setStaffPhoto : setStudentPhoto;
    setter(previewId, formData).then(() => onSelectPreview(previewId));
  }

  return (
    <div style={{ background: "#f4f5f7", minHeight: "100dvh" }}>
      <header style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 24px", background: "#fff", borderBottom: "1px solid var(--line)", position: "sticky", top: 0, zIndex: 500 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <Link href="/app/settings?panel=idcards" style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", textDecoration: "none" }}>
            ← Back
          </Link>
          <input
            defaultValue={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={(e) => startTransition(() => renameTemplate(templateId, e.target.value))}
            className="disp"
            style={{ fontSize: 16, border: "none", background: "transparent", outline: "none", width: 220 }}
          />
          <select
            value={orientation}
            onChange={(e) => startTransition(() => updateTemplateOrientation(templateId, e.target.value as IdCardOrientation))}
            style={{ fontSize: 12, borderRadius: 6, border: "1px solid var(--line)", padding: "5px 8px" }}
          >
            <option value="HORIZONTAL">Horizontal</option>
            <option value="VERTICAL">Vertical</option>
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
            Background
            <input
              type="color"
              value={backgroundColor ?? "#e08a2c"}
              onChange={(e) => startTransition(() => updateTemplateBackground(templateId, e.target.value))}
              style={{ width: 26, height: 26, border: "1px solid var(--line)", padding: 0 }}
            />
          </label>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <span onClick={() => add("TEXT" as IdCardElementType)} style={{ fontSize: 13, fontWeight: 700, color: "var(--marigold-deep)", cursor: "pointer" }}>
            + Text
          </span>
          <span onClick={() => add("PHOTO" as IdCardElementType)} style={{ fontSize: 13, fontWeight: 700, color: "var(--marigold-deep)", cursor: "pointer" }}>
            + Photo slot
          </span>
          <span onClick={() => add("IMAGE" as IdCardElementType)} style={{ fontSize: 13, fontWeight: 700, color: "var(--marigold-deep)", cursor: "pointer" }}>
            + Image
          </span>
          <span onClick={() => add("SHAPE" as IdCardElementType)} style={{ fontSize: 13, fontWeight: 700, color: "var(--marigold-deep)", cursor: "pointer" }}>
            + Shape
          </span>
          <span onClick={() => add("BARCODE" as IdCardElementType)} style={{ fontSize: 13, fontWeight: 700, color: "var(--marigold-deep)", cursor: "pointer" }}>
            + QR/Barcode
          </span>
        </div>
      </header>

      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 24px", background: "#fff", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Preview as:</span>
        <select value={previewId} onChange={(e) => onSelectPreview(e.target.value)} style={{ fontSize: 12, borderRadius: 6, border: "1px solid var(--line)", padding: "5px 8px", maxWidth: 280 }}>
          <option value="">Sample data</option>
          {previewPeople.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        {loadingPreview && <span style={{ fontSize: 11.5, color: "var(--muted)" }}>Loading…</span>}
        {previewId && !loadingPreview && (
          <>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--marigold-deep)", cursor: "pointer" }}>
              {previewPhotoPath ? "Replace their photo" : "Set their photo"}
              <input type="file" accept="image/*" onChange={onPhotoChosen} style={{ display: "none" }} />
            </label>
            <span onClick={() => window.print()} style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", cursor: "pointer" }}>
              Print this card
            </span>
          </>
        )}
      </div>

      <div style={{ padding: "32px 0", display: "flex", justifyContent: "center" }}>
        <div
          id="id-card-printable"
          onClick={() => setSelectedId(null)}
          style={{
            position: "relative",
            width: size.width,
            height: size.height,
            background: backgroundColor ?? "#e08a2c",
            borderRadius: 14,
            boxShadow: "0 0 0 1px var(--line), 0 12px 40px rgba(0,0,0,0.12)",
            overflow: "hidden",
          }}
        >
          {elements.map((el) => (
            <IdCardElement
              key={el.id}
              element={el}
              templateId={templateId}
              mergeCtx={mergeCtx}
              photoUrl={el.type === "PHOTO" ? photoUrl : null}
              fields={fields}
              selected={selectedId === el.id}
              onSelect={() => setSelectedId(el.id)}
            />
          ))}
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #id-card-printable, #id-card-printable * { visibility: visible; }
          #id-card-printable { position: fixed; top: 20px; left: 20px; box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}
