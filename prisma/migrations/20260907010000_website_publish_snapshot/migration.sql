-- Website Builder: an explicit Publish step. The editor keeps working
-- against the live website_elements rows; the public site instead reads
-- this JSON snapshot, updated only when the admin clicks "Publish".

ALTER TABLE "website_settings" ADD COLUMN "published_snapshot" JSONB;
ALTER TABLE "website_settings" ADD COLUMN "published_at" TIMESTAMP(3);
