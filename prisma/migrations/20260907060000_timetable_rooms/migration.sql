-- Batch 4 (Timetable depth): a Room model and an optional room_id on
-- timetable_slots (null for every existing row — unaffected), plus
-- teacher double-booking conflict detection lives entirely in
-- application code (app/app/timetable/depth-actions.ts), no schema
-- needed for that part.

CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER,
    "equipment_note" TEXT,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "rooms_school_id_idx" ON "rooms"("school_id");
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "timetable_slots" ADD COLUMN "room_id" TEXT;
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_room_id_fkey"
  FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
