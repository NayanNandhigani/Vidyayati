-- Fine-grained, per-school "depth feature" toggles — a second, more
-- granular axis alongside the existing schools.disabled_modules (which
-- turns a whole module on/off). This table turns individual sub-features
-- on/off within a module, Super-Admin-only. Additive; nothing existing
-- reads or writes to it yet.

CREATE TABLE "school_feature_flags" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_feature_flags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_feature_flags_school_id_key_key" ON "school_feature_flags"("school_id", "key");
CREATE INDEX "school_feature_flags_school_id_idx" ON "school_feature_flags"("school_id");

ALTER TABLE "school_feature_flags" ADD CONSTRAINT "school_feature_flags_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
