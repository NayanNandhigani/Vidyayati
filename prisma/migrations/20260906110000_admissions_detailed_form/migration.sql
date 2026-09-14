-- User-requested: a detailed Admissions application form (student/parent/
-- address/health/academic-reference fields), a printable admission form,
-- and an admit-approval workflow, gated behind
-- requireFeature("admissions.detailedForm").

CREATE TYPE "AdmissionApprovalStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "admission_enquiries" ADD COLUMN "parent_name" TEXT;
ALTER TABLE "admission_enquiries" ADD COLUMN "address" TEXT;
ALTER TABLE "admission_enquiries" ADD COLUMN "photo_path" TEXT;
ALTER TABLE "admission_enquiries" ADD COLUMN "dob" TIMESTAMP(3);
ALTER TABLE "admission_enquiries" ADD COLUMN "gender" "Gender";
ALTER TABLE "admission_enquiries" ADD COLUMN "blood_group" TEXT;
ALTER TABLE "admission_enquiries" ADD COLUMN "nationality" TEXT;
ALTER TABLE "admission_enquiries" ADD COLUMN "caste" TEXT;
ALTER TABLE "admission_enquiries" ADD COLUMN "religion_category" TEXT;
ALTER TABLE "admission_enquiries" ADD COLUMN "mother_tongue" TEXT;
ALTER TABLE "admission_enquiries" ADD COLUMN "student_aadhaar_number" TEXT;
ALTER TABLE "admission_enquiries" ADD COLUMN "father_name" TEXT;
ALTER TABLE "admission_enquiries" ADD COLUMN "mother_name" TEXT;
ALTER TABLE "admission_enquiries" ADD COLUMN "guardian_name" TEXT;
ALTER TABLE "admission_enquiries" ADD COLUMN "father_occupation" TEXT;
ALTER TABLE "admission_enquiries" ADD COLUMN "mother_occupation" TEXT;
ALTER TABLE "admission_enquiries" ADD COLUMN "contact_number_2" TEXT;
ALTER TABLE "admission_enquiries" ADD COLUMN "annual_income" TEXT;
ALTER TABLE "admission_enquiries" ADD COLUMN "email" TEXT;
ALTER TABLE "admission_enquiries" ADD COLUMN "parent_aadhaar_number" TEXT;
ALTER TABLE "admission_enquiries" ADD COLUMN "permanent_address" TEXT;
ALTER TABLE "admission_enquiries" ADD COLUMN "current_address" TEXT;
ALTER TABLE "admission_enquiries" ADD COLUMN "pincode" TEXT;
ALTER TABLE "admission_enquiries" ADD COLUMN "allergies_conditions" TEXT;
ALTER TABLE "admission_enquiries" ADD COLUMN "emergency_contact_name" TEXT;
ALTER TABLE "admission_enquiries" ADD COLUMN "emergency_contact_number" TEXT;
ALTER TABLE "admission_enquiries" ADD COLUMN "family_doctor_contact" TEXT;
ALTER TABLE "admission_enquiries" ADD COLUMN "udise_number" TEXT;
ALTER TABLE "admission_enquiries" ADD COLUMN "pen_number" TEXT;
ALTER TABLE "admission_enquiries" ADD COLUMN "approval_status" "AdmissionApprovalStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "admission_enquiries" ADD COLUMN "submitted_for_approval_at" TIMESTAMP(3);
ALTER TABLE "admission_enquiries" ADD COLUMN "approval_action_at" TIMESTAMP(3);
