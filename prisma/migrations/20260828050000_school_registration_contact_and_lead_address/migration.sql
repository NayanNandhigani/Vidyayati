-- AlterTable
ALTER TABLE "sales_leads" ADD COLUMN     "address_line" TEXT,
ADD COLUMN     "country" TEXT DEFAULT 'India',
ADD COLUMN     "district" TEXT,
ADD COLUMN     "mandal" TEXT,
ADD COLUMN     "postal_code" TEXT,
ADD COLUMN     "state" TEXT;

-- AlterTable
ALTER TABLE "schools" ADD COLUMN     "address_line" TEXT,
ADD COLUMN     "country" TEXT DEFAULT 'India',
ADD COLUMN     "district" TEXT,
ADD COLUMN     "mandal" TEXT,
ADD COLUMN     "postal_code" TEXT,
ADD COLUMN     "registration_number" TEXT;

-- CreateTable
CREATE TABLE "school_contacts" (
    "school_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "alternate_phone" TEXT,
    "email" TEXT,
    "address_line" TEXT,
    "mandal" TEXT,
    "district" TEXT,
    "state" TEXT,
    "country" TEXT DEFAULT 'India',
    "postal_code" TEXT,
    "aadhar_number" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_contacts_pkey" PRIMARY KEY ("school_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "schools_registration_number_key" ON "schools"("registration_number");

-- AddForeignKey
ALTER TABLE "school_contacts" ADD CONSTRAINT "school_contacts_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
