-- Batch 12 (Transport depth): driver/vehicle compliance-expiry fields, a
-- manually-updated "last known location" ping (no GPS device/mobile app
-- exists to push real telemetry), and a flat per-route transport fee.

ALTER TABLE "transport_routes" ADD COLUMN "driver_license_no" TEXT;
ALTER TABLE "transport_routes" ADD COLUMN "license_expiry" TIMESTAMP(3);
ALTER TABLE "transport_routes" ADD COLUMN "insurance_expiry" TIMESTAMP(3);
ALTER TABLE "transport_routes" ADD COLUMN "fitness_expiry" TIMESTAMP(3);
ALTER TABLE "transport_routes" ADD COLUMN "last_known_lat" DOUBLE PRECISION;
ALTER TABLE "transport_routes" ADD COLUMN "last_known_lng" DOUBLE PRECISION;
ALTER TABLE "transport_routes" ADD COLUMN "last_location_at" TIMESTAMP(3);
ALTER TABLE "transport_routes" ADD COLUMN "fee_amount" DECIMAL(10,2);
