import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireModuleAccess } from "@/lib/permissions";
import { getScopedDb } from "@/lib/tenant-db";

// A downloadable .xlsx template matching exactly the fields the bulk-import
// route accepts and the fields the single "+ Add Student" form supports —
// no parity gap between the two entry paths.
export async function GET() {
  try {
    await requireModuleAccess("Students", "EDIT");
  } catch {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const sdb = await getScopedDb();
  const classes = await sdb.class.findMany({ orderBy: [{ grade: "asc" }, { section: "asc" }] });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Students");
  sheet.columns = [
    { header: "Admission No.", key: "admissionNo", width: 16 },
    { header: "First Name", key: "firstName", width: 18 },
    { header: "Surname", key: "surname", width: 18 },
    { header: "Class (Grade-Section)", key: "className", width: 20 },
    { header: "Date of Birth (YYYY-MM-DD)", key: "dob", width: 24 },
    { header: "Gender (MALE/FEMALE/OTHER)", key: "gender", width: 22 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.addRow({ admissionNo: "AD-2050", firstName: "Aarav", surname: "Mehta", className: classes[0] ? `${classes[0].grade}-${classes[0].section}` : "6-A", dob: "2015-04-12", gender: "MALE" });

  const refSheet = workbook.addWorksheet("Valid Classes");
  refSheet.columns = [{ header: "Class (Grade-Section)", key: "className", width: 20 }];
  refSheet.getRow(1).font = { bold: true };
  for (const c of classes) refSheet.addRow({ className: `${c.grade}-${c.section}` });

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="student-import-template.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
