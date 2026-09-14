-- Batch 3 (Class & Section depth): section capacity + curriculum board
-- per class, elective/credit flags per subject, and a co-class-teacher
-- join table alongside the existing single classTeacherStaffId column
-- (left untouched). All additive.

ALTER TABLE "classes" ADD COLUMN "max_strength" INTEGER;
ALTER TABLE "classes" ADD COLUMN "board" TEXT;

ALTER TABLE "subjects" ADD COLUMN "is_elective" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "subjects" ADD COLUMN "credits" INTEGER;

CREATE TABLE "class_co_teachers" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,

    CONSTRAINT "class_co_teachers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "class_co_teachers_class_id_staff_id_key" ON "class_co_teachers"("class_id", "staff_id");
CREATE INDEX "class_co_teachers_school_id_idx" ON "class_co_teachers"("school_id");
ALTER TABLE "class_co_teachers" ADD CONSTRAINT "class_co_teachers_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "class_co_teachers" ADD CONSTRAINT "class_co_teachers_class_id_fkey"
  FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "class_co_teachers" ADD CONSTRAINT "class_co_teachers_staff_id_fkey"
  FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
