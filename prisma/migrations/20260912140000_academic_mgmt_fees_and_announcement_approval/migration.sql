-- Student per-student fee allocation (actual vs. charged; scholarship is
-- always computed as the difference, never stored)
ALTER TABLE "students" ADD COLUMN "actual_fee" DECIMAL(12,2);
ALTER TABLE "students" ADD COLUMN "charged_fee" DECIMAL(12,2);

-- Class Fee Structure defaults — one row per class
CREATE TABLE "class_fee_defaults" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "actual_fee" DECIMAL(12,2) NOT NULL,
    "charged_fee" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "class_fee_defaults_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "class_fee_defaults_class_id_key" ON "class_fee_defaults"("class_id");
CREATE INDEX "class_fee_defaults_school_id_idx" ON "class_fee_defaults"("school_id");

ALTER TABLE "class_fee_defaults" ADD CONSTRAINT "class_fee_defaults_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "class_fee_defaults" ADD CONSTRAINT "class_fee_defaults_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Announcement approval workflow — every announcement starts PENDING and
-- needs an explicit School-Admin approval before recipients see it.
CREATE TYPE "AnnouncementApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "announcements" ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "announcements" ADD COLUMN "approval_status" "AnnouncementApprovalStatus" NOT NULL DEFAULT 'PENDING';

-- Grandfather existing rows that were already live under the
-- pre-approval-workflow behavior — nothing already published gets
-- retroactively un-published.
UPDATE "announcements" SET "approval_status" = 'APPROVED' WHERE "published_on" IS NOT NULL;
UPDATE "announcements" SET "created_at" = "published_on" WHERE "published_on" IS NOT NULL;
