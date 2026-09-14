-- "Actual fee" is no longer stored per student — it's looked up live from
-- the class's grade-level default (ClassFeeDefault). Only chargedFee stays
-- on Student.
ALTER TABLE "students" DROP COLUMN "actual_fee";

-- Fee Structure is allocated per grade (Class), not per section — rebuild
-- class_fee_defaults keyed by (year_id, grade) instead of a single class_id,
-- and drop charged_fee (scholarship/charged-fee is a per-student concept
-- only, tracked on students.charged_fee). No real data exists in this
-- table yet, so a clean drop/recreate is safe.
DROP TABLE "class_fee_defaults";

CREATE TABLE "class_fee_defaults" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "year_id" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "actual_fee" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "class_fee_defaults_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "class_fee_defaults_year_id_grade_key" ON "class_fee_defaults"("year_id", "grade");
CREATE INDEX "class_fee_defaults_school_id_idx" ON "class_fee_defaults"("school_id");

ALTER TABLE "class_fee_defaults" ADD CONSTRAINT "class_fee_defaults_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "class_fee_defaults" ADD CONSTRAINT "class_fee_defaults_year_id_fkey" FOREIGN KEY ("year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
