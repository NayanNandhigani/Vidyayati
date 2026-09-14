-- Exam scheduling now needs a School Admin approval step (Staff-created/
-- edited exams land as PENDING; School-Admin-created/edited exams are
-- auto-APPROVED). Existing rows are grandfathered in as APPROVED by the
-- column default itself.

CREATE TYPE "ExamApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "exams" ADD COLUMN "approval_status" "ExamApprovalStatus" NOT NULL DEFAULT 'APPROVED';
