-- Collapse the 4-tier AccessLevel enum (NONE/VIEW/EDIT/FULL) down to a
-- 3-tier one (NONE/VIEW/EDIT). "FULL" never carried any capability beyond
-- EDIT anywhere in the app — every canEdit/canManage check already treated
-- EDIT and FULL identically — so any existing rows holding FULL are
-- converted to EDIT first, then the enum value itself is dropped. Postgres
-- has no ALTER TYPE ... DROP VALUE, so this uses the standard swap-in-a-
-- new-type approach.

-- 1. Any staff/platform-staff permission rows already set to FULL become EDIT.
UPDATE "staff_permissions" SET "access_level" = 'EDIT' WHERE "access_level" = 'FULL';
UPDATE "platform_staff_permissions" SET "access_level" = 'EDIT' WHERE "access_level" = 'FULL';

-- 2. Build the narrower enum type.
CREATE TYPE "AccessLevel_new" AS ENUM ('NONE', 'VIEW', 'EDIT');

-- 3. Swap both columns over to it.
ALTER TABLE "staff_permissions" ALTER COLUMN "access_level" DROP DEFAULT;
ALTER TABLE "staff_permissions" ALTER COLUMN "access_level" TYPE "AccessLevel_new" USING ("access_level"::text::"AccessLevel_new");
ALTER TABLE "staff_permissions" ALTER COLUMN "access_level" SET DEFAULT 'NONE';

ALTER TABLE "platform_staff_permissions" ALTER COLUMN "access_level" DROP DEFAULT;
ALTER TABLE "platform_staff_permissions" ALTER COLUMN "access_level" TYPE "AccessLevel_new" USING ("access_level"::text::"AccessLevel_new");
ALTER TABLE "platform_staff_permissions" ALTER COLUMN "access_level" SET DEFAULT 'NONE';

-- 4. Retire the old type, promote the new one to its name.
DROP TYPE "AccessLevel";
ALTER TYPE "AccessLevel_new" RENAME TO "AccessLevel";
