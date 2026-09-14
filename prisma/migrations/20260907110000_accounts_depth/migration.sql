-- Batch 9 (Accounts depth): a lightweight school-level chart of accounts
-- (SchoolAccountHead), optional structured tagging on top of the existing
-- free-text category field on AccountsTransaction, and an approval-status
-- column defaulting to NONE — meaning every existing row (and every new
-- row from a school without the feature enabled) behaves exactly as
-- before, counting immediately in every balance/report computation.

CREATE TYPE "AccountHeadType" AS ENUM ('ASSET', 'LIABILITY', 'INCOME', 'EXPENSE');
CREATE TYPE "TxnApprovalStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "school_account_heads" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountHeadType" NOT NULL,

    CONSTRAINT "school_account_heads_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "school_account_heads_school_id_idx" ON "school_account_heads"("school_id");
ALTER TABLE "school_account_heads" ADD CONSTRAINT "school_account_heads_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "accounts_transactions" ADD COLUMN "account_head_id" TEXT;
ALTER TABLE "accounts_transactions" ADD COLUMN "approval_status" "TxnApprovalStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "accounts_transactions" ADD CONSTRAINT "accounts_transactions_account_head_id_fkey"
  FOREIGN KEY ("account_head_id") REFERENCES "school_account_heads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "schools" ADD COLUMN "accounts_approval_threshold" DECIMAL(12,2);
