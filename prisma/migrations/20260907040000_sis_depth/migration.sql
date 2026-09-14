-- Batch 2 (SIS depth): student medical/emergency/prior-school info, a
-- shared student+staff document repository, a primary-guardian flag and
-- a guardian contact preference, an admission-number prefix setting, and
-- a QR/barcode element type for ID cards. All additive — no existing
-- column is altered, dropped, or renamed.

ALTER TABLE "students" ADD COLUMN "address" TEXT;
ALTER TABLE "students" ADD COLUMN "blood_group" TEXT;
ALTER TABLE "students" ADD COLUMN "medical_notes" TEXT;
ALTER TABLE "students" ADD COLUMN "previous_school_name" TEXT;
ALTER TABLE "students" ADD COLUMN "previous_tc_no" TEXT;
ALTER TABLE "students" ADD COLUMN "previous_tc_date" TIMESTAMP(3);
ALTER TABLE "students" ADD COLUMN "prior_performance_note" TEXT;

ALTER TABLE "parents" ADD COLUMN "preferred_contact_method" TEXT;
ALTER TABLE "student_parent_links" ADD COLUMN "is_primary" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "schools" ADD COLUMN "admission_no_prefix" TEXT;

CREATE TABLE "student_emergency_contacts" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "student_emergency_contacts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "student_emergency_contacts_school_id_idx" ON "student_emergency_contacts"("school_id");
CREATE INDEX "student_emergency_contacts_student_id_idx" ON "student_emergency_contacts"("student_id");
ALTER TABLE "student_emergency_contacts" ADD CONSTRAINT "student_emergency_contacts_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_emergency_contacts" ADD CONSTRAINT "student_emergency_contacts_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "DocumentSubjectType" AS ENUM ('STUDENT', 'STAFF');

CREATE TABLE "person_documents" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "subject_type" "DocumentSubjectType" NOT NULL,
    "student_id" TEXT,
    "staff_id" TEXT,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "expiry_date" TIMESTAMP(3),
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_documents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "person_documents_school_id_idx" ON "person_documents"("school_id");
CREATE INDEX "person_documents_student_id_idx" ON "person_documents"("student_id");
CREATE INDEX "person_documents_staff_id_idx" ON "person_documents"("staff_id");
ALTER TABLE "person_documents" ADD CONSTRAINT "person_documents_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "person_documents" ADD CONSTRAINT "person_documents_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "person_documents" ADD CONSTRAINT "person_documents_staff_id_fkey"
  FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TYPE "IdCardElementType" ADD VALUE 'BARCODE';
