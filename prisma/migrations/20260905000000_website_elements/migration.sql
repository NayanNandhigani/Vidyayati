-- Website Builder: replace the fixed WebsiteSettings fields and the
-- WebsiteSection block list with one freeform, absolutely-positioned
-- WebsiteElement per visible thing on the site (logo, headings, body
-- text, images, buttons, contact lines) — the live preview itself
-- becomes the one editing surface (drag/resize/inline-edit), rather than
-- a separate settings form. Existing content is migrated into elements
-- before the old columns/table are dropped, so nothing is lost; default
-- x/y positions are just a reasonable starting stack — the whole point
-- of this feature is that they can be dragged apart afterward.

CREATE TYPE "WebsiteElementType" AS ENUM ('TEXT', 'IMAGE', 'BUTTON');

CREATE TABLE "website_elements" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "type" "WebsiteElementType" NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "z_index" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "text" TEXT,
    "href" TEXT,
    "image_path" TEXT,
    "font_size" INTEGER,
    "color" TEXT,
    "background_color" TEXT,

    CONSTRAINT "website_elements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "website_elements_school_id_idx" ON "website_elements"("school_id");

ALTER TABLE "website_elements" ADD CONSTRAINT "website_elements_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Logo -> IMAGE element
INSERT INTO "website_elements" ("id", "school_id", "type", "x", "y", "width", "height", "image_path")
SELECT gen_random_uuid()::text, "school_id", 'IMAGE', 40, 20, 64, 64, "logo_url"
FROM "website_settings"
WHERE "logo_url" IS NOT NULL AND "logo_url" <> '';

-- Tagline -> TEXT element
INSERT INTO "website_elements" ("id", "school_id", "type", "x", "y", "width", "height", "text", "font_size")
SELECT gen_random_uuid()::text, "school_id", 'TEXT', 40, 100, 600, 40, "tagline", 16
FROM "website_settings"
WHERE "tagline" IS NOT NULL AND "tagline" <> '';

-- Admissions CTA -> BUTTON element
INSERT INTO "website_elements" ("id", "school_id", "type", "x", "y", "width", "height", "text", "href", "background_color")
SELECT gen_random_uuid()::text, "school_id", 'BUTTON', 40, 160, 220, 48, COALESCE(NULLIF("cta_text", ''), 'Apply for Admission'), '#contact', COALESCE("theme_color", '#e08a2c')
FROM "website_settings"
WHERE "hero_visible" IS NOT FALSE;

-- Contact lines -> one TEXT element each
INSERT INTO "website_elements" ("id", "school_id", "type", "x", "y", "width", "height", "text", "font_size")
SELECT gen_random_uuid()::text, "school_id", 'TEXT', 40, 230, 500, 30, "contact_address", 13
FROM "website_settings"
WHERE "contact_address" IS NOT NULL AND "contact_address" <> '' AND "contact_visible" IS NOT FALSE;

INSERT INTO "website_elements" ("id", "school_id", "type", "x", "y", "width", "height", "text", "font_size")
SELECT gen_random_uuid()::text, "school_id", 'TEXT', 40, 270, 500, 30, "contact_phone", 13
FROM "website_settings"
WHERE "contact_phone" IS NOT NULL AND "contact_phone" <> '' AND "contact_visible" IS NOT FALSE;

INSERT INTO "website_elements" ("id", "school_id", "type", "x", "y", "width", "height", "text", "font_size")
SELECT gen_random_uuid()::text, "school_id", 'TEXT', 40, 310, 500, 30, "contact_email", 13
FROM "website_settings"
WHERE "contact_email" IS NOT NULL AND "contact_email" <> '' AND "contact_visible" IS NOT FALSE;

-- Each WebsiteSection's heading -> its own TEXT element, stacked below
-- the fixed fields above by its `order` (leaves generous vertical room
-- per section for the body + gallery that follow it).
INSERT INTO "website_elements" ("id", "school_id", "type", "x", "y", "width", "height", "text", "font_size")
SELECT gen_random_uuid()::text, "school_id", 'TEXT', 40, 380 + ("order" * 260), 600, 30, "heading", 20
FROM "website_sections";

-- Each WebsiteSection's body -> its own TEXT element, just below its heading.
INSERT INTO "website_elements" ("id", "school_id", "type", "x", "y", "width", "height", "text", "font_size")
SELECT gen_random_uuid()::text, "school_id", 'TEXT', 40, 380 + ("order" * 260) + 40, 700, 100, "body", 14
FROM "website_sections"
WHERE "body" IS NOT NULL AND "body" <> '';

-- Each image in a section's images[] -> its own IMAGE element, laid out
-- left-to-right below that section's body.
INSERT INTO "website_elements" ("id", "school_id", "type", "x", "y", "width", "height", "image_path")
SELECT gen_random_uuid()::text, ws."school_id", 'IMAGE',
       40 + (idx - 1) * 170, 380 + (ws."order" * 260) + 150, 160, 140, img
FROM "website_sections" ws, LATERAL unnest(ws."images") WITH ORDINALITY AS t(img, idx)
WHERE array_length(ws."images", 1) > 0;

DROP TABLE "website_sections";

ALTER TABLE "website_settings" DROP COLUMN "tagline";
ALTER TABLE "website_settings" DROP COLUMN "logo_url";
ALTER TABLE "website_settings" DROP COLUMN "cta_text";
ALTER TABLE "website_settings" DROP COLUMN "contact_address";
ALTER TABLE "website_settings" DROP COLUMN "contact_phone";
ALTER TABLE "website_settings" DROP COLUMN "contact_email";
ALTER TABLE "website_settings" DROP COLUMN "hero_visible";
ALTER TABLE "website_settings" DROP COLUMN "contact_visible";
ALTER TABLE "website_settings" RENAME COLUMN "theme_color" TO "canvas_background";
