-- AlterTable
ALTER TABLE "users" ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT true;

-- Backfill: accounts that already exist (dev/testing use) shouldn't be
-- retroactively locked out — only accounts created from this point forward
-- (which pick up the column's `true` default) go through the forced reset.
UPDATE "users" SET "must_change_password" = false;
