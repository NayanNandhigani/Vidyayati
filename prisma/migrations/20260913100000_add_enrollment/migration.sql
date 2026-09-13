-- Architecture V1, Milestone 4 (Student & Enrollment) — additive:
-- Enrollment sits alongside students.class_id (kept, unchanged); nothing
-- reads from Enrollment yet, only new writes (admission approval, class
-- reshuffle) start populating it going forward.
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'PROMOTED', 'TRANSFERRED', 'WITHDRAWN');

CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "roll_number" TEXT,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "enrolled_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_on" TIMESTAMP(3),

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "enrollments_student_id_academic_year_id_key" ON "enrollments"("student_id", "academic_year_id");
CREATE INDEX "enrollments_school_id_idx" ON "enrollments"("school_id");
CREATE INDEX "enrollments_student_id_idx" ON "enrollments"("student_id");
CREATE INDEX "enrollments_class_id_idx" ON "enrollments"("class_id");
CREATE INDEX "enrollments_academic_year_id_idx" ON "enrollments"("academic_year_id");

ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one Enrollment per existing student, from their current
-- class_id (and that class's year), mapped from Student.status.
INSERT INTO "enrollments" ("id", "school_id", "student_id", "academic_year_id", "class_id", "status", "enrolled_on")
SELECT
  gen_random_uuid()::text,
  s."school_id",
  s."id",
  c."year_id",
  s."class_id",
  CASE WHEN s."status" = 'ALUMNI' THEN 'COMPLETED' ELSE 'ACTIVE' END::"EnrollmentStatus",
  s."created_at"
FROM "students" s
JOIN "classes" c ON c."id" = s."class_id";

-- Admission numbers are unique per school, not per (admissionNo, classId)
-- — verified no existing data violates this before tightening it.
DROP INDEX IF EXISTS "students_admission_no_class_id_key";
CREATE UNIQUE INDEX "students_school_id_admission_no_key" ON "students"("school_id", "admission_no");
