-- Website Builder: richer per-element typography (font family/weight/
-- italic/alignment), a background color usable on any element (not just
-- BUTTON), and a new SHAPE element type (rectangle/circle, with its own
-- fill/border) for decorative blocks.

ALTER TYPE "WebsiteElementType" ADD VALUE 'SHAPE';

ALTER TABLE "website_elements" ADD COLUMN "font_family" TEXT;
ALTER TABLE "website_elements" ADD COLUMN "font_weight" INTEGER;
ALTER TABLE "website_elements" ADD COLUMN "italic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "website_elements" ADD COLUMN "text_align" TEXT;
ALTER TABLE "website_elements" ADD COLUMN "shape_kind" TEXT;
ALTER TABLE "website_elements" ADD COLUMN "border_color" TEXT;
ALTER TABLE "website_elements" ADD COLUMN "border_width" INTEGER;
ALTER TABLE "website_elements" ADD COLUMN "border_radius" INTEGER;
