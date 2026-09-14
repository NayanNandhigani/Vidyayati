"use client";

import { useRef, useTransition } from "react";

/** Small camera-button overlay for a profile-picture Avatar — pick a file, it uploads immediately via the bound server action. Meant to sit inside a `position: relative` wrapper around an Avatar. */
export default function ProfilePhotoUpload({ onUpload }: { onUpload: (formData: FormData) => Promise<void> }) {
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.set("photo", file);
    startTransition(async () => {
      await onUpload(formData);
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleChange} style={{ display: "none" }} id="profile-photo-input" />
      <label
        htmlFor="profile-photo-input"
        title="Change photo"
        style={{
          position: "absolute",
          bottom: -2,
          right: -2,
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "var(--marigold)",
          border: "2px solid var(--card)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: pending ? "default" : "pointer",
          fontSize: 11,
          color: "#fff",
        }}
      >
        {pending ? "…" : "✎"}
      </label>
    </>
  );
}
