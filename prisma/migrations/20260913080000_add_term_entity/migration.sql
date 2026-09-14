-- Architecture V1, Milestone 2 (School Core) — additive: Term sits under
-- AcademicYear, nothing else references it yet.
CREATE TABLE "terms" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "year_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "terms_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "terms_year_id_name_key" ON "terms"("year_id", "name");
CREATE INDEX "terms_school_id_idx" ON "terms"("school_id");
CREATE INDEX "terms_year_id_idx" ON "terms"("year_id");

ALTER TABLE "terms" ADD CONSTRAINT "terms_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "terms" ADD CONSTRAINT "terms_year_id_fkey" FOREIGN KEY ("year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
