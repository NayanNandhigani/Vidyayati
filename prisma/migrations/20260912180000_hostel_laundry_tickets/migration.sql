CREATE TYPE "LaundryStatus" AS ENUM ('PENDING', 'COLLECTED');

CREATE TABLE "laundry_tickets" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "token_no" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "collection_date" DATE,
    "collected_at" TIMESTAMP(3),
    "status" "LaundryStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "laundry_tickets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "laundry_tickets_school_id_token_no_key" ON "laundry_tickets"("school_id", "token_no");
CREATE INDEX "laundry_tickets_school_id_idx" ON "laundry_tickets"("school_id");
CREATE INDEX "laundry_tickets_student_id_idx" ON "laundry_tickets"("student_id");

ALTER TABLE "laundry_tickets" ADD CONSTRAINT "laundry_tickets_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "laundry_tickets" ADD CONSTRAINT "laundry_tickets_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "laundry_items" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "item_type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "laundry_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "laundry_items_school_id_idx" ON "laundry_items"("school_id");
CREATE INDEX "laundry_items_ticket_id_idx" ON "laundry_items"("ticket_id");

ALTER TABLE "laundry_items" ADD CONSTRAINT "laundry_items_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "laundry_items" ADD CONSTRAINT "laundry_items_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "laundry_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
