-- Website Builder: real per-section content fields, replacing the
-- hardcoded boilerplate the old preview mockup used.

ALTER TABLE "website_settings" ADD COLUMN "about_text" TEXT;
ALTER TABLE "website_settings" ADD COLUMN "cta_text" TEXT;
ALTER TABLE "website_settings" ADD COLUMN "contact_address" TEXT;
ALTER TABLE "website_settings" ADD COLUMN "contact_phone" TEXT;
ALTER TABLE "website_settings" ADD COLUMN "contact_email" TEXT;
ALTER TABLE "website_settings" ADD COLUMN "gallery_images" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "website_settings" ADD COLUMN "featured_staff_ids" TEXT[] NOT NULL DEFAULT '{}';
