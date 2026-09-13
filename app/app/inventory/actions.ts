"use server";

import { revalidatePath } from "next/cache";
import { Prisma, AssetStatus, PurchaseOrderStatus } from "@prisma/client";
import { auth } from "@/auth";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { requireFeature } from "@/lib/feature-flags";

async function schoolId() {
  const session = await auth();
  return session!.user.schoolId!;
}

async function guard(minimum: "VIEW" | "EDIT" = "EDIT") {
  await requireModuleAccess("Inventory", minimum);
  await requireFeature(await schoolId(), "inventory.module");
}

// ---------------------------------------------------------------- Assets

export async function createAsset(data: {
  name: string;
  category: string | null;
  serialNo: string | null;
  location: string | null;
  purchaseDate: string;
  purchaseCost: number;
  usefulLifeYears: number;
  notes: string | null;
}) {
  await guard();
  const sdb = await getScopedDb();
  await sdb.inventoryAsset.create({
    data: scopedCreateData<Prisma.InventoryAssetUncheckedCreateInput>({
      name: data.name.trim(),
      category: data.category,
      serialNo: data.serialNo,
      location: data.location,
      purchaseDate: new Date(data.purchaseDate),
      purchaseCost: data.purchaseCost,
      usefulLifeYears: data.usefulLifeYears,
      notes: data.notes,
    }),
  });
  revalidatePath("/app/inventory");
}

export async function updateAssetStatus(assetId: string, status: AssetStatus) {
  await guard();
  const sdb = await getScopedDb();
  await sdb.inventoryAsset.update({ where: { id: assetId }, data: { status } });
  revalidatePath("/app/inventory");
}

// ------------------------------------------------------------ Consumables

export async function createConsumable(data: { name: string; category: string | null; unit: string; reorderLevel: number | null }) {
  await guard();
  const sdb = await getScopedDb();
  await sdb.inventoryConsumable.create({
    data: scopedCreateData<Prisma.InventoryConsumableUncheckedCreateInput>({
      name: data.name.trim(),
      category: data.category,
      unit: data.unit.trim(),
      reorderLevel: data.reorderLevel,
      quantityOnHand: 0,
    }),
  });
  revalidatePath("/app/inventory");
}

/** Manual stock adjustment (e.g. a physical recount, or usage not tied to a PO) — writes a movement row and updates the cached running total. */
export async function adjustStock(consumableId: string, type: "IN" | "OUT", quantity: number, note: string | null) {
  await guard();
  if (quantity <= 0) throw new Error("Quantity must be positive.");
  const sdb = await getScopedDb();
  const consumable = await sdb.inventoryConsumable.findUniqueOrThrow({ where: { id: consumableId } });
  if (type === "OUT" && Number(consumable.quantityOnHand) < quantity) {
    throw new Error(`Only ${consumable.quantityOnHand} ${consumable.unit} in stock.`);
  }
  await sdb.$transaction([
    sdb.inventoryStockMovement.create({
      data: scopedCreateData<Prisma.InventoryStockMovementUncheckedCreateInput>({ consumableId, type, quantity, note }),
    }),
    sdb.inventoryConsumable.update({
      where: { id: consumableId },
      data: { quantityOnHand: type === "IN" ? { increment: quantity } : { decrement: quantity } },
    }),
  ]);
  revalidatePath("/app/inventory");
}

// ---------------------------------------------------------------- Vendors

export async function createVendor(data: { name: string; category: string | null; contactName: string | null; phone: string | null; email: string | null }) {
  await guard();
  const sdb = await getScopedDb();
  await sdb.schoolVendor.create({
    data: scopedCreateData<Prisma.SchoolVendorUncheckedCreateInput>({
      name: data.name.trim(),
      category: data.category,
      contactName: data.contactName,
      phone: data.phone,
      email: data.email,
    }),
  });
  revalidatePath("/app/inventory");
}

export async function toggleVendorActive(vendorId: string) {
  await guard();
  const sdb = await getScopedDb();
  const vendor = await sdb.schoolVendor.findUniqueOrThrow({ where: { id: vendorId } });
  await sdb.schoolVendor.update({ where: { id: vendorId }, data: { isActive: !vendor.isActive } });
  revalidatePath("/app/inventory");
}

// --------------------------------------------------------- Purchase orders

