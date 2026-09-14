-- AlterTable
ALTER TABLE "contracts" DROP COLUMN "plan";

-- AlterTable
ALTER TABLE "schools" DROP COLUMN "plan";

-- DropEnum
DROP TYPE "SchoolPlan";
