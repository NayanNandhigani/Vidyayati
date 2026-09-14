import { requireModuleAccess } from "@/lib/permissions";
import BulkImportForm from "./BulkImportForm";

export default async function StockBulkImportPage() {
  await requireModuleAccess("Inventory", "EDIT");
  return (
    <div style={{ padding: "26px 34px" }}>
      <div className="disp" style={{ fontSize: 21, marginBottom: 4 }}>
        Bulk Import Stock Items
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 0, marginBottom: 22 }}>
        Download the template, fill in one row per item, then upload it back here.
      </p>
      <div className="card" style={{ padding: 24, maxWidth: 560 }}>
        <BulkImportForm />
      </div>
    </div>
  );
}
