-- Architecture V1, Milestone 3 (Academic Structure) — additive: groups the
-- *existing* Class rows (which stay as-is, effectively "sections") under a
-- new AcademicGrade per (year, grade label), rather than splitting Class
-- apart. Class.grade (free text) is untouched and stays the source of
-- truth for now; academic_grade_id is a parallel, backfilled link.
CREATE TABLE "academic_grades" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "year_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sequence" INTEGER,

    CONSTRAINT "academic_grades_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "academic_grades_year_id_name_key" ON "academic_grades"("year_id", "name");
CREATE INDEX "academic_grades_school_id_idx" ON "academic_grades"("school_id");

ALTER TABLE "academic_grades" ADD CONSTRAINT "academic_grades_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic_grades" ADD CONSTRAINT "academic_grades_year_id_fkey" FOREIGN KEY ("year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one AcademicGrade per distinct (school, year, grade label)
-- already present in classes.
INSERT INTO "academic_grades" ("id", "school_id", "year_id", "name")
SELECT gen_random_uuid()::text, school_id, year_id, grade
FROM (SELECT DISTINCT school_id, year_id, grade FROM "classes") AS distinct_grades;

ALTER TABLE "classes" ADD COLUMN "academic_grade_id" TEXT;

UPDATE "classes" c
SET "academic_grade_id" = g."id"
FROM "academic_grades" g
WHERE g."year_id" = c."year_id" AND g."name" = c."grade";

ALTER TABLE "classes" ADD CONSTRAINT "classes_academic_grade_id_fkey" FOREIGN KEY ("academic_grade_id") REFERENCES "academic_grades"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "classes_academic_grade_id_idx" ON "classes"("academic_grade_id");
