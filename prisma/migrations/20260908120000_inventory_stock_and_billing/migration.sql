-- Inventory: a new sellable "Stock" catalog (distinct from the existing
-- internal-use Consumables) with both cost and sell price, plus a
-- Billing tab that sells stock against a named consumer and auto-posts
-- an AccountsTransaction (source AUTO_INVENTORY_SALE), same auto-posting
-- pattern as AUTO_FEES/AUTO_PAYROLL/AUTO_INVENTORY_PURCHASE.

ALTER TYPE "TxnSource" ADD VALUE 'AUTO_INVENTORY_SALE';

CREATE TABLE "inventory_stock_items" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "item_type" TEXT,
    "item_code" TEXT,
    "cost_price" DECIMAL(12,2) NOT NULL,
    "sell_price" DECIMAL(12,2) NOT NULL,
    "quantity_on_hand" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "inventory_stock_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "inventory_stock_items_school_id_idx" ON "inventory_stock_items"("school_id");
ALTER TABLE "inventory_stock_items" ADD CONSTRAINT "inventory_stock_items_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "inventory_stock_item_movements" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "stock_item_id" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_stock_item_movements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "inventory_stock_item_movements_school_id_idx" ON "inventory_stock_item_movements"("school_id");
CREATE INDEX "inventory_stock_item_movements_stock_item_id_idx" ON "inventory_stock_item_movements"("stock_item_id");
ALTER TABLE "inventory_stock_item_movements" ADD CONSTRAINT "inventory_stock_item_movements_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_stock_item_movements" ADD CONSTRAINT "inventory_stock_item_movements_stock_item_id_fkey"
  FOREIGN KEY ("stock_item_id") REFERENCES "inventory_stock_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "inventory_sales" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "consumer_name" TEXT NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "sold_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_sales_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "inventory_sales_school_id_idx" ON "inventory_sales"("school_id");
ALTER TABLE "inventory_sales" ADD CONSTRAINT "inventory_sales_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "inventory_sale_items" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "stock_item_id" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "line_total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "inventory_sale_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "inventory_sale_items_school_id_idx" ON "inventory_sale_items"("school_id");
CREATE INDEX "inventory_sale_items_sale_id_idx" ON "inventory_sale_items"("sale_id");
ALTER TABLE "inventory_sale_items" ADD CONSTRAINT "inventory_sale_items_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_sale_items" ADD CONSTRAINT "inventory_sale_items_sale_id_fkey"
  FOREIGN KEY ("sale_id") REFERENCES "inventory_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_sale_items" ADD CONSTRAINT "inventory_sale_items_stock_item_id_fkey"
  FOREIGN KEY ("stock_item_id") REFERENCES "inventory_stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
