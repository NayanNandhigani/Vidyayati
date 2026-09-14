/*
  Warnings:

  - Added the required column `school_id` to the `grade_bands` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "grade_bands" ADD COLUMN     "school_id" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "grade_bands_school_id_idx" ON "grade_bands"("school_id");

-- AddForeignKey
ALTER TABLE "grade_bands" ADD CONSTRAINT "grade_bands_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
