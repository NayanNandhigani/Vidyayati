-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('REFERRAL', 'WEBSITE', 'COLD_OUTREACH', 'EVENT', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('NEW', 'CONTACTED', 'DEMO_SCHEDULED', 'DEMO_DONE', 'PROPOSAL_SENT', 'NEGOTIATION', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "SalesActivityType" AS ENUM ('CALL', 'MEETING', 'EMAIL', 'TASK');

-- CreateTable
CREATE TABLE "sales_leads" (
    "id" TEXT NOT NULL,
    "school_name_proposed" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "contact_email" TEXT,
    "source" "LeadSource" NOT NULL,
    "stage" "LeadStage" NOT NULL DEFAULT 'NEW',
    "estimated_value" DECIMAL(10,2),
    "expected_close_date" TIMESTAMP(3),
    "relationship_manager" TEXT,
    "lost_reason" TEXT,
    "converted_school_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_activities" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT,
    "school_id" TEXT,
    "type" "SalesActivityType" NOT NULL,
    "notes" TEXT NOT NULL,
    "due_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_leads_converted_school_id_key" ON "sales_leads"("converted_school_id");

-- CreateIndex
CREATE INDEX "sales_activities_lead_id_idx" ON "sales_activities"("lead_id");

-- CreateIndex
CREATE INDEX "sales_activities_school_id_idx" ON "sales_activities"("school_id");

-- AddForeignKey
ALTER TABLE "sales_leads" ADD CONSTRAINT "sales_leads_converted_school_id_fkey" FOREIGN KEY ("converted_school_id") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_activities" ADD CONSTRAINT "sales_activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "sales_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_activities" ADD CONSTRAINT "sales_activities_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
