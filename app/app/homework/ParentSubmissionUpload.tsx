"use client";

import { useRef, useTransition } from "react";
import { uploadSubmissionAttachment } from "./depth-actions";

export default function ParentSubmissionUpload({ submissionId, hasAttachment }: { submissionId: string; hasAttachment: boolean }) {
  const [, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function pick() {
    fileRef.current?.click();
  }
  function onChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);
    startTransition(() => uploadSubmissionAttachment(submissionId, formData));
  }

  return (
    <>
      <span onClick={pick} style={{ fontSize: 11, fontWeight: 700, color: "var(--marigold-deep)", cursor: "pointer" }}>
        {hasAttachment ? "Replace file" : "+ Upload"}
      </span>
      <input ref={fileRef} type="file" onChange={onChosen} style={{ display: "none" }} />
    </>
  );
}
