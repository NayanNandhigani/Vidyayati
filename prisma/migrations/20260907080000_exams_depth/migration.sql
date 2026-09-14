-- Batch 6 (Exams depth): scheduled result release + fee-clearance lock,
-- and exam seating (reuses the Room model from Batch 4). Bulk marks
-- import needs no schema — it's a CSV parsed straight into existing Mark
-- rows in application code.

ALTER TABLE "exams" ADD COLUMN "result_release_at" TIMESTAMP(3);
ALTER TABLE "schools" ADD COLUMN "results_lock_until_fees_cleared" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "exam_seatings" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "exam_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "room_id" TEXT,
    "seat_no" INTEGER NOT NULL,

    CONSTRAINT "exam_seatings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "exam_seatings_exam_id_student_id_key" ON "exam_seatings"("exam_id", "student_id");
CREATE INDEX "exam_seatings_school_id_idx" ON "exam_seatings"("school_id");
ALTER TABLE "exam_seatings" ADD CONSTRAINT "exam_seatings_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exam_seatings" ADD CONSTRAINT "exam_seatings_exam_id_fkey"
  FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exam_seatings" ADD CONSTRAINT "exam_seatings_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exam_seatings" ADD CONSTRAINT "exam_seatings_room_id_fkey"
  FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