export async function createPurchaseOrder(data: {
  poNumber: string;
  vendorId: string;
  consumableId: string | null;
  itemDescription: string;
  quantity: number;
  unitCost: number;
  orderDate: string;
}) {
  await guard();
  const sdb = await getScopedDb();
  await sdb.schoolVendor.findUniqueOrThrow({ where: { id: data.vendorId }, select: { id: true } });
  if (data.consumableId) await sdb.inventoryConsumable.findUniqueOrThrow({ where: { id: data.consumableId }, select: { id: true } });
  await sdb.purchaseOrder.create({
    data: scopedCreateData<Prisma.PurchaseOrderUncheckedCreateInput>({
      poNumber: data.poNumber.trim(),
      vendorId: data.vendorId,
      consumableId: data.consumableId,
      itemDescription: data.itemDescription.trim(),
      quantity: data.quantity,
      unitCost: data.unitCost,
      orderDate: new Date(data.orderDate),
      status: "DRAFT",
    }),
  });
  revalidatePath("/app/inventory");
}

// ------------------------------------------------------------- Stock items

export async function createStockItem(data: { name: string; itemType: string | null; itemCode: string | null; costPrice: number; sellPrice: number; openingQuantity: number }) {
  await guard();
  const sdb = await getScopedDb();
  const item = await sdb.inventoryStockItem.create({
    data: scopedCreateData<Prisma.InventoryStockItemUncheckedCreateInput>({
      name: data.name.trim(),
      itemType: data.itemType,
      itemCode: data.itemCode,
      costPrice: data.costPrice,
      sellPrice: data.sellPrice,
      quantityOnHand: 0,
    }),
  });
  if (data.openingQuantity > 0) {
    await sdb.$transaction([
      sdb.inventoryStockItemMovement.create({
        data: scopedCreateData<Prisma.InventoryStockItemMovementUncheckedCreateInput>({ stockItemId: item.id, type: "IN", quantity: data.openingQuantity, note: "Opening stock" }),
      }),
      sdb.inventoryStockItem.update({ where: { id: item.id }, data: { quantityOnHand: data.openingQuantity } }),
    ]);
  }
  revalidatePath("/app/inventory");
}

/** Add/remove stock for an existing item — same IN/OUT movement-log pattern as adjustStock for Consumables. */
export async function adjustStockItem(stockItemId: string, type: "IN" | "OUT", quantity: number, note: string | null) {
  await guard();
  if (quantity <= 0) throw new Error("Quantity must be positive.");
  const sdb = await getScopedDb();
  const item = await sdb.inventoryStockItem.findUniqueOrThrow({ where: { id: stockItemId } });
  if (type === "OUT" && Number(item.quantityOnHand) < quantity) {
    throw new Error(`Only ${item.quantityOnHand} in stock.`);
  }
  await sdb.$transaction([
    sdb.inventoryStockItemMovement.create({
      data: scopedCreateData<Prisma.InventoryStockItemMovementUncheckedCreateInput>({ stockItemId, type, quantity, note }),
    }),
    sdb.inventoryStockItem.update({
      where: { id: stockItemId },
      data: { quantityOnHand: type === "IN" ? { increment: quantity } : { decrement: quantity } },
    }),
  ]);
  revalidatePath("/app/inventory");
}

export async function updateStockItemPricing(stockItemId: string, costPrice: number, sellPrice: number) {
  await guard();
  if (costPrice < 0 || sellPrice < 0) throw new Error("Prices can't be negative.");
  const sdb = await getScopedDb();
  await sdb.inventoryStockItem.update({ where: { id: stockItemId }, data: { costPrice, sellPrice } });
  revalidatePath("/app/inventory");
}

// ------------------------------------------------------------------ Billing

export type SaleLine = { stockItemId: string; quantity: number };

/**
 * Completes a sale: validates every line's stock up front (all-or-nothing,
 * same discipline as the exam bulk-marks import), writes one OUT movement
 * per line at the item's *current* sellPrice (snapshotted onto the line so
 * a later price edit never rewrites what a past sale actually charged),
 * decrements quantityOnHand, and auto-posts one AccountsTransaction
 * (source AUTO_INVENTORY_SALE, INCOME) for the sale total — same
 * auto-posting pattern as AUTO_FEES/AUTO_PAYROLL/AUTO_INVENTORY_PURCHASE.
 */
