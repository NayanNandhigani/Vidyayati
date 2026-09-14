-- Batch 14 (Inventory & Assets — new module): asset register with
-- computed (not stored) depreciation, consumable stock + reorder alerts
-- with an IN/OUT movement log, a school-level vendor list, and purchase
-- orders that auto-post to AccountsTransaction and auto-restock a linked
-- consumable on receipt. Entirely gated behind requireFeature("inventory.module").

CREATE TYPE "AssetStatus" AS ENUM ('IN_USE', 'IN_STORAGE', 'UNDER_REPAIR', 'DISPOSED');

CREATE TABLE "inventory_assets" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "serial_no" TEXT,
    "location" TEXT,
    "purchase_date" TIMESTAMP(3) NOT NULL,
    "purchase_cost" DECIMAL(12,2) NOT NULL,
    "useful_life_years" INTEGER NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'IN_USE',
    "notes" TEXT,

    CONSTRAINT "inventory_assets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "inventory_assets_school_id_idx" ON "inventory_assets"("school_id");
ALTER TABLE "inventory_assets" ADD CONSTRAINT "inventory_assets_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "inventory_consumables" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "unit" TEXT NOT NULL,
    "quantity_on_hand" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "reorder_level" DECIMAL(12,2),

    CONSTRAINT "inventory_consumables_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "inventory_consumables_school_id_idx" ON "inventory_consumables"("school_id");
ALTER TABLE "inventory_consumables" ADD CONSTRAINT "inventory_consumables_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "StockMovementType" AS ENUM ('IN', 'OUT');

CREATE TABLE "inventory_stock_movements" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "consumable_id" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_stock_movements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "inventory_stock_movements_school_id_idx" ON "inventory_stock_movements"("school_id");
CREATE INDEX "inventory_stock_movements_consumable_id_idx" ON "inventory_stock_movements"("consumable_id");
ALTER TABLE "inventory_stock_movements" ADD CONSTRAINT "inventory_stock_movements_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_stock_movements" ADD CONSTRAINT "inventory_stock_movements_consumable_id_fkey"
  FOREIGN KEY ("consumable_id") REFERENCES "inventory_consumables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "school_vendors" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "contact_name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "school_vendors_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "school_vendors_school_id_idx" ON "school_vendors"("school_id");
ALTER TABLE "school_vendors" ADD CONSTRAINT "school_vendors_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED');

CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "po_number" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "consumable_id" TEXT,
    "item_description" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unit_cost" DECIMAL(12,2) NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "order_date" TIMESTAMP(3) NOT NULL,
    "received_date" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "purchase_orders_school_id_idx" ON "purchase_orders"("school_id");
CREATE INDEX "purchase_orders_vendor_id_idx" ON "purchase_orders"("vendor_id");
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendor_id_fkey"
  FOREIGN KEY ("vendor_id") REFERENCES "school_vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_consumable_id_fkey"
  FOREIGN KEY ("consumable_id") REFERENCES "inventory_consumables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TYPE "TxnSource" ADD VALUE 'AUTO_INVENTORY_PURCHASE';
