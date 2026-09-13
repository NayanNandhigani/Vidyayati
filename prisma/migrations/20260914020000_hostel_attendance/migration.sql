-- Hostel Management Phase 1, Part B: hostel residency roll-call, new
-- concept, purely additive — no existing data to backfill.
CREATE TYPE "HostelAttendanceSession" AS ENUM ('MORNING', 'EVENING', 'NIGHT');
CREATE TYPE "HostelAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE');

CREATE TABLE "hostel_attendance" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "session" "HostelAttendanceSession" NOT NULL,
    "status" "HostelAttendanceStatus" NOT NULL,
    "marked_by_staff_id" TEXT,

    CONSTRAINT "hostel_attendance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hostel_attendance_student_id_date_session_key" ON "hostel_attendance"("student_id", "date", "session");
CREATE INDEX "hostel_attendance_school_id_idx" ON "hostel_attendance"("school_id");
CREATE INDEX "hostel_attendance_student_id_idx" ON "hostel_attendance"("student_id");

ALTER TABLE "hostel_attendance" ADD CONSTRAINT "hostel_attendance_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hostel_attendance" ADD CONSTRAINT "hostel_attendance_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hostel_attendance" ADD CONSTRAINT "hostel_attendance_marked_by_staff_id_fkey" FOREIGN KEY ("marked_by_staff_id") REFERENCES "staff_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
