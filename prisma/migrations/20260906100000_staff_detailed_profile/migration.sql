-- User-requested: a detailed staff application profile (teaching and
-- non-teaching), gated behind requireFeature("employees.detailedProfile").
-- All columns additive/nullable.

ALTER TABLE "staff_profiles" ADD COLUMN "employee_id" TEXT;
ALTER TABLE "staff_profiles" ADD COLUMN "dob" TIMESTAMP(3);
ALTER TABLE "staff_profiles" ADD COLUMN "gender" "Gender";
ALTER TABLE "staff_profiles" ADD COLUMN "blood_group" TEXT;
ALTER TABLE "staff_profiles" ADD COLUMN "marital_status" TEXT;
ALTER TABLE "staff_profiles" ADD COLUMN "nationality" TEXT;
ALTER TABLE "staff_profiles" ADD COLUMN "aadhaar_number" TEXT;
ALTER TABLE "staff_profiles" ADD COLUMN "pan_number" TEXT;
ALTER TABLE "staff_profiles" ADD COLUMN "mobile_primary" TEXT;
ALTER TABLE "staff_profiles" ADD COLUMN "mobile_alternate" TEXT;
ALTER TABLE "staff_profiles" ADD COLUMN "personal_email" TEXT;
ALTER TABLE "staff_profiles" ADD COLUMN "current_address" TEXT;
ALTER TABLE "staff_profiles" ADD COLUMN "permanent_address" TEXT;
ALTER TABLE "staff_profiles" ADD COLUMN "emergency_contact_name" TEXT;
ALTER TABLE "staff_profiles" ADD COLUMN "emergency_contact_phone" TEXT;
ALTER TABLE "staff_profiles" ADD COLUMN "employment_type" TEXT;
ALTER TABLE "staff_profiles" ADD COLUMN "work_location" TEXT;
ALTER TABLE "staff_profiles" ADD COLUMN "reporting_manager_id" TEXT;
ALTER TABLE "staff_profiles" ADD COLUMN "drivers_license_no" TEXT;
ALTER TABLE "staff_profiles" ADD COLUMN "teaching_certification" TEXT;
ALTER TABLE "staff_profiles" ADD COLUMN "years_of_experience" INTEGER;
ALTER TABLE "staff_profiles" ADD COLUMN "previous_employer_name" TEXT;
ALTER TABLE "staff_profiles" ADD COLUMN "previous_designation" TEXT;
ALTER TABLE "staff_profiles" ADD COLUMN "salary_pay_grade" TEXT;
ALTER TABLE "staff_profiles" ADD COLUMN "bank_account_number" TEXT;
ALTER TABLE "staff_profiles" ADD COLUMN "ifsc_code" TEXT;
ALTER TABLE "staff_profiles" ADD COLUMN "bank_name" TEXT;
ALTER TABLE "staff_profiles" ADD COLUMN "pf_number" TEXT;
ALTER TABLE "staff_profiles" ADD COLUMN "uan_number" TEXT;
ALTER TABLE "staff_profiles" ADD COLUMN "esi_number" TEXT;

ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_reporting_manager_id_fkey"
  FOREIGN KEY ("reporting_manager_id") REFERENCES "staff_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
