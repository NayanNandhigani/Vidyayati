-- Batch 10 (Payroll depth): a per-staff salary-component structure,
-- statutory deduction rates on School, and optional breakdown columns on
-- PayrollRun populated only by the new structured payroll flow — every
-- column here is nullable and the existing runPayroll()/simple flow is
-- untouched (those rows just keep these columns null, exactly as before
-- this migration).

CREATE TABLE "salary_components" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "salary_components_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "salary_components_school_id_idx" ON "salary_components"("school_id");
CREATE INDEX "salary_components_staff_id_idx" ON "salary_components"("staff_id");
ALTER TABLE "salary_components" ADD CONSTRAINT "salary_components_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "salary_components" ADD CONSTRAINT "salary_components_staff_id_fkey"
  FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_runs" ADD COLUMN "gross_amount" DECIMAL(12,2);
ALTER TABLE "payroll_runs" ADD COLUMN "pf_amount" DECIMAL(12,2);
ALTER TABLE "payroll_runs" ADD COLUMN "esi_amount" DECIMAL(12,2);
ALTER TABLE "payroll_runs" ADD COLUMN "tds_amount" DECIMAL(12,2);
ALTER TABLE "payroll_runs" ADD COLUMN "pt_amount" DECIMAL(12,2);
ALTER TABLE "payroll_runs" ADD COLUMN "lop_amount" DECIMAL(12,2);

ALTER TABLE "schools" ADD COLUMN "pf_percent" DECIMAL(5,2);
ALTER TABLE "schools" ADD COLUMN "esi_percent" DECIMAL(5,2);
ALTER TABLE "schools" ADD COLUMN "pt_fixed_amount" DECIMAL(10,2);
ALTER TABLE "schools" ADD COLUMN "tds_percent" DECIMAL(5,2);
