import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireModuleAccess } from "@/lib/permissions";

// A downloadable .xlsx template matching exactly the fields the stock
// bulk-import action accepts and the fields the single "Add stock item"
// form supports — no parity gap between the two entry paths (same
// approach as /api/students/import-template).
export async function GET() {
  try {
    await requireModuleAccess("Inventory", "EDIT");
  } catch {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Stock Items");
  sheet.columns = [
    { header: "Name", key: "name", width: 26 },
    { header: "Item Type", key: "itemType", width: 18 },
    { header: "Item Code", key: "itemCode", width: 16 },
    { header: "Cost Price", key: "costPrice", width: 14 },
    { header: "Sell Price", key: "sellPrice", width: 14 },
    { header: "Opening Quantity", key: "openingQuantity", width: 18 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.addRow({ name: "School diary", itemType: "Stationery", itemCode: "SKU-1001", costPrice: 60, sellPrice: 90, openingQuantity: 100 });

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="stock-item-import-template.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
