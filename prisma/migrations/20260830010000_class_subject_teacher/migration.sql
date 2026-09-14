-- Manage Institute module: prevent duplicate class/section rows within a
-- year, and add the standing "who teaches what, in which class" roster.

ALTER TABLE "classes" ADD CONSTRAINT "classes_year_id_grade_section_key" UNIQUE ("year_id", "grade", "section");

CREATE TABLE "class_subject_teachers" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,

    CONSTRAINT "class_subject_teachers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "class_subject_teachers_class_id_subject_id_key" ON "class_subject_teachers"("class_id", "subject_id");

CREATE INDEX "class_subject_teachers_school_id_idx" ON "class_subject_teachers"("school_id");

ALTER TABLE "class_subject_teachers" ADD CONSTRAINT "class_subject_teachers_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "class_subject_teachers" ADD CONSTRAINT "class_subject_teachers_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "class_subject_teachers" ADD CONSTRAINT "class_subject_teachers_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "class_subject_teachers" ADD CONSTRAINT "class_subject_teachers_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
