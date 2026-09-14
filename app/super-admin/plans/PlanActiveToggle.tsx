"use client";

import { useState, useTransition } from "react";
import { togglePlanActive } from "./actions";

export default function PlanActiveToggle({ planId, isActive: initialActive }: { planId: string; isActive: boolean }) {
  const [isActive, setIsActive] = useState(initialActive);
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      await togglePlanActive(planId);
      setIsActive((prev) => !prev);
    });
  }

  return (
    <span
      className="pill"
      onClick={toggle}
      style={{ background: isActive ? "var(--good-tint)" : "var(--line)", color: isActive ? "var(--good)" : "var(--faint)", cursor: pending ? "default" : "pointer", opacity: pending ? 0.6 : 1 }}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}
