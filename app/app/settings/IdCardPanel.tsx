"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { IdCardAudience, IdCardOrientation } from "@prisma/client";
import { createIdCardTemplate, deleteIdCardTemplate, setActiveTemplate } from "./id-card-actions";
import { CARD_SIZE } from "@/lib/id-cards";

export type TemplateSummary = {
  id: string;
  name: string;
  audience: IdCardAudience;
  orientation: IdCardOrientation;
  isActive: boolean;
  backgroundColor: string | null;
};

function MiniCard({ orientation, backgroundColor }: { orientation: IdCardOrientation; backgroundColor: string | null }) {
  const size = CARD_SIZE[orientation];
  const scale = 150 / size.width;
  return (
    <div
      style={{
        width: size.width * scale,
        height: size.height * scale,
        borderRadius: 8,
        background: backgroundColor ?? "#e08a2c",
        boxShadow: "0 0 0 1px var(--line)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", top: 8, left: 8, width: 22, height: 22, borderRadius: 5, background: "rgba(255,255,255,.55)" }} />
      <div style={{ position: "absolute", top: 10, left: 38, width: 60, height: 6, borderRadius: 3, background: "rgba(255,255,255,.85)" }} />
      <div style={{ position: "absolute", top: 20, left: 38, width: 40, height: 5, borderRadius: 3, background: "rgba(255,255,255,.6)" }} />
    </div>
  );
}

export default function IdCardPanel({ templates }: { templates: TemplateSummary[] }) {
  const [isPending, startTransition] = useTransition();
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAudience, setNewAudience] = useState<IdCardAudience>("STUDENT" as IdCardAudience);
  const [newOrientation, setNewOrientation] = useState<IdCardOrientation>("HORIZONTAL" as IdCardOrientation);

  const students = templates.filter((t) => t.audience === "STUDENT");
  const staff = templates.filter((t) => t.audience === "STAFF");

  function create() {
    startTransition(() => createIdCardTemplate(newName, newAudience, newOrientation));
  }

  function group(label: string, list: TemplateSummary[]) {
    return (
      <div style={{ marginBottom: 26 }}>
        <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 10 }}>
          {label}
        </div>
        {list.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--muted)" }}>No templates yet.</div>
        ) : (
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {list.map((tpl) => (
              <div key={tpl.id} style={{ width: 168 }}>
                <Link href={`/app/settings/id-cards/${tpl.id}`} style={{ display: "block", textDecoration: "none" }}>
                  <div style={{ position: "relative" }}>
                    <MiniCard orientation={tpl.orientation} backgroundColor={tpl.backgroundColor} />
                    {tpl.isActive && (
                      <div style={{ position: "absolute", top: 6, right: 6, width: 18, height: 18, borderRadius: "50%", background: "var(--good)", color: "#fff", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        ✓
                      </div>
                    )}
                  </div>
                  <div style={{ marginTop: 10, fontWeight: 700, fontSize: 13, color: "var(--ink)" }}>{tpl.name}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{tpl.orientation === "HORIZONTAL" ? "Landscape" : "Portrait"}</div>
                </Link>
                <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                  {!tpl.isActive && (
                    <span
                      onClick={() => startTransition(() => setActiveTemplate(tpl.id))}
                      style={{ fontSize: 11.5, fontWeight: 600, color: "var(--marigold-deep)", cursor: "pointer" }}
                    >
                      Set active
                    </span>
                  )}
                  <span
                    onClick={() => {
                      if (confirm(`Delete "${tpl.name}"?`)) startTransition(() => deleteIdCardTemplate(tpl.id));
                    }}
                    style={{ fontSize: 11.5, fontWeight: 600, color: "var(--critical)", cursor: "pointer" }}
                  >
                    Delete
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 2 }}>
            ID card templates
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)", maxWidth: 460 }}>
            Design your own student/staff ID cards — drag, resize, and style text, photos, and shapes, then insert
            merge fields (name, admission no., class, etc.) that get filled in per person. The template marked
            active is the one used when a card is generated.
          </div>
        </div>
        <button
          onClick={() => setShowNew((v) => !v)}
          style={{ fontSize: 13, fontWeight: 700, color: "#fff", background: "var(--marigold)", border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer", flex: "none" }}
        >
          + New template
        </button>
      </div>

      {showNew && (
        <div className="field" style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 24, padding: 16, background: "var(--paper)", borderRadius: 10, border: "1px solid var(--line)" }}>
          <div>
            <label style={{ fontSize: 11, color: "var(--muted)" }}>Name</label>
            <input className="in" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Primary Student Card" style={{ display: "block", marginTop: 4 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--muted)" }}>For</label>
            <select className="in" value={newAudience} onChange={(e) => setNewAudience(e.target.value as IdCardAudience)} style={{ display: "block", marginTop: 4 }}>
              <option value="STUDENT">Students</option>
              <option value="STAFF">Staff</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--muted)" }}>Orientation</label>
            <select className="in" value={newOrientation} onChange={(e) => setNewOrientation(e.target.value as IdCardOrientation)} style={{ display: "block", marginTop: 4 }}>
              <option value="HORIZONTAL">Horizontal</option>
              <option value="VERTICAL">Vertical</option>
            </select>
          </div>
          <button
            onClick={create}
            disabled={isPending}
            style={{ fontSize: 13, fontWeight: 700, color: "#fff", background: "var(--marigold-deep)", border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer" }}
          >
            Create & edit
          </button>
        </div>
      )}

      {group("Student ID cards", students)}
      {group("Staff ID cards", staff)}
    </div>
  );
}
