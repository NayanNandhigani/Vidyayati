import { requireModuleAccess } from "@/lib/permissions";

export default async function TeachingPage() {
  await requireModuleAccess("Teaching", "VIEW");

  return (
    <div style={{ padding: "26px 34px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="disp" style={{ fontSize: 21 }}>
        Teaching
      </div>
      <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
        This module hasn't been set up yet.
      </div>
    </div>
  );
}
