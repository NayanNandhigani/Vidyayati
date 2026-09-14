-- AlterTable
ALTER TABLE "schools" ADD COLUMN     "disabled_modules" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "login_blocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "max_staff" INTEGER,
ADD COLUMN     "max_students" INTEGER;
