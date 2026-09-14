-- Batch 16 (Multi-Branch): a Super Admin-only SchoolGroup tag + the
-- cross-school rollup report it feeds — not a new login role, no change
-- to per-school tenant isolation.

CREATE TABLE "school_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "school_groups_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "schools" ADD COLUMN "group_id" TEXT;
ALTER TABLE "schools" ADD CONSTRAINT "schools_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "school_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
