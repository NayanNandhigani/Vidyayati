-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'SENT', 'SIGNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SchoolDocumentCategory" AS ENUM ('CONTRACT', 'REGISTRATION', 'ID_PROOF', 'OTHER');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'PLATFORM_STAFF';

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "contract_number" TEXT NOT NULL,
    "plan" "SchoolPlan" NOT NULL,
    "billing_cycle" "Recurrence" NOT NULL DEFAULT 'YEARLY',
    "annual_fee" DECIMAL(12,2) NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "terms_body" TEXT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "signatory_name" TEXT,
    "signatory_title" TEXT,
    "signed_date" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_documents" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "SchoolDocumentCategory" NOT NULL DEFAULT 'OTHER',
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_path" TEXT NOT NULL,
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "school_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_staff_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT,
    "department" TEXT,
    "date_joined" TIMESTAMP(3),
    "employment_status" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "platform_staff_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_staff_permissions" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "module_name" TEXT NOT NULL,
    "access_level" "AccessLevel" NOT NULL DEFAULT 'NONE',

    CONSTRAINT "platform_staff_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contracts_contract_number_key" ON "contracts"("contract_number");

-- CreateIndex
CREATE INDEX "contracts_school_id_idx" ON "contracts"("school_id");

-- CreateIndex
CREATE INDEX "school_documents_school_id_idx" ON "school_documents"("school_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_staff_profiles_user_id_key" ON "platform_staff_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_staff_permissions_staff_id_module_name_key" ON "platform_staff_permissions"("staff_id", "module_name");

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_documents" ADD CONSTRAINT "school_documents_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_documents" ADD CONSTRAINT "school_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_staff_profiles" ADD CONSTRAINT "platform_staff_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_staff_permissions" ADD CONSTRAINT "platform_staff_permissions_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "platform_staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
