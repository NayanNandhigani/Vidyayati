-- Batch 11 (HR depth): staff qualification/specialization/shift fields,
-- a check-in time on staff attendance (for a display-only late-arrival
-- flag), and a staff leave type + request workflow (single-stage
-- approval, quota computed live from approved requests — no separate
-- mutable balance table to keep in sync).

ALTER TABLE "staff_profiles" ADD COLUMN "qualifications" TEXT;
ALTER TABLE "staff_profiles" ADD COLUMN "specialization" TEXT;
ALTER TABLE "staff_profiles" ADD COLUMN "shift_start" TEXT;

ALTER TABLE "staff_attendance" ADD COLUMN "check_in_time" TEXT;

CREATE TABLE "staff_leave_types" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "annual_quota" INTEGER NOT NULL,

    CONSTRAINT "staff_leave_types_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "staff_leave_types_school_id_idx" ON "staff_leave_types"("school_id");
ALTER TABLE "staff_leave_types" ADD CONSTRAINT "staff_leave_types_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "StaffLeaveRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "staff_leave_requests" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "leave_type_id" TEXT NOT NULL,
    "date_from" DATE NOT NULL,
    "date_to" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "StaffLeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_by_staff_id" TEXT,
    "action_at" TIMESTAMP(3),

    CONSTRAINT "staff_leave_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "staff_leave_requests_school_id_idx" ON "staff_leave_requests"("school_id");
CREATE INDEX "staff_leave_requests_staff_id_idx" ON "staff_leave_requests"("staff_id");
ALTER TABLE "staff_leave_requests" ADD CONSTRAINT "staff_leave_requests_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_leave_requests" ADD CONSTRAINT "staff_leave_requests_staff_id_fkey"
  FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_leave_requests" ADD CONSTRAINT "staff_leave_requests_leave_type_id_fkey"
  FOREIGN KEY ("leave_type_id") REFERENCES "staff_leave_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
