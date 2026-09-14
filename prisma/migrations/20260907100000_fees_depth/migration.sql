-- Batch 8 (Fees depth): per-student discount rules (scholarship/sibling/
-- other), a late-fee-per-day setting, and GST fields — all computed at
-- display/payment time, never rewriting FeeStructure.amount.

CREATE TYPE "DiscountKind" AS ENUM ('SCHOLARSHIP', 'SIBLING', 'OTHER');
CREATE TYPE "DiscountValueType" AS ENUM ('PERCENT', 'FLAT');

CREATE TABLE "fee_discounts" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "kind" "DiscountKind" NOT NULL,
    "value_type" "DiscountValueType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_discounts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "fee_discounts_school_id_idx" ON "fee_discounts"("school_id");
CREATE INDEX "fee_discounts_student_id_idx" ON "fee_discounts"("student_id");
ALTER TABLE "fee_discounts" ADD CONSTRAINT "fee_discounts_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_discounts" ADD CONSTRAINT "fee_discounts_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "schools" ADD COLUMN "fee_late_fine_per_day" DECIMAL(10,2);
ALTER TABLE "schools" ADD COLUMN "fee_late_fine_grace_days" INTEGER;
ALTER TABLE "schools" ADD COLUMN "gst_number" TEXT;
ALTER TABLE "schools" ADD COLUMN "gst_rate_percent" DECIMAL(5,2);
