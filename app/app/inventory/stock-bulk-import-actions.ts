"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { requireFeature } from "@/lib/feature-flags";
import { auth } from "@/auth";

export type StockBulkImportResult = { error?: string; rowErrors?: string[]; createdCount?: number };

/**
 * Parses the uploaded .xlsx (same shape as /api/inventory/stock-import-template)
 * and creates every row as a new InventoryStockItem plus its opening-stock
 * movement, all-or-nothing — same "validate every row before writing any"
 * discipline as the Students bulk import.
 */
export async function bulkImportStockItems(formData: FormData): Promise<StockBulkImportResult> {
  await requireModuleAccess("Inventory", "EDIT");
  const session = await auth();
  await requireFeature(session!.user.schoolId, "inventory.module");
  const sdb = await getScopedDb();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a filled-in .xlsx file to upload." };
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    return { error: "Couldn't read that file — make sure it's the .xlsx template, unmodified in structure." };
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) return { error: "The workbook has no sheet to read." };

  type Row = { name: string; itemType: string | null; itemCode: string | null; costPrice: number; sellPrice: number; openingQuantity: number };
  const rows: Row[] = [];
  const rowErrors: string[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const cell = (i: number) => {
      const v = row.getCell(i).value;
      if (v == null) return "";
      if (typeof v === "object" && "text" in v) return String((v as { text: string }).text).trim();
      if (typeof v === "object" && "result" in v) return String((v as { result: unknown }).result ?? "").trim();
      return String(v).trim();
    };
    const name = cell(1);
    const itemType = cell(2);
    const itemCode = cell(3);
    const costPriceRaw = cell(4);
    const sellPriceRaw = cell(5);
    const openingQuantityRaw = cell(6);

    if (!name && !itemType && !itemCode && !costPriceRaw && !sellPriceRaw) return; // fully blank row, skip silently

    const label = `Row ${rowNumber}`;
    if (!name) return rowErrors.push(`${label}: name is required.`);

    const costPrice = costPriceRaw ? Number(costPriceRaw) : NaN;
    if (!costPriceRaw || Number.isNaN(costPrice) || costPrice < 0) return rowErrors.push(`${label}: cost price "${costPriceRaw}" is not a valid amount.`);

    const sellPrice = sellPriceRaw ? Number(sellPriceRaw) : NaN;
    if (!sellPriceRaw || Number.isNaN(sellPrice) || sellPrice < 0) return rowErrors.push(`${label}: sell price "${sellPriceRaw}" is not a valid amount.`);

    let openingQuantity = 0;
    if (openingQuantityRaw) {
      openingQuantity = Number(openingQuantityRaw);
      if (Number.isNaN(openingQuantity) || openingQuantity < 0) return rowErrors.push(`${label}: opening quantity "${openingQuantityRaw}" is not a valid number.`);
    }

    rows.push({ name, itemType: itemType || null, itemCode: itemCode || null, costPrice, sellPrice, openingQuantity });
  });

  if (rowErrors.length > 0) return { error: `Fix the following and re-upload — nothing was imported:`, rowErrors };
  if (rows.length === 0) return { error: "No stock item rows found in the file." };

  const items = await sdb.inventoryStockItem.createManyAndReturn({
    data: rows.map((r) =>
      scopedCreateData<Prisma.InventoryStockItemUncheckedCreateInput>({
        name: r.name,
        itemType: r.itemType,
        itemCode: r.itemCode,
        costPrice: r.costPrice,
        sellPrice: r.sellPrice,
        quantityOnHand: r.openingQuantity,
      })
    ),
  });

  const withOpeningStock = rows.map((r, i) => ({ ...r, id: items[i].id })).filter((r) => r.openingQuantity > 0);
  if (withOpeningStock.length > 0) {
    await sdb.inventoryStockItemMovement.createMany({
      data: withOpeningStock.map((r) =>
        scopedCreateData<Prisma.InventoryStockItemMovementUncheckedCreateInput>({ stockItemId: r.id, type: "IN", quantity: r.openingQuantity, note: "Opening stock (bulk import)" })
      ),
    });
  }

  revalidatePath("/app/inventory");
  return { createdCount: rows.length };
}