export async function createSale(consumerName: string, lines: SaleLine[]): Promise<{ error?: string; saleId?: string }> {
  await guard();
  if (!consumerName.trim()) return { error: "Consumer name is required." };
  if (lines.length === 0) return { error: "Add at least one item to the sale." };

  const sdb = await getScopedDb();
  const items = await sdb.inventoryStockItem.findMany({ where: { id: { in: lines.map((l) => l.stockItemId) } } });
  const itemById = new Map(items.map((i) => [i.id, i]));

  for (const line of lines) {
    if (line.quantity <= 0) return { error: "Every line's quantity must be positive." };
    const item = itemById.get(line.stockItemId);
    if (!item) return { error: "One of the selected items no longer exists." };
    if (Number(item.quantityOnHand) < line.quantity) {
      return { error: `Only ${item.quantityOnHand} of "${item.name}" in stock.` };
    }
  }

  const saleLines = lines.map((l) => {
    const item = itemById.get(l.stockItemId)!;
    const unitPrice = Number(item.sellPrice);
    return { stockItemId: l.stockItemId, quantity: l.quantity, unitPrice, lineTotal: unitPrice * l.quantity, name: item.name };
  });
  const totalAmount = saleLines.reduce((s, l) => s + l.lineTotal, 0);
  const soldAt = new Date();

  // The sale row itself, its line items, the stock decrements, and the
  // accounting entry all need to land together or not at all — an
  // interactive transaction (rather than the array form) since the sale's
  // own id is needed by the writes that follow it.
  const sale = await sdb.$transaction(async (tx) => {
    const sale = await tx.inventorySale.create({
      data: scopedCreateData<Prisma.InventorySaleUncheckedCreateInput>({ consumerName: consumerName.trim(), totalAmount, soldAt }),
    });

    await tx.inventorySaleItem.createMany({
      data: saleLines.map((l) =>
        scopedCreateData<Prisma.InventorySaleItemUncheckedCreateInput>({ saleId: sale.id, stockItemId: l.stockItemId, quantity: l.quantity, unitPrice: l.unitPrice, lineTotal: l.lineTotal })
      ),
    });
    await tx.accountsTransaction.create({
      data: scopedCreateData<Prisma.AccountsTransactionUncheckedCreateInput>({
        date: soldAt,
        description: `Sale to ${consumerName.trim()} — ${saleLines.map((l) => l.name).join(", ")}`,
        category: "Inventory sale",
        source: "AUTO_INVENTORY_SALE",
        type: "INCOME",
        amount: totalAmount,
      }),
    });
    for (const l of saleLines) {
      await tx.inventoryStockItemMovement.create({
        data: scopedCreateData<Prisma.InventoryStockItemMovementUncheckedCreateInput>({ stockItemId: l.stockItemId, type: "OUT", quantity: l.quantity, note: `Sold to ${consumerName.trim()}` }),
      });
      await tx.inventoryStockItem.update({ where: { id: l.stockItemId }, data: { quantityOnHand: { decrement: l.quantity } } });
    }

    return sale;
  });

  revalidatePath("/app/inventory");
  revalidatePath("/app/accounts");
  return { saleId: sale.id };
}

export async function updatePurchaseOrderStatus(poId: string, status: PurchaseOrderStatus) {
  await guard();
  const sdb = await getScopedDb();
  const po = await sdb.purchaseOrder.findUniqueOrThrow({ where: { id: poId }, include: { vendor: true } });

  if (status === "RECEIVED" && po.status !== "RECEIVED") {
    const total = Number(po.quantity) * Number(po.unitCost);
    const receivedDate = new Date();
    const ops: Prisma.PrismaPromise<unknown>[] = [
      sdb.purchaseOrder.update({ where: { id: poId }, data: { status, receivedDate } }),
      sdb.accountsTransaction.create({
        data: scopedCreateData<Prisma.AccountsTransactionUncheckedCreateInput>({
          date: receivedDate,
          description: `Purchase order ${po.poNumber} — ${po.itemDescription} (${po.vendor.name})`,
          category: "Inventory purchase",
          source: "AUTO_INVENTORY_PURCHASE",
          type: "EXPENSE",
          amount: total,
        }),
      }),
    ];
    if (po.consumableId) {
      ops.push(
        sdb.inventoryStockMovement.create({
          data: scopedCreateData<Prisma.InventoryStockMovementUncheckedCreateInput>({
            consumableId: po.consumableId,
            type: "IN",
            quantity: po.quantity,
            note: `PO ${po.poNumber} received`,
          }),
        }),
        sdb.inventoryConsumable.update({ where: { id: po.consumableId }, data: { quantityOnHand: { increment: po.quantity } } })
      );
    }
    await sdb.$transaction(ops);
  } else {
    await sdb.purchaseOrder.update({ where: { id: poId }, data: { status } });
  }

  revalidatePath("/app/inventory");
  revalidatePath("/app/accounts");
}
