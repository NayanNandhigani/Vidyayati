"use client";

import { useRef, useState, useTransition } from "react";
import type { IdCardElementType } from "@prisma/client";
import { renderIdCardText } from "@/lib/id-cards";
import {
  updateIdCardElementBox,
  updateIdCardElementText,
  updateIdCardElementStyle,
  replaceIdCardElementImage,
  deleteIdCardElement,
} from "../../id-card-actions";
import { FONT_FAMILIES } from "./shared";

export type IdCardElementData = {
  id: string;
  type: IdCardElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string | null;
  imagePath: string | null;
  fontSize: number | null;
  fontFamily: string | null;
  fontWeight: number | null;
  italic: boolean;
  textAlign: string | null;
  color: string | null;
  backgroundColor: string | null;
  shapeKind: string | null;
  borderColor: string | null;
  borderWidth: number | null;
  borderRadius: number | null;
};

function assetUrl(path: string) {
  return `/api/id-card-assets/${path}`;
}

type Box = { x: number; y: number; width: number; height: number };
type DragMode = { kind: "move" } | { kind: "resize"; handle: string };

export default function IdCardElement({
  element,
  templateId,
  mergeCtx,
  photoUrl,
  fields,
  selected,
  onSelect,
}: {
  element: IdCardElementData;
  templateId: string;
  mergeCtx: Record<string, string>;
  photoUrl: string | null;
  fields: { token: string; label: string }[];
  selected: boolean;
  onSelect: () => void;
}) {
  const [liveBox, setLiveBox] = useState<Box | null>(null);
  const [, startTransition] = useTransition();
  const dragRef = useRef<{ mode: DragMode; startPointer: { x: number; y: number }; startBox: Box } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const box = liveBox ?? { x: element.x, y: element.y, width: element.width, height: element.height };

  function beginDrag(e: React.PointerEvent, mode: DragMode) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    onSelect();
    dragRef.current = { mode, startPointer: { x: e.clientX, y: e.clientY }, startBox: box };
    setLiveBox(box);
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startPointer.x;
    const dy = e.clientY - drag.startPointer.y;
    const { startBox, mode } = drag;

    if (mode.kind === "move") {
      setLiveBox({ ...startBox, x: Math.max(0, startBox.x + dx), y: Math.max(0, startBox.y + dy) });
    } else {
      let { x, y, width, height } = startBox;
      const h = mode.handle;
      if (h.includes("e")) width = Math.max(16, startBox.width + dx);
      if (h.includes("s")) height = Math.max(16, startBox.height + dy);
      if (h.includes("w")) {
        width = Math.max(16, startBox.width - dx);
        x = startBox.x + startBox.width - width;
      }
      if (h.includes("n")) {
        height = Math.max(16, startBox.height - dy);
        y = startBox.y + startBox.height - height;
      }
      setLiveBox({ x, y, width, height });
    }
  }

  function endDrag() {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || !liveBox) return;
    startTransition(() => updateIdCardElementBox(templateId, element.id, liveBox));
  }

  function commitText(newText: string) {
    if (newText !== (element.text ?? "")) {
      startTransition(() => updateIdCardElementText(templateId, element.id, newText));
    }
  }

  function insertField(token: string) {
    commitText(`${element.text ?? ""}${token}`);
  }

  function pickImage() {
    fileInputRef.current?.click();
  }

  function onImageChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.set("image", file);
    startTransition(() => replaceIdCardElementImage(templateId, element.id, formData));
  }

  const handles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

  return (
    <div
      style={{ position: "absolute", left: box.x, top: box.y, width: box.width, height: box.height, cursor: "move" }}
      onPointerDown={(e) => beginDrag(e, { kind: "move" })}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {element.type === "IMAGE" &&
        (element.imagePath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={assetUrl(element.imagePath)} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "rgba(255,255,255,.5)", border: "1px dashed var(--line)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "var(--muted)" }}>
            Image
          </div>
        ))}

      {element.type === "PHOTO" && (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: element.backgroundColor ?? "#e2e8f0",
            border: element.borderWidth ? `${element.borderWidth}px solid ${element.borderColor ?? "#94765a"}` : "1px solid rgba(0,0,0,0.1)",
            borderRadius: element.shapeKind === "circle" ? "50%" : element.borderRadius ?? 8,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} />
          ) : (
            <span style={{ fontSize: 10, color: "var(--muted)" }}>Photo</span>
          )}
        </div>
      )}

      {element.type === "TEXT" && (
        <div
          contentEditable={selected}
          suppressContentEditableWarning
          onBlur={(e) => commitText(e.currentTarget.textContent ?? "")}
          style={{
            width: "100%",
            height: "100%",
            fontSize: element.fontSize ?? 12,
            color: element.color ?? "var(--ink)",
            background: element.backgroundColor || "transparent",
            fontFamily: element.fontFamily || "inherit",
            fontWeight: element.fontWeight ?? 400,
            fontStyle: element.italic ? "italic" : "normal",
            textAlign: (element.textAlign as React.CSSProperties["textAlign"]) ?? "left",
            outline: "none",
            overflow: "hidden",
            padding: element.backgroundColor ? 3 : 0,
            boxSizing: "border-box",
            borderRadius: 4,
            cursor: selected ? "text" : "move",
            whiteSpace: "pre-wrap",
          }}
        >
          {selected ? element.text : renderIdCardText(element.text ?? "", mergeCtx)}
        </div>
      )}

      {element.type === "SHAPE" && (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: element.backgroundColor ?? "#e08a2c",
            border: element.borderWidth ? `${element.borderWidth}px solid ${element.borderColor ?? "#e08a2c"}` : "none",
            borderRadius: element.shapeKind === "circle" ? "50%" : element.borderRadius ?? 8,
          }}
        />
      )}

      {element.type === "BARCODE" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/qrcode?data=${encodeURIComponent(renderIdCardText(element.text || "{{admissionNo}}", mergeCtx))}`}
          alt=""
          draggable={false}
          style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none", background: "#fff", borderRadius: 4 }}
        />
      )}

      {selected && (
        <>
          <div style={{ position: "absolute", inset: -2, border: "1.5px solid var(--marigold)", borderRadius: 6, pointerEvents: "none" }} />
          {handles.map((h) => (
            <div
              key={h}
              onPointerDown={(e) => beginDrag(e, { kind: "resize", handle: h })}
              style={{
                position: "absolute",
                width: 9,
                height: 9,
                background: "#fff",
                border: "1.5px solid var(--marigold)",
                borderRadius: 2,
                cursor: `${h}-resize`,
                top: h.includes("n") ? -5 : h.includes("s") ? undefined : "50%",
                bottom: h.includes("s") ? -5 : undefined,
                left: h.includes("w") ? -5 : h.includes("e") ? undefined : "50%",
                right: h.includes("e") ? -5 : undefined,
                transform: `${!h.includes("n") && !h.includes("s") ? "translateY(-50%)" : ""} ${!h.includes("w") && !h.includes("e") ? "translateX(-50%)" : ""}`,
              }}
            />
          ))}

          <div
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              top: -40,
              left: 0,
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: "var(--ink)",
              padding: "5px 7px",
              borderRadius: 8,
              whiteSpace: "nowrap",
              zIndex: 1000,
            }}
          >
            {element.type === "TEXT" && (
              <>
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) insertField(e.target.value);
                    e.target.value = "";
                  }}
                  title="Insert merge field"
                  style={{ fontSize: 10.5, borderRadius: 4, border: "none", padding: "3px 4px", maxWidth: 90 }}
                >
                  <option value="">+ Field</option>
                  {fields.map((f) => (
                    <option key={f.token} value={f.token}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <select
                  value={element.fontFamily ?? ""}
                  onChange={(e) => startTransition(() => updateIdCardElementStyle(templateId, element.id, { fontFamily: e.target.value }))}
                  title="Font"
                  style={{ fontSize: 10.5, borderRadius: 4, border: "none", padding: "3px 4px", maxWidth: 80 }}
                >
                  {FONT_FAMILIES.map((f) => (
                    <option key={f.label} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <select
                  value={element.fontSize ?? 12}
                  onChange={(e) => startTransition(() => updateIdCardElementStyle(templateId, element.id, { fontSize: Number(e.target.value) }))}
                  title="Size"
                  style={{ fontSize: 10.5, borderRadius: 4, border: "none", padding: "3px 4px" }}
                >
                  {[8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28].map((s) => (
                    <option key={s} value={s}>
                      {s}px
                    </option>
                  ))}
                </select>
                <select
                  value={element.fontWeight ?? 400}
                  onChange={(e) => startTransition(() => updateIdCardElementStyle(templateId, element.id, { fontWeight: Number(e.target.value) }))}
                  title="Weight"
                  style={{ fontSize: 10.5, borderRadius: 4, border: "none", padding: "3px 4px" }}
                >
                  {[
                    { v: 400, l: "Regular" },
                    { v: 600, l: "Semibold" },
                    { v: 700, l: "Bold" },
                    { v: 800, l: "Extrabold" },
                  ].map((w) => (
                    <option key={w.v} value={w.v}>
                      {w.l}
                    </option>
                  ))}
                </select>
                <span
                  onClick={() => startTransition(() => updateIdCardElementStyle(templateId, element.id, { italic: !element.italic }))}
                  title="Italic"
                  style={{ width: 20, height: 20, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontStyle: "italic", fontWeight: 700, fontSize: 11, color: element.italic ? "var(--ink)" : "#fff", background: element.italic ? "#fff" : "rgba(255,255,255,0.15)", cursor: "pointer" }}
                >
                  I
                </span>
                {(["left", "center", "right"] as const).map((align) => (
                  <span
                    key={align}
                    onClick={() => startTransition(() => updateIdCardElementStyle(templateId, element.id, { textAlign: align }))}
                    title={`Align ${align}`}
                    style={{ width: 20, height: 20, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: (element.textAlign ?? "left") === align ? "var(--ink)" : "#fff", background: (element.textAlign ?? "left") === align ? "#fff" : "rgba(255,255,255,0.15)", cursor: "pointer" }}
                  >
                    {align === "left" ? "⯇" : align === "center" ? "≡" : "⯈"}
                  </span>
                ))}
                <input
                  type="color"
                  value={element.color ?? "#17223b"}
                  onChange={(e) => startTransition(() => updateIdCardElementStyle(templateId, element.id, { color: e.target.value }))}
                  title="Text color"
                  style={{ width: 20, height: 20, border: "none", padding: 0, background: "none" }}
                />
                <input
                  type="color"
                  value={element.backgroundColor || "#ffffff"}
                  onChange={(e) => startTransition(() => updateIdCardElementStyle(templateId, element.id, { backgroundColor: e.target.value }))}
                  title="Background color"
                  style={{ width: 20, height: 20, border: "none", padding: 0, background: "none" }}
                />
              </>
            )}
            {element.type === "IMAGE" && (
              <>
                <span onClick={pickImage} style={{ color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  Replace image
                </span>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={onImageChosen} style={{ display: "none" }} />
              </>
            )}
            {element.type === "BARCODE" && (
              <select
                value={element.text ?? "{{admissionNo}}"}
                onChange={(e) => commitText(e.target.value)}
                title="Field encoded in the QR code"
                style={{ fontSize: 10.5, borderRadius: 4, border: "none", padding: "3px 4px", maxWidth: 140 }}
              >
                {fields.map((f) => (
                  <option key={f.token} value={f.token}>
                    {f.label}
                  </option>
                ))}
              </select>
            )}
            {(element.type === "SHAPE" || element.type === "PHOTO") && (
              <>
                <select
                  value={element.shapeKind ?? "rectangle"}
                  onChange={(e) => startTransition(() => updateIdCardElementStyle(templateId, element.id, { shapeKind: e.target.value }))}
                  title="Shape"
                  style={{ fontSize: 10.5, borderRadius: 4, border: "none", padding: "3px 4px" }}
                >
                  <option value="rectangle">Rectangle</option>
                  <option value="circle">Circle</option>
                </select>
                <input
                  type="color"
                  value={element.backgroundColor ?? "#e08a2c"}
                  onChange={(e) => startTransition(() => updateIdCardElementStyle(templateId, element.id, { backgroundColor: e.target.value }))}
                  title="Fill color"
                  style={{ width: 20, height: 20, border: "none", padding: 0, background: "none" }}
                />
                <input
                  type="color"
                  value={element.borderColor ?? "#94765a"}
                  onChange={(e) => startTransition(() => updateIdCardElementStyle(templateId, element.id, { borderColor: e.target.value }))}
                  title="Border color"
                  style={{ width: 20, height: 20, border: "none", padding: 0, background: "none" }}
                />
                <select
                  value={element.borderWidth ?? 0}
                  onChange={(e) => startTransition(() => updateIdCardElementStyle(templateId, element.id, { borderWidth: Number(e.target.value) }))}
                  title="Border width"
                  style={{ fontSize: 10.5, borderRadius: 4, border: "none", padding: "3px 4px" }}
                >
                  {[0, 1, 2, 3, 4].map((w) => (
                    <option key={w} value={w}>
                      Border {w}px
                    </option>
                  ))}
                </select>
              </>
            )}
            <span
              onClick={() => startTransition(() => deleteIdCardElement(templateId, element.id))}
              style={{ color: "#ff8a8a", fontSize: 11, fontWeight: 700, cursor: "pointer", marginLeft: 3 }}
            >
              Delete
            </span>
          </div>
        </>
      )}
    </div>
  );
}
