import { auth } from "@/auth";
import { getScopedDb } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { requireFeature } from "@/lib/feature-flags";
import { formatINR } from "@/lib/format";
import { currentAssetValue } from "@/lib/inventory";
import Link from "next/link";
import {
  AssetForm,
  AssetRow,
  ConsumableForm,
  ConsumableRow,
  StockItemForm,
  StockItemRow,
  BillingPanel,
  VendorForm,
  VendorRow,
  PurchaseOrderForm,
  PurchaseOrderRow,
} from "./InventoryForms";

const TABS = ["assets", "consumables", "stock", "billing", "vendors", "orders"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = { assets: "Assets", consumables: "Consumables", stock: "Stock", billing: "Billing", vendors: "Vendors", orders: "Purchase Orders" };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await auth();
  await requireModuleAccess("Inventory", "VIEW");
  await requireFeature(session!.user.schoolId, "inventory.module");
  const sdb = await getScopedDb();

  const params = await searchParams;
  const tab: Tab = TABS.includes(params.tab as Tab) ? (params.tab as Tab) : "assets";

  const [assets, consumables, stockItems, sales, vendors, purchaseOrders] = await Promise.all([
    sdb.inventoryAsset.findMany({ orderBy: { purchaseDate: "desc" } }),
    sdb.inventoryConsumable.findMany({ orderBy: { name: "asc" } }),
    sdb.inventoryStockItem.findMany({ orderBy: { name: "asc" } }),
    sdb.inventorySale.findMany({ include: { items: true }, orderBy: { soldAt: "desc" }, take: 30 }),
    sdb.schoolVendor.findMany({ orderBy: { name: "asc" } }),
    sdb.purchaseOrder.findMany({ include: { vendor: true }, orderBy: { orderDate: "desc" } }),
  ]);

  const totalAssetValue = assets.reduce((s, a) => s + currentAssetValue(Number(a.purchaseCost), a.usefulLifeYears, a.purchaseDate), 0);
  const lowStockCount = consumables.filter((c) => c.reorderLevel != null && Number(c.quantityOnHand) <= Number(c.reorderLevel)).length;
  const activeVendorCount = vendors.filter((v) => v.isActive).length;
  const openPoCount = purchaseOrders.filter((p) => p.status === "DRAFT" || p.status === "ORDERED").length;
  const stockValue = stockItems.reduce((s, i) => s + Number(i.costPrice) * Number(i.quantityOnHand), 0);
  const todaysSales = sales.filter((s) => s.soldAt.toDateString() === new Date().toDateString());
  const todaysSalesTotal = todaysSales.reduce((s, sale) => s + Number(sale.totalAmount), 0);

  return (
    <div style={{ padding: "26px 34px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="disp" style={{ fontSize: 21 }}>
        Inventory &amp; Assets
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 13 }}>
        <Stat label="Assets — current value" value={formatINR(totalAssetValue)} />
        <Stat label="Consumables to reorder" value={lowStockCount} color={lowStockCount > 0 ? "var(--critical)" : undefined} />
        <Stat label="Stock value (at cost)" value={formatINR(stockValue)} color="var(--marigold-deep)" />
        <Stat label="Today's sales" value={formatINR(todaysSalesTotal)} color="var(--good)" />
        <Stat label="Active vendors" value={activeVendorCount} color="var(--teal)" />
        <Stat label="Open purchase orders" value={openPoCount} color="var(--warn)" />
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid var(--line)" }}>
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/app/inventory?tab=${t}`}
            style={{ padding: "10px 2px", marginRight: 26, fontSize: 13.5, fontWeight: tab === t ? 700 : 600, color: tab === t ? "var(--ink)" : "var(--muted)", borderBottom: tab === t ? "2px solid var(--marigold)" : "2px solid transparent", textDecoration: "none" }}
          >
            {TAB_LABEL[t]}
          </Link>
        ))}
      </div>

      {tab === "assets" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 16 }}>
          <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr 1.1fr", padding: "13px 20px", borderBottom: "1px solid var(--line)", fontSize: 10.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <div>Asset</div>
              <div>Location</div>
              <div>Cost</div>
              <div>Current value</div>
              <div>Purchased</div>
              <div>Status</div>
            </div>
            <div>
              {assets.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>No assets registered yet.</div>}
              {assets.map((a) => (
                <AssetRow
                  key={a.id}
                  asset={{ id: a.id, name: a.name, category: a.category, serialNo: a.serialNo, location: a.location, purchaseDate: a.purchaseDate.toISOString(), purchaseCost: Number(a.purchaseCost), usefulLifeYears: a.usefulLifeYears, status: a.status }}
                />
              ))}
            </div>
          </div>
          <AssetForm />
        </div>
      )}

      {tab === "consumables" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 16 }}>
          <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 0.9fr 1fr 1fr 1.3fr", padding: "13px 20px", borderBottom: "1px solid var(--line)", fontSize: 10.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <div>Item</div>
              <div>Unit</div>
              <div>On hand</div>
              <div>Reorder</div>
              <div>Adjust stock</div>
            </div>
            <div>
              {consumables.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>No consumables tracked yet.</div>}
              {consumables.map((c) => (
                <ConsumableRow key={c.id} item={{ id: c.id, name: c.name, category: c.category, unit: c.unit, quantityOnHand: Number(c.quantityOnHand), reorderLevel: c.reorderLevel != null ? Number(c.reorderLevel) : null }} />
              ))}
            </div>
          </div>
          <ConsumableForm />
        </div>
      )}

      {tab === "stock" && (
        <div style={{ display: "grid", gridTemplateColumns: "2.6fr 1fr", gap: 16 }}>
          <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.7fr 0.6fr 0.6fr 0.5fr 2.1fr", gap: 8, padding: "13px 20px", borderBottom: "1px solid var(--line)", fontSize: 10.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <div>Item</div>
              <div>Type</div>
              <div>Cost (₹)</div>
              <div>Sell (₹)</div>
              <div>On hand</div>
              <div>Add / remove stock</div>
            </div>
            <div>
              {stockItems.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>No stock items added yet.</div>}
              {stockItems.map((i) => (
                <StockItemRow key={i.id} item={{ id: i.id, name: i.name, itemType: i.itemType, itemCode: i.itemCode, costPrice: Number(i.costPrice), sellPrice: Number(i.sellPrice), quantityOnHand: Number(i.quantityOnHand) }} />
              ))}
            </div>
          </div>
          <StockItemForm />
        </div>
      )}

      {tab === "billing" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
          <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1.7fr 1fr 1fr", padding: "13px 20px", borderBottom: "1px solid var(--line)", fontSize: 10.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <div>Consumer</div>
              <div>Items</div>
              <div>Total</div>
              <div>Date</div>
            </div>
            <div style={{ overflowY: "auto" }}>
              {sales.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>No sales recorded yet.</div>}
              {sales.map((s) => (
                <div key={s.id} style={{ display: "grid", gridTemplateColumns: "1.3fr 1.7fr 1fr 1fr", alignItems: "center", padding: "11px 20px", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                  <div style={{ fontWeight: 600 }}>{s.consumerName}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{s.items.length} item{s.items.length === 1 ? "" : "s"}</div>
                  <div className="mono" style={{ fontWeight: 700 }}>{formatINR(Number(s.totalAmount))}</div>
                  <div style={{ fontSize: 11, color: "var(--faint)" }}>{s.soldAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
                </div>
              ))}
            </div>
          </div>
          <BillingPanel items={stockItems.map((i) => ({ id: i.id, name: i.name, sellPrice: Number(i.sellPrice), quantityOnHand: Number(i.quantityOnHand) }))} />
        </div>
      )}

      {tab === "vendors" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 16 }}>
          <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr 0.8fr", padding: "13px 20px", borderBottom: "1px solid var(--line)", fontSize: 10.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <div>Vendor</div>
              <div>Category</div>
              <div>Contact</div>
              <div>Phone/Email</div>
              <div>Status</div>
            </div>
            <div>
              {vendors.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>No vendors added yet.</div>}
              {vendors.map((v) => (
                <VendorRow key={v.id} vendor={{ id: v.id, name: v.name, category: v.category, contactName: v.contactName, phone: v.phone, email: v.email, isActive: v.isActive }} />
              ))}
            </div>
          </div>
          <VendorForm />
        </div>
      )}

      {tab === "orders" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 16 }}>
          <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr 1fr 1fr 1.3fr", padding: "13px 20px", borderBottom: "1px solid var(--line)", fontSize: 10.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <div>PO no.</div>
              <div>Item</div>
              <div>Total</div>
              <div>Ordered</div>
              <div>Status</div>
            </div>
            <div>
              {purchaseOrders.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>No purchase orders yet.</div>}
              {purchaseOrders.map((p) => (
                <PurchaseOrderRow
                  key={p.id}
                  po={{ id: p.id, poNumber: p.poNumber, vendorName: p.vendor.name, itemDescription: p.itemDescription, quantity: Number(p.quantity), unitCost: Number(p.unitCost), status: p.status, orderDate: p.orderDate.toISOString() }}
                />
              ))}
            </div>
          </div>
          <PurchaseOrderForm vendors={vendors.map((v) => ({ id: v.id, name: v.name }))} consumables={consumables.map((c) => ({ id: c.id, name: c.name }))} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="card" style={{ padding: "14px 17px" }}>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 6 }}>{label}</div>
      <div className="mono" style={{ fontSize: 21, fontWeight: 700, color: color ?? "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}
