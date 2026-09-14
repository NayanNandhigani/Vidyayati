-- ID Card Templates: replace the fixed 3-preset color picker with a real
-- freeform canvas-editor template (same element architecture as the
-- Website Builder), plus a photo_path on Student/StaffProfile so a
-- template's PHOTO slot has real per-person data to pull from.

CREATE TYPE "IdCardAudience" AS ENUM ('STUDENT', 'STAFF');
CREATE TYPE "IdCardOrientation" AS ENUM ('HORIZONTAL', 'VERTICAL');
CREATE TYPE "IdCardElementType" AS ENUM ('TEXT', 'IMAGE', 'PHOTO', 'SHAPE');

-- The old templates only ever held a {key,label,gradient} preset — no
-- real content worth preserving into the new element-based shape.
ALTER TABLE "id_card_templates" DROP COLUMN "layout_config";

ALTER TABLE "id_card_templates" ADD COLUMN "name" TEXT NOT NULL DEFAULT 'Untitled template';
ALTER TABLE "id_card_templates" ADD COLUMN "audience" "IdCardAudience" NOT NULL DEFAULT 'STUDENT';
ALTER TABLE "id_card_templates" ADD COLUMN "orientation" "IdCardOrientation" NOT NULL DEFAULT 'HORIZONTAL';
ALTER TABLE "id_card_templates" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "id_card_templates" ADD COLUMN "background_color" TEXT;
ALTER TABLE "id_card_templates" ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "id_card_templates" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "id_card_elements" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "type" "IdCardElementType" NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "z_index" INTEGER NOT NULL DEFAULT 0,
    "text" TEXT,
    "image_path" TEXT,
    "font_size" INTEGER,
    "font_family" TEXT,
    "font_weight" INTEGER,
    "italic" BOOLEAN NOT NULL DEFAULT false,
    "text_align" TEXT,
    "color" TEXT,
    "background_color" TEXT,
    "shape_kind" TEXT,
    "border_color" TEXT,
    "border_width" INTEGER,
    "border_radius" INTEGER,

    CONSTRAINT "id_card_elements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "id_card_elements_template_id_idx" ON "id_card_elements"("template_id");

ALTER TABLE "id_card_elements" ADD CONSTRAINT "id_card_elements_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "id_card_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "students" ADD COLUMN "photo_path" TEXT;
ALTER TABLE "staff_profiles" ADD COLUMN "photo_path" TEXT;
