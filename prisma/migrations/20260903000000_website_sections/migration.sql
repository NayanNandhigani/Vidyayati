-- Website Builder: replace the fixed About/Gallery/Faculty fields on
-- website_settings with a dynamic, orderable website_sections list.
-- Faculty is dropped outright (explicit ask); About/Gallery content is
-- migrated into the new table before the old columns are dropped, so no
-- existing content is lost.

CREATE TABLE "website_sections" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "heading" TEXT NOT NULL,
    "body" TEXT,
    "images" TEXT[] NOT NULL DEFAULT '{}',

    CONSTRAINT "website_sections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "website_sections_school_id_idx" ON "website_sections"("school_id");

ALTER TABLE "website_sections" ADD CONSTRAINT "website_sections_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing About text into a section.
INSERT INTO "website_sections" ("id", "school_id", "order", "visible", "heading", "body", "images")
SELECT gen_random_uuid()::text, "school_id", 0, true, 'About us', "about_text", '{}'
FROM "website_settings"
WHERE "about_text" IS NOT NULL AND "about_text" <> '';

-- Migrate existing gallery images into a section.
INSERT INTO "website_sections" ("id", "school_id", "order", "visible", "heading", "body", "images")
SELECT gen_random_uuid()::text, "school_id", 1, true, 'Gallery', NULL, "gallery_images"
FROM "website_settings"
WHERE "gallery_images" IS NOT NULL AND array_length("gallery_images", 1) > 0;

ALTER TABLE "website_settings" DROP COLUMN "about_text";
ALTER TABLE "website_settings" DROP COLUMN "gallery_images";
ALTER TABLE "website_settings" DROP COLUMN "featured_staff_ids";
ALTER TABLE "website_settings" DROP COLUMN "section_visibility";

ALTER TABLE "website_settings" ADD COLUMN "hero_visible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "website_settings" ADD COLUMN "contact_visible" BOOLEAN NOT NULL DEFAULT true;
