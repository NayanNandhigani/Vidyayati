-- Batch 5 (Attendance depth): a parent-submitted, two-stage-approved
-- student leave request, and per-school defaulter/consecutive-absence
-- thresholds. Does not touch the attendance table or AttendanceStatus
-- enum at all.

CREATE TYPE "LeaveRequestStage" AS ENUM ('PENDING', 'CLASS_TEACHER_APPROVED', 'ADMIN_APPROVED', 'REJECTED');

CREATE TABLE "student_leave_requests" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "date_from" DATE NOT NULL,
    "date_to" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "stage" "LeaveRequestStage" NOT NULL DEFAULT 'PENDING',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "class_teacher_action_at" TIMESTAMP(3),
    "admin_action_at" TIMESTAMP(3),
    "rejection_note" TEXT,

    CONSTRAINT "student_leave_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "student_leave_requests_school_id_idx" ON "student_leave_requests"("school_id");
CREATE INDEX "student_leave_requests_student_id_idx" ON "student_leave_requests"("student_id");
ALTER TABLE "student_leave_requests" ADD CONSTRAINT "student_leave_requests_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_leave_requests" ADD CONSTRAINT "student_leave_requests_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "schools" ADD COLUMN "attendance_defaulter_threshold_pct" INTEGER;
ALTER TABLE "schools" ADD COLUMN "consecutive_absence_alert_days" INTEGER;
