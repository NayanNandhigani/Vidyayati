-- Architecture V1, Milestone 7 (Exam Architecture), Phase 10 — additive,
-- schema/service-layer only for now (no UI change): AssessmentComponent
-- and ExamSchedule are new tables ready for a future exam-scheduling/
-- weighted-marks screen; StudentResult is populated automatically by
-- lib/domain/exam-results.ts when an exam is approved (see approveExam).
-- None of this changes how Marks are entered or the existing Report Card
-- tab, which still computes its own total/percentage/grade/rank inline
-- from Marks — both use the same grade-band logic, so they agree.
CREATE TABLE "assessment_components" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "exam_subject_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "max_marks" DECIMAL(6,2) NOT NULL,
    "pass_marks" DECIMAL(6,2),
    "weightage_percent" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "assessment_components_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exam_schedules" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "exam_subject_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "room_id" TEXT,
    "invigilator_id" TEXT,

    CONSTRAINT "exam_schedules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "student_results" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "exam_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "total_marks" DECIMAL(8,2) NOT NULL,
    "max_marks" DECIMAL(8,2) NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "grade" TEXT,
    "rank" INTEGER,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_results_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "assessment_components_school_id_idx" ON "assessment_components"("school_id");
CREATE INDEX "assessment_components_exam_subject_id_idx" ON "assessment_components"("exam_subject_id");

CREATE UNIQUE INDEX "exam_schedules_exam_subject_id_key" ON "exam_schedules"("exam_subject_id");
CREATE INDEX "exam_schedules_school_id_idx" ON "exam_schedules"("school_id");
CREATE INDEX "exam_schedules_room_id_idx" ON "exam_schedules"("room_id");

CREATE INDEX "student_results_school_id_idx" ON "student_results"("school_id");
CREATE UNIQUE INDEX "student_results_exam_id_student_id_key" ON "student_results"("exam_id", "student_id");

ALTER TABLE "assessment_components" ADD CONSTRAINT "assessment_components_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assessment_components" ADD CONSTRAINT "assessment_components_exam_subject_id_fkey" FOREIGN KEY ("exam_subject_id") REFERENCES "exam_subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "exam_schedules" ADD CONSTRAINT "exam_schedules_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exam_schedules" ADD CONSTRAINT "exam_schedules_exam_subject_id_fkey" FOREIGN KEY ("exam_subject_id") REFERENCES "exam_subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exam_schedules" ADD CONSTRAINT "exam_schedules_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "exam_schedules" ADD CONSTRAINT "exam_schedules_invigilator_id_fkey" FOREIGN KEY ("invigilator_id") REFERENCES "staff_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "student_results" ADD CONSTRAINT "student_results_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_results" ADD CONSTRAINT "student_results_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_results" ADD CONSTRAINT "student_results_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Unrelated drift fix found via the same migrate-diff check: this index
-- was created by 20260913090000_add_academic_grade but schema.prisma
-- never declared it — bringing the schema in line with the database
-- rather than dropping the (correct, already-existing) database index.
CREATE INDEX IF NOT EXISTS "classes_academic_grade_id_idx" ON "classes"("academic_grade_id");
