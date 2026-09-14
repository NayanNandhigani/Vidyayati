"use client";

import { useRef, useState, useTransition } from "react";
import {
  updateElementBox,
  updateElementText,
  updateElementHref,
  updateElementStyle,
  replaceElementImage,
  addCarouselImages,
  removeCarouselImage,
  deleteElement,
} from "./actions";

export type ElementData = {
  id: string;
  type: "TEXT" | "IMAGE" | "BUTTON" | "IMAGE_CAROUSEL" | "SHAPE";
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  text: string | null;
  href: string | null;
  imagePath: string | null;
  images: string[];
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

// A small curated set that pairs with the design tokens already in use
// elsewhere in the app (Fraunces for display, Plus Jakarta Sans for body,
// IBM Plex Mono for numbers/ids) plus a few reliable system-font fallbacks
// — not an exhaustive Google-Fonts picker, just enough real variety for a
// school site's headings/body/buttons.
export const FONT_FAMILIES = [
  { label: "Plus Jakarta Sans (default)", value: "" },
  { label: "Fraunces (display/serif)", value: "'Fraunces', serif" },
  { label: "IBM Plex Mono", value: "'IBM Plex Mono', monospace" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
];

function assetUrl(path: string) {
  return `/api/website-assets/${path}`;
}

type Box = { x: number; y: number; width: number; height: number };
type DragMode = { kind: "move" } | { kind: "resize"; handle: string };

export default function CanvasElement({
  element,
  code,
  selected,
  onSelect,
}: {
  element: ElementData;
  code: string;
  selected: boolean;
  onSelect: () => void;
}) {
  // Local state only exists WHILE actively dragging/resizing/editing —
  // otherwise this reads straight from the `element` prop. Keeping an
  // always-on local copy synced from props once at mount (useState
  // initializer) is exactly the stale-state bug hit twice already this
  // session (Certificates' GeneratePanel, an Institute select) — a prop
  // update from another action's revalidate would never show up here.
  const [liveBox, setLiveBox] = useState<Box | null>(null);
  const [, startTransition] = useTransition();
  const dragRef = useRef<{ mode: DragMode; startPointer: { x: number; y: number }; startBox: Box } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const carouselInputRef = useRef<HTMLInputElement>(null);

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
      if (h.includes("e")) width = Math.max(30, startBox.width + dx);
      if (h.includes("s")) height = Math.max(20, startBox.height + dy);
      if (h.includes("w")) {
        width = Math.max(30, startBox.width - dx);
        x = startBox.x + startBox.width - width;
      }
      if (h.includes("n")) {
        height = Math.max(20, startBox.height - dy);
        y = startBox.y + startBox.height - height;
      }
      setLiveBox({ x, y, width, height });
    }
  }

  function endDrag() {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || !liveBox) return;
    startTransition(() => updateElementBox(code, element.id, liveBox));
  }

  // Takes the just-blurred text directly from the DOM rather than
  // routing it through a piece of local state — setState() doesn't apply
  // until the next render, so a setState() call earlier in the same
  // event handler would still read stale here (this exact class of bug
  // already bit a couple of other spots this session: reading state
  // immediately after setting it in the same function tick).
  function commitText(newText: string) {
    if (newText !== (element.text ?? "")) {
      startTransition(() => updateElementText(code, element.id, newText));
    }
  }

  function pickImage() {
    fileInputRef.current?.click();
  }

  function onImageChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.set("image", file);
    startTransition(() => replaceElementImage(code, element.id, formData));
  }

  function pickCarouselImages() {
    carouselInputRef.current?.click();
  }

  function onCarouselImagesChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const formData = new FormData();
    for (const file of Array.from(files)) formData.append("images", file);
    startTransition(() => addCarouselImages(code, element.id, formData));
  }

  function removeCarouselPhoto(path: string) {
    startTransition(() => removeCarouselImage(code, element.id, path));
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
          <img src={assetUrl(element.imagePath)} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8, pointerEvents: "none" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "var(--paper)", border: "1px dashed var(--line)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--muted)" }}>
            No image
          </div>
        ))}

      {element.type === "IMAGE_CAROUSEL" && (
        <div style={{ width: "100%", height: "100%", overflow: "hidden", borderRadius: 8, background: "var(--paper)" }}>
          {element.images.length === 0 ? (
            <div style={{ width: "100%", height: "100%", border: "1px dashed var(--line)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--muted)" }}>
              No images yet — add some from the toolbar
            </div>
          ) : (
            <>
              {/* Seamless CSS marquee: render the image list twice back-to-back
                  and animate exactly one copy's width to the left, looping. A
                  unique keyframe name per element avoids collisions when a
                  page has more than one carousel. */}
              <style>{`@keyframes scroll-${element.id} { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
              <div style={{ display: "flex", height: "100%", width: "max-content", animation: `scroll-${element.id} ${Math.max(12, element.images.length * 4)}s linear infinite` }}>
                {[...element.images, ...element.images].map((path, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={assetUrl(path)} alt="" draggable={false} style={{ height: "100%", width: "auto", objectFit: "cover", marginRight: 8, borderRadius: 6, pointerEvents: "none" }} />
                ))}
              </div>
            </>
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
            fontSize: element.fontSize ?? 16,
            color: element.color ?? "var(--ink)",
            background: element.backgroundColor ?? "transparent",
            fontFamily: element.fontFamily || "inherit",
            fontWeight: element.fontWeight ?? 400,
            fontStyle: element.italic ? "italic" : "normal",
            textAlign: (element.textAlign as React.CSSProperties["textAlign"]) ?? "left",
            outline: "none",
            overflow: "hidden",
            padding: element.backgroundColor ? 6 : 0,
            boxSizing: "border-box",
            borderRadius: 6,
            cursor: selected ? "text" : "move",
          }}
        >
          {element.text}
        </div>
      )}

      {element.type === "BUTTON" && (
        <div
          contentEditable={selected}
          suppressContentEditableWarning
          onBlur={(e) => commitText(e.currentTarget.textContent ?? "")}
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: element.textAlign === "left" ? "flex-start" : element.textAlign === "right" ? "flex-end" : "center",
            fontSize: element.fontSize ?? 14,
            fontFamily: element.fontFamily || "inherit",
            fontWeight: element.fontWeight ?? 700,
            fontStyle: element.italic ? "italic" : "normal",
            color: element.color ?? "#fff",
            background: element.backgroundColor ?? "var(--marigold)",
            borderRadius: 10,
            outline: "none",
            cursor: selected ? "text" : "move",
          }}
        >
          {element.text}
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
              top: -44,
              left: 0,
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "var(--ink)",
              padding: "5px 8px",
              borderRadius: 8,
              whiteSpace: "nowrap",
              zIndex: 1000,
            }}
          >
            {(element.type === "TEXT" || element.type === "BUTTON") && (
              <>
                <select
                  value={element.fontFamily ?? ""}
                  onChange={(e) => startTransition(() => updateElementStyle(code, element.id, { fontFamily: e.target.value }))}
                  title="Font"
                  style={{ fontSize: 11, borderRadius: 4, border: "none", padding: "3px 4px", maxWidth: 92 }}
                >
                  {FONT_FAMILIES.map((f) => (
                    <option key={f.label} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <select
                  value={element.fontSize ?? 16}
                  onChange={(e) => startTransition(() => updateElementStyle(code, element.id, { fontSize: Number(e.target.value) }))}
                  title="Font size"
                  style={{ fontSize: 11, borderRadius: 4, border: "none", padding: "3px 4px" }}
                >
                  {[10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64].map((s) => (
                    <option key={s} value={s}>
                      {s}px
                    </option>
                  ))}
                </select>
                <select
                  value={element.fontWeight ?? (element.type === "BUTTON" ? 700 : 400)}
                  onChange={(e) => startTransition(() => updateElementStyle(code, element.id, { fontWeight: Number(e.target.value) }))}
                  title="Font weight"
                  style={{ fontSize: 11, borderRadius: 4, border: "none", padding: "3px 4px" }}
                >
                  {[
                    { v: 400, l: "Regular" },
                    { v: 500, l: "Medium" },
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
                  onClick={() => startTransition(() => updateElementStyle(code, element.id, { italic: !element.italic }))}
                  title="Italic"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontStyle: "italic",
                    fontWeight: 700,
                    fontSize: 12,
                    color: element.italic ? "var(--ink)" : "#fff",
                    background: element.italic ? "#fff" : "rgba(255,255,255,0.15)",
                    cursor: "pointer",
                  }}
                >
                  I
                </span>
                {(["left", "center", "right"] as const).map((align) => (
                  <span
                    key={align}
                    onClick={() => startTransition(() => updateElementStyle(code, element.id, { textAlign: align }))}
                    title={`Align ${align}`}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 4,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 700,
                      color: (element.textAlign ?? "left") === align ? "var(--ink)" : "#fff",
                      background: (element.textAlign ?? "left") === align ? "#fff" : "rgba(255,255,255,0.15)",
                      cursor: "pointer",
                    }}
                  >
                    {align === "left" ? "⯇" : align === "center" ? "≡" : "⯈"}
                  </span>
                ))}
                <input
                  type="color"
                  value={element.color ?? "#17223b"}
                  onChange={(e) => startTransition(() => updateElementStyle(code, element.id, { color: e.target.value }))}
                  title="Text color"
                  style={{ width: 22, height: 22, border: "none", padding: 0, background: "none" }}
                />
              </>
            )}
            {element.type === "TEXT" && (
              <label title="Background color" style={{ display: "flex", alignItems: "center", gap: 2 }}>
                <input
                  type="color"
                  value={element.backgroundColor ?? "#ffffff"}
                  onChange={(e) => startTransition(() => updateElementStyle(code, element.id, { backgroundColor: e.target.value }))}
                  style={{ width: 22, height: 22, border: "none", padding: 0, background: "none" }}
                />
                {element.backgroundColor && (
                  <span
                    onClick={() => startTransition(() => updateElementStyle(code, element.id, { backgroundColor: "" }))}
                    style={{ color: "#ff8a8a", fontSize: 10, cursor: "pointer" }}
                  >
                    clear
                  </span>
                )}
              </label>
            )}
            {element.type === "BUTTON" && (
              <>
                <input
                  type="color"
                  value={element.backgroundColor ?? "#e08a2c"}
                  onChange={(e) => startTransition(() => updateElementStyle(code, element.id, { backgroundColor: e.target.value }))}
                  title="Button color"
                  style={{ width: 22, height: 22, border: "none", padding: 0, background: "none" }}
                />
                <input
                  defaultValue={element.href ?? ""}
                  onBlur={(e) => startTransition(() => updateElementHref(code, element.id, e.target.value))}
                  placeholder="Link (e.g. #contact)"
                  style={{ fontSize: 11, borderRadius: 4, border: "none", padding: "3px 6px", width: 130 }}
                />
              </>
            )}
            {element.type === "SHAPE" && (
              <>
                <select
                  value={element.shapeKind ?? "rectangle"}
                  onChange={(e) => startTransition(() => updateElementStyle(code, element.id, { shapeKind: e.target.value }))}
                  title="Shape"
                  style={{ fontSize: 11, borderRadius: 4, border: "none", padding: "3px 4px" }}
                >
                  <option value="rectangle">Rectangle</option>
                  <option value="circle">Circle</option>
                </select>
                <input
                  type="color"
                  value={element.backgroundColor ?? "#e08a2c"}
                  onChange={(e) => startTransition(() => updateElementStyle(code, element.id, { backgroundColor: e.target.value }))}
                  title="Fill color"
                  style={{ width: 22, height: 22, border: "none", padding: 0, background: "none" }}
                />
                <input
                  type="color"
                  value={element.borderColor ?? "#e08a2c"}
                  onChange={(e) => startTransition(() => updateElementStyle(code, element.id, { borderColor: e.target.value }))}
                  title="Border color"
                  style={{ width: 22, height: 22, border: "none", padding: 0, background: "none" }}
                />
                <select
                  value={element.borderWidth ?? 0}
                  onChange={(e) => startTransition(() => updateElementStyle(code, element.id, { borderWidth: Number(e.target.value) }))}
                  title="Border width"
                  style={{ fontSize: 11, borderRadius: 4, border: "none", padding: "3px 4px" }}
                >
                  {[0, 1, 2, 3, 4, 6, 8].map((w) => (
                    <option key={w} value={w}>
                      Border {w}px
                    </option>
                  ))}
                </select>
                {element.shapeKind !== "circle" && (
                  <select
                    value={element.borderRadius ?? 8}
                    onChange={(e) => startTransition(() => updateElementStyle(code, element.id, { borderRadius: Number(e.target.value) }))}
                    title="Corner radius"
                    style={{ fontSize: 11, borderRadius: 4, border: "none", padding: "3px 4px" }}
                  >
                    {[0, 4, 8, 12, 20, 32, 999].map((r) => (
                      <option key={r} value={r}>
                        {r === 999 ? "Pill" : `Radius ${r}px`}
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}
            {element.type === "IMAGE" && (
              <>
                <span onClick={pickImage} style={{ color: "#fff", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>
                  Replace image
                </span>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={onImageChosen} style={{ display: "none" }} />
              </>
            )}
            {element.type === "IMAGE_CAROUSEL" && (
              <>
                {element.images.map((path) => (
                  <div key={path} style={{ position: "relative", width: 22, height: 22, flex: "none" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={assetUrl(path)} alt="" style={{ width: 22, height: 22, objectFit: "cover", borderRadius: 3 }} />
                    <span
                      onClick={() => removeCarouselPhoto(path)}
                      style={{ position: "absolute", top: -5, right: -5, width: 12, height: 12, borderRadius: "50%", background: "var(--critical)", color: "#fff", fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                    >
                      ×
                    </span>
                  </div>
                ))}
                <span onClick={pickCarouselImages} style={{ color: "#fff", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>
                  + Add images
                </span>
                <input ref={carouselInputRef} type="file" accept="image/*" multiple onChange={onCarouselImagesChosen} style={{ display: "none" }} />
              </>
            )}
            <span
              onClick={() => startTransition(() => deleteElement(code, element.id))}
              style={{ color: "#ff8a8a", fontSize: 11.5, fontWeight: 700, cursor: "pointer", marginLeft: 4 }}
            >
              Delete
            </span>
          </div>
        </>
      )}
    </div>
  );
}
