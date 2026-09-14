-- Architecture V1, Milestone 6 (Attendance/Homework/Timetable adapt to
-- Enrollment), Phase 9 item 77: attendance had no class_id of its own at
-- all — which class a row "belonged to" was only inferable via the
-- student's *current* class_id, so a promotion/reshuffle would silently
-- rewrite which class old attendance appeared to be for. Homework and
-- TimetableSlot already carry their own class_id and needed no change.
--
-- Best-effort backfill: existing rows get the student's current class_id
-- (the only value we have for history that predates this column); every
-- new row going forward is stamped with the class_id actually being
-- marked against (already passed into saveAttendance explicitly), so it
-- stays correct through any later promotion.
ALTER TABLE "attendance" ADD COLUMN "class_id" TEXT;

UPDATE "attendance" a
SET "class_id" = s."class_id"
FROM "students" s
WHERE s."id" = a."student_id";

CREATE INDEX "attendance_class_id_idx" ON "attendance"("class_id");
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
