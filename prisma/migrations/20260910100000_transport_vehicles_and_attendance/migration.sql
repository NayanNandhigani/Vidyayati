-- Transport rebuild: vehicles become their own entity (capacity, driver,
-- insurance/fitness compliance, service log, live location, policy
-- documents — all previously bolted onto TransportRoute), routes keep
-- just name/fee/stops and point at a vehicle, and a new per-day
-- pickup/drop attendance record is added.

CREATE TYPE "VehicleLogType" AS ENUM ('SERVICE', 'INSURANCE_RENEWAL', 'OTHER');

CREATE TABLE "transport_vehicles" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "vehicle_no" TEXT NOT NULL,
    "vehicle_type" TEXT,
    "capacity" INTEGER,
    "make" TEXT,
    "model" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "driver_name" TEXT,
    "driver_phone" TEXT,
    "driver_license_no" TEXT,
    "driver_license_expiry" TIMESTAMP(3),
    "insurance_policy_no" TEXT,
    "insurance_expiry" TIMESTAMP(3),
    "fitness_expiry" TIMESTAMP(3),
    "pollution_cert_expiry" TIMESTAMP(3),
    "last_known_lat" DOUBLE PRECISION,
    "last_known_lng" DOUBLE PRECISION,
    "last_location_at" TIMESTAMP(3),

    CONSTRAINT "transport_vehicles_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "transport_vehicles_school_id_idx" ON "transport_vehicles"("school_id");
ALTER TABLE "transport_vehicles" ADD CONSTRAINT "transport_vehicles_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one vehicle per existing route, reusing the route's own id as
-- the new vehicle's id — a trivial, collision-free way to keep the 1:1
-- correspondence needed for the UPDATE just below, without a procedural
-- loop. Every route today already implicitly "is" one vehicle.
INSERT INTO "transport_vehicles" ("id", "school_id", "vehicle_no", "capacity", "driver_name", "driver_license_no", "driver_license_expiry", "insurance_expiry", "fitness_expiry", "last_known_lat", "last_known_lng", "last_location_at", "is_active")
SELECT "id", "school_id", COALESCE("vehicle_no", 'Unregistered'), "capacity", "driver_name", "driver_license_no", "license_expiry", "insurance_expiry", "fitness_expiry", "last_known_lat", "last_known_lng", "last_location_at", true
FROM "transport_routes";

ALTER TABLE "transport_routes" ADD COLUMN "vehicle_id" TEXT;
UPDATE "transport_routes" SET "vehicle_id" = "id";

CREATE INDEX "transport_routes_vehicle_id_idx" ON "transport_routes"("vehicle_id");
ALTER TABLE "transport_routes" ADD CONSTRAINT "transport_routes_vehicle_id_fkey"
  FOREIGN KEY ("vehicle_id") REFERENCES "transport_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "transport_routes"
  DROP COLUMN "driver_name",
  DROP COLUMN "vehicle_no",
  DROP COLUMN "capacity",
  DROP COLUMN "driver_license_no",
  DROP COLUMN "license_expiry",
  DROP COLUMN "insurance_expiry",
  DROP COLUMN "fitness_expiry",
  DROP COLUMN "last_known_lat",
  DROP COLUMN "last_known_lng",
  DROP COLUMN "last_location_at";

CREATE TABLE "vehicle_logs" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "type" "VehicleLogType" NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "cost" DECIMAL(10,2),
    "odometer_reading" INTEGER,

    CONSTRAINT "vehicle_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "vehicle_logs_school_id_idx" ON "vehicle_logs"("school_id");
CREATE INDEX "vehicle_logs_vehicle_id_idx" ON "vehicle_logs"("vehicle_id");
ALTER TABLE "vehicle_logs" ADD CONSTRAINT "vehicle_logs_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vehicle_logs" ADD CONSTRAINT "vehicle_logs_vehicle_id_fkey"
  FOREIGN KEY ("vehicle_id") REFERENCES "transport_vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "transport_attendance" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "route_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "pickup_at" TIMESTAMP(3),
    "drop_at" TIMESTAMP(3),

    CONSTRAINT "transport_attendance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "transport_attendance_student_id_date_key" ON "transport_attendance"("student_id", "date");
CREATE INDEX "transport_attendance_school_id_idx" ON "transport_attendance"("school_id");
CREATE INDEX "transport_attendance_route_id_idx" ON "transport_attendance"("route_id");
ALTER TABLE "transport_attendance" ADD CONSTRAINT "transport_attendance_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transport_attendance" ADD CONSTRAINT "transport_attendance_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transport_attendance" ADD CONSTRAINT "transport_attendance_route_id_fkey"
  FOREIGN KEY ("route_id") REFERENCES "transport_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Vehicle policy documents (insurance copy, RC, permit, pollution cert,
-- etc.) reuse the existing shared PersonDocument repository — same
-- pattern as Student/Staff documents, just a third optional subject FK.
ALTER TYPE "DocumentSubjectType" ADD VALUE 'VEHICLE';

ALTER TABLE "person_documents" ADD COLUMN "vehicle_id" TEXT;
CREATE INDEX "person_documents_vehicle_id_idx" ON "person_documents"("vehicle_id");
ALTER TABLE "person_documents" ADD CONSTRAINT "person_documents_vehicle_id_fkey"
  FOREIGN KEY ("vehicle_id") REFERENCES "transport_vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
