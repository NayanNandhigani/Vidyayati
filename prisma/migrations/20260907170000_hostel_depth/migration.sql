-- Batch 15 (Hostel depth): room type + warden assignment on HostelRoom,
-- a weekly mess menu, a walk-in visitor log, and a single-stage
-- parent-requested / admin-approved outing request. Gated behind
-- requireFeature("hostel.operations").

ALTER TABLE "hostel_rooms" ADD COLUMN "room_type" TEXT;
ALTER TABLE "hostel_rooms" ADD COLUMN "warden_staff_id" TEXT;
ALTER TABLE "hostel_rooms" ADD CONSTRAINT "hostel_rooms_warden_staff_id_fkey"
  FOREIGN KEY ("warden_staff_id") REFERENCES "staff_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER');

CREATE TABLE "hostel_mess_menus" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "meal_type" "MealType" NOT NULL,
    "menu_text" TEXT NOT NULL,

    CONSTRAINT "hostel_mess_menus_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "hostel_mess_menus_school_id_idx" ON "hostel_mess_menus"("school_id");
CREATE UNIQUE INDEX "hostel_mess_menus_school_id_day_of_week_meal_type_key" ON "hostel_mess_menus"("school_id", "day_of_week", "meal_type");
ALTER TABLE "hostel_mess_menus" ADD CONSTRAINT "hostel_mess_menus_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "hostel_visitor_logs" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "visitor_name" TEXT NOT NULL,
    "relation" TEXT,
    "purpose" TEXT,
    "check_in_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "check_out_at" TIMESTAMP(3),

    CONSTRAINT "hostel_visitor_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "hostel_visitor_logs_school_id_idx" ON "hostel_visitor_logs"("school_id");
CREATE INDEX "hostel_visitor_logs_student_id_idx" ON "hostel_visitor_logs"("student_id");
ALTER TABLE "hostel_visitor_logs" ADD CONSTRAINT "hostel_visitor_logs_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hostel_visitor_logs" ADD CONSTRAINT "hostel_visitor_logs_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "HostelOutingStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "hostel_outing_requests" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "date_from" TIMESTAMP(3) NOT NULL,
    "date_to" TIMESTAMP(3) NOT NULL,
    "status" "HostelOutingStatus" NOT NULL DEFAULT 'PENDING',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action_at" TIMESTAMP(3),

    CONSTRAINT "hostel_outing_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "hostel_outing_requests_school_id_idx" ON "hostel_outing_requests"("school_id");
CREATE INDEX "hostel_outing_requests_student_id_idx" ON "hostel_outing_requests"("student_id");
ALTER TABLE "hostel_outing_requests" ADD CONSTRAINT "hostel_outing_requests_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hostel_outing_requests" ADD CONSTRAINT "hostel_outing_requests_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
