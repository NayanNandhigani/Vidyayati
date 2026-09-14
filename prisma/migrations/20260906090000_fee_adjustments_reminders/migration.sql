-- User-requested additions: ad-hoc additional fee charges per student
-- (mirror of FeeDiscount, but adds instead of subtracts), and a small
-- admin-managed reminder board for the School Admin dashboard.

CREATE TABLE "fee_adjustments" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "added_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_adjustments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "fee_adjustments_school_id_idx" ON "fee_adjustments"("school_id");
CREATE INDEX "fee_adjustments_student_id_idx" ON "fee_adjustments"("student_id");
ALTER TABLE "fee_adjustments" ADD CONSTRAINT "fee_adjustments_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_adjustments" ADD CONSTRAINT "fee_adjustments_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "dashboard_reminders" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dashboard_reminders_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "dashboard_reminders_school_id_idx" ON "dashboard_reminders"("school_id");
ALTER TABLE "dashboard_reminders" ADD CONSTRAINT "dashboard_reminders_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
