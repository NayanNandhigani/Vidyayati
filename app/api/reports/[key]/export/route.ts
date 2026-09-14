import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getScopedDb } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { REPORT_KEYS, REPORT_TITLES, getReportData, type ReportKey } from "@/lib/reports";

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  try {
    await requireModuleAccess("Reports", "VIEW");
  } catch {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const { key } = await params;
  if (!REPORT_KEYS.includes(key as ReportKey)) {
    return NextResponse.json({ error: "Unknown report." }, { status: 404 });
  }
  const reportKey = key as ReportKey;

  const sdb = await getScopedDb();
  const { columns, rows } = await getReportData(reportKey, sdb);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(REPORT_TITLES[reportKey].slice(0, 31));
  sheet.columns = columns.map((c) => ({ header: c, key: c, width: Math.max(14, c.length + 4) }));
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) sheet.addRow(row);

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${reportKey}-report.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
