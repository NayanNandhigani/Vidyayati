-- Batch 17 (UDISE+/compliance): UDISE+ code + affiliation fields on
-- School, an RTE quota field per class section, and a School Admin-side
-- compliance-document tracker (affiliation/recognition/safety
-- certificates with renewal expiry dates) — distinct from the existing
-- Super-Admin-only SchoolDocument model.

ALTER TABLE "schools" ADD COLUMN "udise_code" TEXT;
ALTER TABLE "schools" ADD COLUMN "affiliation_board" TEXT;
ALTER TABLE "schools" ADD COLUMN "affiliation_number" TEXT;

ALTER TABLE "classes" ADD COLUMN "rte_quota_seats" INTEGER;

CREATE TABLE "school_compliance_documents" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "document_no" TEXT,
    "issued_date" TIMESTAMP(3),
    "expiry_date" TIMESTAMP(3),
    "file_path" TEXT,
    "notes" TEXT,

    CONSTRAINT "school_compliance_documents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "school_compliance_documents_school_id_idx" ON "school_compliance_documents"("school_id");
ALTER TABLE "school_compliance_documents" ADD CONSTRAINT "school_compliance_documents_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
