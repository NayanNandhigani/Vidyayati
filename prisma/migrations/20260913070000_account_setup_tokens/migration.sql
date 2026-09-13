-- Architecture V1, Milestone 1: replace the shared "every account defaults
-- to password 12345" pattern with per-account, one-time setup tokens.
ALTER TABLE "users" ADD COLUMN "setup_token_hash" TEXT;
ALTER TABLE "users" ADD COLUMN "setup_token_expires_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "users_setup_token_hash_key" ON "users"("setup_token_hash");
