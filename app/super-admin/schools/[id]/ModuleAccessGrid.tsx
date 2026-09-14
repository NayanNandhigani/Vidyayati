"use client";

import { useTransition } from "react";
import { toggleSchoolModule } from "../actions";

const MODULES = ["Students", "Employees", "Attendance", "Exams", "Homework", "Timetable", "Fees", "Accounts", "Admissions", "Transport", "Hostel", "Library", "Events", "Certificates", "Communication", "Reports"];

export default function ModuleAccessGrid({ schoolId, disabledModules }: { schoolId: string; disabledModules: string[] }) {
  const [pending, startTransition] = useTransition();
  const disabledSet = new Set(disabledModules);

  function toggle(moduleName: string) {
    startTransition(async () => {
      await toggleSchoolModule(schoolId, moduleName);
    });
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {MODULES.map((m) => {
        const enabled = !disabledSet.has(m);
        return (
          <button
            key={m}
            type="button"
            disabled={pending}
            onClick={() => toggle(m)}
            className="pill"
            style={{
              cursor: pending ? "default" : "pointer",
              border: "1px solid " + (enabled ? "transparent" : "var(--line)"),
              background: enabled ? "var(--good-tint)" : "var(--paper)",
              color: enabled ? "var(--good)" : "var(--faint)",
              fontWeight: 600,
            }}
            title={enabled ? "Enabled — click to turn off" : "Disabled — click to turn on"}
          >
            {m} · {enabled ? "On" : "Off"}
          </button>
        );
      })}
    </div>
  );
}
