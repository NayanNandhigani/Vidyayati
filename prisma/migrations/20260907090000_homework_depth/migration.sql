-- Batch 7 (Homework depth): attachments on the assignment and on the
-- submission (uploaded by the parent, since there's no student login),
-- plus a per-school grace-period setting used only for a display-time
-- "late" computation — the stored SubmissionStatus enum and its manual
-- teacher-cycled toggle are untouched.

ALTER TABLE "homework" ADD COLUMN "attachment_path" TEXT;
ALTER TABLE "homework_submissions" ADD COLUMN "attachment_path" TEXT;
ALTER TABLE "schools" ADD COLUMN "homework_grace_days" INTEGER;
