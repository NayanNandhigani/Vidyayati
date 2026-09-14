-- Batch 13 (Library depth): ISBN per book (for barcode/QR + optional
-- Open Library lookup), a computed per-return fine amount, and the
-- School-level fine-rate configuration that drives it.

ALTER TABLE "library_books" ADD COLUMN "isbn" TEXT;
ALTER TABLE "library_circulation" ADD COLUMN "fine_amount" DECIMAL(10,2);
ALTER TABLE "schools" ADD COLUMN "library_fine_rate_per_day" DECIMAL(10,2);
ALTER TABLE "schools" ADD COLUMN "library_fine_grace_days" INTEGER;

ALTER TYPE "TxnSource" ADD VALUE 'AUTO_LIBRARY_FINE';
