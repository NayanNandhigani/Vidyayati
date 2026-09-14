"use client";

import { useState, useTransition } from "react";
import { addElement, updateCanvasBackground, publishWebsite } from "./actions";
import CanvasElement, { type ElementData } from "./CanvasElement";

const CANVAS_WIDTH = 1200;

// Plain toLocaleString() picks up whatever locale/timezone the running
// process defaults to — the Node server and the visitor's browser can
// disagree (24-hour "00:07" server-side vs "12:07 am" client-side is a
// real mismatch this exact code hit), which React flags as a hydration
// error. Pinning locale + timezone makes the formatted string identical
// wherever it's computed.
function formatPublishedAt(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

export default function CanvasEditor({
  schoolCode,
  schoolName,
  canvasBackground,
  elements,
  publishedAt,
  siteUrl,
}: {
  schoolCode: string;
  schoolName: string;
  canvasBackground: string | null;
  elements: ElementData[];
  publishedAt: string | null;
  siteUrl: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPublishing, startTransition] = useTransition();
  const [lastPublished, setLastPublished] = useState<string | null>(publishedAt);
  const [copied, setCopied] = useState(false);

  const canvasHeight = Math.max(600, ...elements.map((e) => e.y + e.height + 60));

  function handlePublish() {
    startTransition(async () => {
      const result = await publishWebsite(schoolCode);
      setLastPublished(result.publishedAt);
    });
  }

  function handleCopyUrl() {
    navigator.clipboard?.writeText(siteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div style={{ background: "#f4f5f7", minHeight: "100dvh" }}>
      <header style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 24px", background: "#fff", borderBottom: "1px solid var(--line)", position: "sticky", top: 0, zIndex: 500 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div className="disp" style={{ fontSize: 16 }}>
            {schoolName} — editing your website
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, padding: "4px 10px" }}>
            <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
              {siteUrl}
            </span>
            <a href={siteUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, fontWeight: 700, color: "var(--marigold-deep)" }}>
              Open ↗
            </a>
            <span onClick={handleCopyUrl} style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", cursor: "pointer" }}>
              {copied ? "Copied!" : "Copy"}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <span
            onClick={() => startTransition(() => addElement(schoolCode, "TEXT", { x: 40, y: 40 }))}
            style={{ fontSize: 13, fontWeight: 700, color: "var(--marigold-deep)", cursor: "pointer" }}
          >
            + Text
          </span>
          <span
            onClick={() => startTransition(() => addElement(schoolCode, "IMAGE", { x: 40, y: 40 }))}
            style={{ fontSize: 13, fontWeight: 700, color: "var(--marigold-deep)", cursor: "pointer" }}
          >
            + Image
          </span>
          <span
            onClick={() => startTransition(() => addElement(schoolCode, "BUTTON", { x: 40, y: 40 }))}
            style={{ fontSize: 13, fontWeight: 700, color: "var(--marigold-deep)", cursor: "pointer" }}
          >
            + Button
          </span>
          <span
            onClick={() => startTransition(() => addElement(schoolCode, "SHAPE", { x: 40, y: 40 }))}
            style={{ fontSize: 13, fontWeight: 700, color: "var(--marigold-deep)", cursor: "pointer" }}
          >
            + Shape
          </span>
          <span
            onClick={() => startTransition(() => addElement(schoolCode, "IMAGE_CAROUSEL", { x: 40, y: 40 }))}
            style={{ fontSize: 13, fontWeight: 700, color: "var(--marigold-deep)", cursor: "pointer" }}
          >
            + Scrolling images
          </span>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
            Background
            <input
              type="color"
              value={canvasBackground ?? "#ffffff"}
              onChange={(e) => startTransition(() => updateCanvasBackground(schoolCode, e.target.value))}
              style={{ width: 26, height: 26, border: "1px solid var(--line)", padding: 0 }}
            />
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 10, borderLeft: "1px solid var(--line)" }}>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>
              {lastPublished ? `Published ${formatPublishedAt(lastPublished)}` : "Not published yet"}
            </span>
            <button
              onClick={handlePublish}
              disabled={isPublishing}
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#fff",
                background: "var(--marigold)",
                border: "none",
                borderRadius: 8,
                padding: "8px 16px",
                cursor: isPublishing ? "default" : "pointer",
                opacity: isPublishing ? 0.6 : 1,
              }}
            >
              {isPublishing ? "Publishing…" : "Publish"}
            </button>
          </div>
        </div>
      </header>

      <div style={{ padding: "32px 0", display: "flex", justifyContent: "center" }}>
        <div
          onClick={() => setSelectedId(null)}
          style={{
            position: "relative",
            width: CANVAS_WIDTH,
            height: canvasHeight,
            background: canvasBackground ?? "#ffffff",
            boxShadow: "0 0 0 1px var(--line), 0 12px 40px rgba(0,0,0,0.08)",
          }}
        >
          {elements
            .filter((e) => e.visible)
            .map((el) => (
              <CanvasElement key={el.id} element={el} code={schoolCode} selected={selectedId === el.id} onSelect={() => setSelectedId(el.id)} />
            ))}
        </div>
      </div>
    </div>
  );
}
