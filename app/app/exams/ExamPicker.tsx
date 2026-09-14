"use client";

import { useRouter } from "next/navigation";

type ExamOption = { id: string; label: string; classId: string };

export default function ExamPicker({ exams, selectedExamId, tab }: { exams: ExamOption[]; selectedExamId: string | null; tab: string }) {
  const router = useRouter();

  return (
    <select
      className="in"
      value={selectedExamId ?? ""}
      onChange={(e) => {
        const exam = exams.find((ex) => ex.id === e.target.value);
        if (exam) router.push(`/app/exams?tab=${tab}&exam=${exam.id}&classId=${exam.classId}`);
      }}
      style={{ maxWidth: 380 }}
    >
      <option value="" disabled>
        Select an exam…
      </option>
      {exams.map((ex) => (
        <option key={ex.id} value={ex.id}>
          {ex.label}
        </option>
      ))}
    </select>
  );
}
