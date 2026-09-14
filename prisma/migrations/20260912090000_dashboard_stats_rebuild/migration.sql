-- StaffCategory enum + StaffProfile.staff_category
CREATE TYPE "StaffCategory" AS ENUM ('TEACHING', 'NON_TEACHING');

ALTER TABLE "staff_profiles" ADD COLUMN "staff_category" "StaffCategory" NOT NULL DEFAULT 'TEACHING';

-- Best-effort backfill for existing seeded/real rows whose designation
-- clearly indicates a non-teaching role. Anything not matched keeps the
-- TEACHING default (including NULL designations).
UPDATE "staff_profiles"
SET "staff_category" = 'NON_TEACHING'
WHERE "designation" ILIKE '%librarian%'
   OR "designation" ILIKE '%accountant%'
   OR "designation" ILIKE '%front office%'
   OR "designation" ILIKE '%lab assistant%'
   OR "designation" ILIKE '%counsellor%'
   OR "designation" ILIKE '%counselor%'
   OR "designation" ILIKE '%driver%'
   OR "designation" ILIKE '%clerk%'
   OR "designation" ILIKE '%warden%'
   OR "designation" ILIKE '%nurse%'
   OR "designation" ILIKE '%security%'
   OR "designation" ILIKE '%peon%'
   OR "designation" ILIKE '%receptionist%'
   OR "designation" ILIKE '%administrator%';

-- Reminders gain an optional scheduled date
ALTER TABLE "dashboard_reminders" ADD COLUMN "remind_at" DATE;

-- New Notes board — same shape as reminders minus title/schedule
CREATE TABLE "dashboard_notes" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dashboard_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dashboard_notes_school_id_idx" ON "dashboard_notes"("school_id");

ALTER TABLE "dashboard_notes" ADD CONSTRAINT "dashboard_notes_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
