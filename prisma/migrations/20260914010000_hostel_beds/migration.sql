-- Hostel Management Phase 1, Part A: bed-level allocation, additive.
-- HostelRoom stays the main unit (capacity as before); HostelBed is a new
-- parallel layer of individual beds under each room, and
-- hostel_allocations.bed_id is nullable so a room with no beds still
-- allocates at the room level exactly as before this migration.
CREATE TABLE "hostel_beds" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "bed_no" TEXT NOT NULL,

    CONSTRAINT "hostel_beds_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hostel_beds_room_id_bed_no_key" ON "hostel_beds"("room_id", "bed_no");
CREATE INDEX "hostel_beds_school_id_idx" ON "hostel_beds"("school_id");

ALTER TABLE "hostel_beds" ADD CONSTRAINT "hostel_beds_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hostel_beds" ADD CONSTRAINT "hostel_beds_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "hostel_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hostel_allocations" ADD COLUMN "bed_id" TEXT;
CREATE UNIQUE INDEX "hostel_allocations_bed_id_key" ON "hostel_allocations"("bed_id");
ALTER TABLE "hostel_allocations" ADD CONSTRAINT "hostel_allocations_bed_id_fkey" FOREIGN KEY ("bed_id") REFERENCES "hostel_beds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: one bed per capacity-slot for every existing room.
INSERT INTO "hostel_beds" ("id", "school_id", "room_id", "bed_no")
SELECT gen_random_uuid()::text, r."school_id", r."id", gs::text
FROM "hostel_rooms" r, generate_series(1, r."capacity") AS gs;

-- Backfill: assign each existing allocation the lowest-numbered
-- unassigned bed in its room, ordered by date_from (earliest allocation
-- gets bed "1", etc.) — deterministic, no data loss.
WITH ranked_allocations AS (
  SELECT "id", "room_id",
         ROW_NUMBER() OVER (PARTITION BY "room_id" ORDER BY "date_from" ASC, "id" ASC) AS rn
  FROM "hostel_allocations"
),
ranked_beds AS (
  SELECT "id" AS bed_id, "room_id",
         ROW_NUMBER() OVER (PARTITION BY "room_id" ORDER BY "bed_no"::int ASC) AS rn
  FROM "hostel_beds"
)
UPDATE "hostel_allocations" a
SET "bed_id" = rb.bed_id
FROM ranked_allocations ra
JOIN ranked_beds rb ON rb."room_id" = ra."room_id" AND rb.rn = ra.rn
WHERE a."id" = ra."id";
