"use client";

import { useTransition } from "react";
import { toggleSchoolFeature } from "../actions";
import { FEATURE_REGISTRY, type FeatureKey } from "@/lib/feature-flags";

export default function FeatureAccessGrid({ schoolId, enabledKeys }: { schoolId: string; enabledKeys: string[] }) {
  const [pending, startTransition] = useTransition();
  const enabledSet = new Set(enabledKeys);

  const byModule = new Map<string, { key: FeatureKey; label: string; description: string }[]>();
  for (const [key, meta] of Object.entries(FEATURE_REGISTRY) as [FeatureKey, (typeof FEATURE_REGISTRY)[FeatureKey]][]) {
    const list = byModule.get(meta.module) ?? [];
    list.push({ key, label: meta.label, description: meta.description });
    byModule.set(meta.module, list);
  }

  function toggle(key: FeatureKey) {
    startTransition(async () => {
      await toggleSchoolFeature(schoolId, key);
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
        Finer-grained than the module toggles above — turns on the "depth" version of specific capabilities inside a
        module this school already has access to. Off by default for every school.
      </div>
      {[...byModule.entries()].map(([moduleName, features]) => (
        <div key={moduleName}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 6 }}>
            {moduleName}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {features.map((f) => {
              const enabled = enabledSet.has(f.key);
              return (
                <div
                  key={f.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: enabled ? "var(--good-tint)" : "var(--paper)",
                    border: "1px solid " + (enabled ? "transparent" : "var(--line)"),
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: enabled ? "var(--good)" : "var(--ink)" }}>{f.label}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>{f.description}</div>
                  </div>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => toggle(f.key)}
                    className="pill"
                    style={{
                      flex: "none",
                      cursor: pending ? "default" : "pointer",
                      border: "1px solid " + (enabled ? "transparent" : "var(--line)"),
                      background: enabled ? "var(--good)" : "var(--paper)",
                      color: enabled ? "#fff" : "var(--faint)",
                      fontWeight: 700,
                    }}
                  >
                    {enabled ? "On" : "Off"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
