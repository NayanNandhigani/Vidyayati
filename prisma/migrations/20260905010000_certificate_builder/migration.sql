-- Certificate Builder: label/title move from a fixed per-type lookup
-- (lib/certificates.ts's DEFAULT_TEMPLATE_BODY) onto the row itself, so
-- they're editable, and a new CUSTOM type lets a School Admin define
-- entirely new certificates beyond the original 4. Also adds a per-
-- template logo.

ALTER TYPE "CertificateType" ADD VALUE 'CUSTOM';

ALTER TABLE "certificate_templates" ADD COLUMN "label" TEXT;
ALTER TABLE "certificate_templates" ADD COLUMN "title" TEXT;
ALTER TABLE "certificate_templates" ADD COLUMN "logo_path" TEXT;

-- Backfill existing rows (the 4 built-ins) with the same label/title
-- text lib/certificates.ts's DEFAULT_TEMPLATE_BODY already used, so
-- nothing visibly changes until an admin actually edits one.
UPDATE "certificate_templates" SET "label" = 'Bonafide / Study Certificate', "title" = 'Bonafide Certificate' WHERE "type" = 'BONAFIDE' AND "label" IS NULL;
UPDATE "certificate_templates" SET "label" = 'Transfer Certificate', "title" = 'Transfer Certificate' WHERE "type" = 'TRANSFER' AND "label" IS NULL;
UPDATE "certificate_templates" SET "label" = 'Character Certificate', "title" = 'Character Certificate' WHERE "type" = 'CHARACTER' AND "label" IS NULL;
UPDATE "certificate_templates" SET "label" = 'Achievement Certificate', "title" = 'Achievement Certificate' WHERE "type" = 'ACHIEVEMENT' AND "label" IS NULL;

ALTER TABLE "certificate_templates" ALTER COLUMN "label" SET NOT NULL;
ALTER TABLE "certificate_templates" ALTER COLUMN "title" SET NOT NULL;
