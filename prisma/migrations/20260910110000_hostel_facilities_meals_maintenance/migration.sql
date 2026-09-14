-- Hostel rebuild: room size, per-room toilet/shower facility records, a
-- daily meals-served log (distinct from the existing weekly mess menu
-- plan), and a laundry/maintenance log against rooms or facilities.

ALTER TABLE "hostel_rooms" ADD COLUMN "room_size" TEXT;

CREATE TYPE "HostelFacilityType" AS ENUM ('TOILET', 'SHOWER');

CREATE TABLE "hostel_facilities" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "type" "HostelFacilityType" NOT NULL,
    "label" TEXT,
    "condition" TEXT,

    CONSTRAINT "hostel_facilities_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "hostel_facilities_school_id_idx" ON "hostel_facilities"("school_id");
CREATE INDEX "hostel_facilities_room_id_idx" ON "hostel_facilities"("room_id");
ALTER TABLE "hostel_facilities" ADD CONSTRAINT "hostel_facilities_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hostel_facilities" ADD CONSTRAINT "hostel_facilities_room_id_fkey"
  FOREIGN KEY ("room_id") REFERENCES "hostel_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "hostel_meals_served" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "meal_type" "MealType" NOT NULL,
    "description" TEXT NOT NULL,
    "headcount" INTEGER,

    CONSTRAINT "hostel_meals_served_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "hostel_meals_served_school_id_date_meal_type_key" ON "hostel_meals_served"("school_id", "date", "meal_type");
CREATE INDEX "hostel_meals_served_school_id_idx" ON "hostel_meals_served"("school_id");
ALTER TABLE "hostel_meals_served" ADD CONSTRAINT "hostel_meals_served_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "HostelLogType" AS ENUM ('LAUNDRY', 'MAINTENANCE');
CREATE TYPE "HostelLogStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE');

CREATE TABLE "hostel_maintenance_logs" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "room_id" TEXT,
    "facility_id" TEXT,
    "type" "HostelLogType" NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "status" "HostelLogStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "hostel_maintenance_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "hostel_maintenance_logs_school_id_idx" ON "hostel_maintenance_logs"("school_id");
CREATE INDEX "hostel_maintenance_logs_room_id_idx" ON "hostel_maintenance_logs"("room_id");
CREATE INDEX "hostel_maintenance_logs_facility_id_idx" ON "hostel_maintenance_logs"("facility_id");
ALTER TABLE "hostel_maintenance_logs" ADD CONSTRAINT "hostel_maintenance_logs_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hostel_maintenance_logs" ADD CONSTRAINT "hostel_maintenance_logs_room_id_fkey"
  FOREIGN KEY ("room_id") REFERENCES "hostel_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hostel_maintenance_logs" ADD CONSTRAINT "hostel_maintenance_logs_facility_id_fkey"
  FOREIGN KEY ("facility_id") REFERENCES "hostel_facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
