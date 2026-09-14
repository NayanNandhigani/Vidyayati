-- Website Builder: a new "scrolling images" element type — an
-- auto-scrolling strip of images, distinct from a single static IMAGE.

ALTER TYPE "WebsiteElementType" ADD VALUE 'IMAGE_CAROUSEL';

ALTER TABLE "website_elements" ADD COLUMN "images" TEXT[] NOT NULL DEFAULT '{}';
