-- Architecture V1, Milestone 1 (schema-vs-database verification): these two
-- DB-level defaults were left over from the ADD COLUMN NOT NULL DEFAULT ...
-- backfills in 20260830030000_certificate_rendered_body and
-- 20260907020000_id_card_templates — correct at the time (existing rows
-- needed a value), but never declared in the Prisma schema itself, since
-- every write always sets these fields explicitly. Dropping them so the
-- database exactly mirrors schema.prisma; zero data impact.
ALTER TABLE "certificates_issued" ALTER COLUMN "rendered_body" DROP DEFAULT;
ALTER TABLE "id_card_templates" ALTER COLUMN "updated_at" DROP DEFAULT;
