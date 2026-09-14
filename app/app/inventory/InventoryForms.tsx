"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { formatINR } from "@/lib/format";
import { currentAssetValue } from "@/lib/inventory";
import {
  createAsset,
  updateAssetStatus,
  createConsumable,
  adjustStock,
  createVendor,
  toggleVendorActive,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
  createStockItem,
  adjustStockItem,
  updateStockItemPricing,
  createSale,
  type SaleLine,
} from "./actions";

const ASSET_STATUSES = ["IN_USE", "IN_STORAGE", "UNDER_REPAIR", "DISPOSED"] as const;
const STATUS_LABEL: Record<string, string> = { IN_USE: "In use", IN_STORAGE: "In storage", UNDER_REPAIR: "Under repair", DISPOSED: "Disposed" };
const STATUS_COLOR: Record<string, string> = { IN_USE: "var(--good)", IN_STORAGE: "var(--info)", UNDER_REPAIR: "var(--warn)", DISPOSED: "var(--critical)" };

function Field({ children }: { children: React.ReactNode }) {
  return <label className="field">{children}</label>;
}

// ------------------------------------------------------------------ Assets

export function AssetForm() {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", category: "", serialNo: "", location: "", purchaseDate: "", purchaseCost: "", usefulLifeYears: "" });
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!form.name.trim() || !form.purchaseDate || !form.purchaseCost || !form.usefulLifeYears) {
      setError("Name, purchase date, cost, and useful life are required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      await createAsset({
        name: form.name,
        category: form.category || null,
        serialNo: form.serialNo || null,
        location: form.location || null,
        purchaseDate: form.purchaseDate,
        purchaseCost: Number(form.purchaseCost),
        usefulLifeYears: Number(form.usefulLifeYears),
        notes: null,
      });
      setForm({ name: "", category: "", serialNo: "", location: "", purchaseDate: "", purchaseCost: "", usefulLifeYears: "" });
    });
  }

  return (
    <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700 }}>Add asset</div>
      <Field>
        Name
        <input className="in" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Projector — Room 4B" />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field>
          Category
          <input className="in" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Electronics" />
        </Field>
        <Field>
          Serial no.
          <input className="in mono" value={form.serialNo} onChange={(e) => setForm({ ...form, serialNo: e.target.value })} placeholder="SN-88213" />
        </Field>
      </div>
      <Field>
        Location
        <input className="in" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Block A, Room 4B" />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <Field>
          Purchase date
          <input className="in mono" type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} />
        </Field>
        <Field>
          Cost (₹)
          <input className="in mono" type="number" min={0} value={form.purchaseCost} onChange={(e) => setForm({ ...form, purchaseCost: e.target.value })} placeholder="45000" />
        </Field>
        <Field>
          Useful life (yrs)
          <input className="in mono" type="number" min={1} value={form.usefulLifeYears} onChange={(e) => setForm({ ...form, usefulLifeYears: e.target.value })} placeholder="5" />
        </Field>
      </div>
      {error && <div style={{ color: "var(--critical)", fontSize: 12 }}>{error}</div>}
      <button type="button" onClick={submit} disabled={pending} style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 0", fontSize: 13, fontWeight: 700, cursor: pending ? "default" : "pointer" }}>
        {pending ? "Adding…" : "Add asset"}
      </button>
    </div>
  );
}

export function AssetRow({ asset }: { asset: { id: string; name: string; category: string | null; serialNo: string | null; location: string | null; purchaseDate: string; purchaseCost: number; usefulLifeYears: number; status: string } }) {
  const [, startTransition] = useTransition();
  const value = currentAssetValue(asset.purchaseCost, asset.usefulLifeYears, asset.purchaseDate);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr 1.1fr", alignItems: "center", padding: "11px 20px", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
      <div>
        <div style={{ fontWeight: 600 }}>{asset.name}</div>
        <div style={{ fontSize: 10.5, color: "var(--faint)" }}>{[asset.category, asset.serialNo].filter(Boolean).join(" · ") || "—"}</div>
      </div>
      <div style={{ color: "var(--muted)" }}>{asset.location ?? "—"}</div>
      <div className="mono" style={{ color: "var(--muted)" }}>{formatINR(asset.purchaseCost)}</div>
      <div className="mono" style={{ fontWeight: 600 }}>{formatINR(value)}</div>
      <div style={{ fontSize: 10.5, color: "var(--faint)" }}>{new Date(asset.purchaseDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
      <select
        className="in"
        value={asset.status}
        onChange={(e) => startTransition(() => updateAssetStatus(asset.id, e.target.value as (typeof ASSET_STATUSES)[number]))}
        style={{ fontSize: 11.5, padding: "4px 6px", color: STATUS_COLOR[asset.status], fontWeight: 700 }}
      >
        {ASSET_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
    </div>
  );
}

// -------------------------------------------------------------- Consumables

export function ConsumableForm() {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", category: "", unit: "", reorderLevel: "" });

  function submit() {
    if (!form.name.trim() || !form.unit.trim()) return;
    startTransition(async () => {
      await createConsumable({ name: form.name, category: form.category || null, unit: form.unit, reorderLevel: form.reorderLevel ? Number(form.reorderLevel) : null });
      setForm({ name: "", category: "", unit: "", reorderLevel: "" });
    });
  }

  return (
    <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700 }}>Add consumable</div>
      <Field>
        Name
        <input className="in" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="A4 paper (ream)" />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <Field>
          Category
          <input className="in" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Stationery" />
        </Field>
        <Field>
          Unit
          <input className="in" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="ream" />
        </Field>
        <Field>
          Reorder level
          <input className="in mono" type="number" min={0} value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} placeholder="20" />
        </Field>
      </div>
      <button type="button" onClick={submit} disabled={pending} style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 0", fontSize: 13, fontWeight: 700, cursor: pending ? "default" : "pointer" }}>
        {pending ? "Adding…" : "Add consumable"}
      </button>
    </div>
  );
}

export function ConsumableRow({ item }: { item: { id: string; name: string; category: string | null; unit: string; quantityOnHand: number; reorderLevel: number | null } }) {
  const [pending, startTransition] = useTransition();
  const [qty, setQty] = useState("");
  const lowStock = item.reorderLevel != null && item.quantityOnHand <= item.reorderLevel;

  function move(type: "IN" | "OUT") {
    const n = Number(qty);
    if (!n || n <= 0) return;
    startTransition(async () => {
      try {
        await adjustStock(item.id, type, n, null);
        setQty("");
      } catch {
        /* server action's error message isn't easily surfaced here without a message slot; a failed OUT (insufficient stock) simply leaves the quantity field as typed for the user to correct */
      }
    });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.6fr 0.9fr 1fr 1fr 1.3fr", alignItems: "center", padding: "11px 20px", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
      <div>
        <div style={{ fontWeight: 600 }}>{item.name}</div>
        <div style={{ fontSize: 10.5, color: "var(--faint)" }}>{item.category ?? "—"}</div>
      </div>
      <div style={{ color: "var(--muted)" }}>{item.unit}</div>
      <div className="mono" style={{ fontWeight: 700, color: lowStock ? "var(--critical)" : undefined }}>{item.quantityOnHand}</div>
      <div>
        {lowStock ? (
          <span className="pill" style={{ background: "var(--critical-tint)", color: "var(--critical)" }}>
            Reorder (≤{item.reorderLevel})
          </span>
        ) : item.reorderLevel != null ? (
          <span className="pill" style={{ background: "var(--good-tint)", color: "var(--good)" }}>OK</span>
        ) : (
          <span style={{ color: "var(--faint)", fontSize: 11 }}>—</span>
        )}
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        <input className="in mono" type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty" style={{ width: 56, fontSize: 11.5, padding: "4px 6px" }} />
        <button type="button" disabled={pending} onClick={() => move("IN")} style={{ fontSize: 11, fontWeight: 700, background: "var(--good-tint)", color: "var(--good)", border: "none", borderRadius: 5, padding: "0 8px", cursor: pending ? "default" : "pointer" }}>
          + In
        </button>
        <button type="button" disabled={pending} onClick={() => move("OUT")} style={{ fontSize: 11, fontWeight: 700, background: "var(--critical-tint)", color: "var(--critical)", border: "none", borderRadius: 5, padding: "0 8px", cursor: pending ? "default" : "pointer" }}>
          − Out
        </button>
      </div>
    </div>
  );
}

// -------------------------------------------------------------- Stock items

export function StockItemForm() {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", itemType: "", itemCode: "", costPrice: "", sellPrice: "", openingQuantity: "" });
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!form.name.trim() || !form.costPrice || !form.sellPrice) {
      setError("Name, cost price, and sell price are required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      await createStockItem({
        name: form.name,
        itemType: form.itemType || null,
        itemCode: form.itemCode || null,
        costPrice: Number(form.costPrice),
        sellPrice: Number(form.sellPrice),
        openingQuantity: form.openingQuantity ? Number(form.openingQuantity) : 0,
      });
      setForm({ name: "", itemType: "", itemCode: "", costPrice: "", sellPrice: "", openingQuantity: "" });
    });
  }

  return (
    <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700 }}>Add stock item</div>
      <Field>
        Name
        <input className="in" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="School diary" />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field>
          Item type
          <input className="in" value={form.itemType} onChange={(e) => setForm({ ...form, itemType: e.target.value })} placeholder="Stationery" />
        </Field>
        <Field>
          Item code
          <input className="in mono" value={form.itemCode} onChange={(e) => setForm({ ...form, itemCode: e.target.value })} placeholder="SKU-1001" />
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <Field>
          Cost price (₹)
          <input className="in mono" type="number" min={0} value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} placeholder="60" />
        </Field>
        <Field>
          Sell price (₹)
          <input className="in mono" type="number" min={0} value={form.sellPrice} onChange={(e) => setForm({ ...form, sellPrice: e.target.value })} placeholder="90" />
        </Field>
        <Field>
          Opening qty
          <input className="in mono" type="number" min={0} value={form.openingQuantity} onChange={(e) => setForm({ ...form, openingQuantity: e.target.value })} placeholder="100" />
        </Field>
      </div>
      {error && <div style={{ color: "var(--critical)", fontSize: 12 }}>{error}</div>}
      <button type="button" onClick={submit} disabled={pending} style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 0", fontSize: 13, fontWeight: 700, cursor: pending ? "default" : "pointer" }}>
        {pending ? "Adding…" : "Add stock item"}
      </button>
      <Link href="/app/inventory/stock-bulk-import" style={{ fontSize: 12, fontWeight: 700, color: "var(--marigold-deep)", textDecoration: "none", textAlign: "center" }}>
        Bulk import from Excel ↑
      </Link>
    </div>
  );
}

export function StockItemRow({ item }: { item: { id: string; name: string; itemType: string | null; itemCode: string | null; costPrice: number; sellPrice: number; quantityOnHand: number } }) {
  const [pending, startTransition] = useTransition();
  const [qty, setQty] = useState("");
  const [costPrice, setCostPrice] = useState(item.costPrice.toString());
  const [sellPrice, setSellPrice] = useState(item.sellPrice.toString());
  const [error, setError] = useState<string | null>(null);

  function move(type: "IN" | "OUT") {
    const n = Number(qty);
    if (!n || n <= 0) return;
    setError(null);
    startTransition(async () => {
      try {
        await adjustStockItem(item.id, type, n, null);
        setQty("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not adjust stock.");
      }
    });
  }

  function savePricing() {
    const cost = Number(costPrice);
    const sell = Number(sellPrice);
    if (Number.isNaN(cost) || Number.isNaN(sell)) return;
    startTransition(() => updateStockItemPricing(item.id, cost, sell));
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.7fr 0.6fr 0.6fr 0.5fr 2.1fr", gap: 8, alignItems: "center", padding: "11px 20px", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
      <div>
        <div style={{ fontWeight: 600 }}>{item.name}</div>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--faint)" }}>{item.itemCode ?? "—"}</div>
      </div>
      <div style={{ color: "var(--muted)" }}>{item.itemType ?? "—"}</div>
      <input className="in mono" type="number" min={0} value={costPrice} onChange={(e) => setCostPrice(e.target.value)} onBlur={savePricing} style={{ fontSize: 12, padding: "4px 6px" }} />
      <input className="in mono" type="number" min={0} value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} onBlur={savePricing} style={{ fontSize: 12, padding: "4px 6px", fontWeight: 700 }} />
      <div className="mono" style={{ fontWeight: 700 }}>{item.quantityOnHand}</div>
      <div>
        <div style={{ display: "flex", gap: 4 }}>
          <input className="in mono" type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty" style={{ width: 42, flex: "none", fontSize: 11, padding: "4px 5px" }} />
          <button type="button" disabled={pending} onClick={() => move("IN")} style={{ fontSize: 10.5, fontWeight: 700, background: "var(--good-tint)", color: "var(--good)", border: "none", borderRadius: 5, padding: "0 6px", whiteSpace: "nowrap", cursor: pending ? "default" : "pointer" }}>
            + Add
          </button>
          <button type="button" disabled={pending} onClick={() => move("OUT")} style={{ fontSize: 10.5, fontWeight: 700, background: "var(--critical-tint)", color: "var(--critical)", border: "none", borderRadius: 5, padding: "0 6px", whiteSpace: "nowrap", cursor: pending ? "default" : "pointer" }}>
            − Remove
          </button>
        </div>
        {error && <div style={{ color: "var(--critical)", fontSize: 10.5, marginTop: 3 }}>{error}</div>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Billing

type BillableItem = { id: string; name: string; sellPrice: number; quantityOnHand: number };

export function BillingPanel({ items }: { items: BillableItem[] }) {
  const [pending, startTransition] = useTransition();
  const [consumerName, setConsumerName] = useState("");
  const [pickItemId, setPickItemId] = useState("");
  const [pickQty, setPickQty] = useState("1");
  const [cart, setCart] = useState<{ stockItemId: string; name: string; unitPrice: number; quantity: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const total = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0);

  function addToCart() {
    const item = items.find((i) => i.id === pickItemId);
    const n = Number(pickQty);
    if (!item || !n || n <= 0) return;
    setError(null);
    setCart((prev) => {
      const existing = prev.find((l) => l.stockItemId === item.id);
      if (existing) return prev.map((l) => (l.stockItemId === item.id ? { ...l, quantity: l.quantity + n } : l));
      return [...prev, { stockItemId: item.id, name: item.name, unitPrice: item.sellPrice, quantity: n }];
    });
    setPickItemId("");
    setPickQty("1");
  }

  function removeLine(stockItemId: string) {
    setCart((prev) => prev.filter((l) => l.stockItemId !== stockItemId));
  }

  function completeSale() {
    if (!consumerName.trim() || cart.length === 0) {
      setError("Enter a consumer name and add at least one item.");
      return;
    }
    setError(null);
    setSuccess(null);
    const lines: SaleLine[] = cart.map((l) => ({ stockItemId: l.stockItemId, quantity: l.quantity }));
    startTransition(async () => {
      const res = await createSale(consumerName, lines);
      if (res.error) {
        setError(res.error);
        return;
      }
      setSuccess(`Sold to ${consumerName} — ${formatINR(total)} total.`);
      setConsumerName("");
      setCart([]);
    });
  }

  return (
    <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700 }}>New sale</div>
      <Field>
        Consumer name
        <input className="in" value={consumerName} onChange={(e) => setConsumerName(e.target.value)} placeholder="Parent / student / walk-in name" />
      </Field>

      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <label className="field" style={{ flex: 1.6 }}>
          Item
          <select className="in" value={pickItemId} onChange={(e) => setPickItemId(e.target.value)}>
            <option value="">Select item…</option>
            {items.map((i) => (
              <option key={i.id} value={i.id} disabled={i.quantityOnHand <= 0}>
                {i.name} — {formatINR(i.sellPrice)} {i.quantityOnHand <= 0 ? "(out of stock)" : `(${i.quantityOnHand} available)`}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ flex: 0.6 }}>
          Qty
          <input className="in mono" type="number" min={1} value={pickQty} onChange={(e) => setPickQty(e.target.value)} />
        </label>
        <button type="button" onClick={addToCart} disabled={!pickItemId} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", marginBottom: 2 }}>
          Add
        </button>
      </div>

      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 8, minHeight: 40 }}>
        {cart.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>No items added yet.</div>}
        {cart.map((l) => (
          <div key={l.stockItemId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5 }}>
            <span>
              {l.name} <span className="mono" style={{ color: "var(--faint)" }}>× {l.quantity}</span>
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="mono" style={{ fontWeight: 700 }}>{formatINR(l.unitPrice * l.quantity)}</span>
              <span onClick={() => removeLine(l.stockItemId)} style={{ color: "var(--critical)", cursor: "pointer", fontWeight: 700 }}>
                ×
              </span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--line)", paddingTop: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>Total</span>
        <span className="mono" style={{ fontSize: 17, fontWeight: 700, color: "var(--marigold-deep)" }}>{formatINR(total)}</span>
      </div>

      {error && <div style={{ color: "var(--critical)", fontSize: 12.5 }}>{error}</div>}
      {success && <div style={{ color: "var(--good)", fontSize: 12.5 }}>{success}</div>}

      <button type="button" onClick={completeSale} disabled={pending || cart.length === 0} style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 13.5, fontWeight: 700, cursor: pending ? "default" : "pointer", opacity: cart.length === 0 ? 0.6 : 1 }}>
        {pending ? "Completing sale…" : "Complete sale"}
      </button>
    </div>
  );
}

// ------------------------------------------------------------------ Vendors

export function VendorForm() {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", category: "", contactName: "", phone: "", email: "" });

  function submit() {
    if (!form.name.trim()) return;
    startTransition(async () => {
      await createVendor({ name: form.name, category: form.category || null, contactName: form.contactName || null, phone: form.phone || null, email: form.email || null });
      setForm({ name: "", category: "", contactName: "", phone: "", email: "" });
    });
  }

  return (
    <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700 }}>Add vendor</div>
      <Field>
        Name
        <input className="in" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Sharma Stationers" />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field>
          Category
          <input className="in" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Stationery" />
        </Field>
        <Field>
          Contact person
          <input className="in" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} placeholder="Ramesh Sharma" />
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field>
          Phone
          <input className="in mono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="98765xxxxx" />
        </Field>
        <Field>
          Email
          <input className="in" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="vendor@example.com" />
        </Field>
      </div>
      <button type="button" onClick={submit} disabled={pending} style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 0", fontSize: 13, fontWeight: 700, cursor: pending ? "default" : "pointer" }}>
        {pending ? "Adding…" : "Add vendor"}
      </button>
    </div>
  );
}

export function VendorRow({ vendor }: { vendor: { id: string; name: string; category: string | null; contactName: string | null; phone: string | null; email: string | null; isActive: boolean } }) {
  const [pending, startTransition] = useTransition();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr 0.8fr", alignItems: "center", padding: "11px 20px", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
      <div style={{ fontWeight: 600 }}>{vendor.name}</div>
      <div style={{ color: "var(--muted)" }}>{vendor.category ?? "—"}</div>
      <div style={{ color: "var(--muted)" }}>{vendor.contactName ?? "—"}</div>
      <div className="mono" style={{ color: "var(--muted)", fontSize: 12 }}>{vendor.phone ?? vendor.email ?? "—"}</div>
      <span
        onClick={() => startTransition(() => toggleVendorActive(vendor.id))}
        className="pill"
        style={{ background: vendor.isActive ? "var(--good-tint)" : "var(--critical-tint)", color: vendor.isActive ? "var(--good)" : "var(--critical)", cursor: pending ? "default" : "pointer", justifySelf: "start" }}
      >
        {vendor.isActive ? "Active" : "Inactive"}
      </span>
    </div>
  );
}

// ---------------------------------------------------------- Purchase orders

export function PurchaseOrderForm({ vendors, consumables }: { vendors: { id: string; name: string }[]; consumables: { id: string; name: string }[] }) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ poNumber: "", vendorId: "", consumableId: "", itemDescription: "", quantity: "", unitCost: "", orderDate: "" });
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!form.poNumber.trim() || !form.vendorId || !form.itemDescription.trim() || !form.quantity || !form.unitCost || !form.orderDate) {
      setError("PO number, vendor, item, quantity, unit cost, and order date are required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      await createPurchaseOrder({
        poNumber: form.poNumber,
        vendorId: form.vendorId,
        consumableId: form.consumableId || null,
        itemDescription: form.itemDescription,
        quantity: Number(form.quantity),
        unitCost: Number(form.unitCost),
        orderDate: form.orderDate,
      });
      setForm({ poNumber: "", vendorId: "", consumableId: "", itemDescription: "", quantity: "", unitCost: "", orderDate: "" });
    });
  }

  return (
    <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700 }}>New purchase order</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field>
          PO number
          <input className="in mono" value={form.poNumber} onChange={(e) => setForm({ ...form, poNumber: e.target.value })} placeholder="PO-2026-014" />
        </Field>
        <Field>
          Vendor
          <select className="in" value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })}>
            <option value="">Select vendor…</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field>
        Item description
        <input className="in" value={form.itemDescription} onChange={(e) => setForm({ ...form, itemDescription: e.target.value })} placeholder="A4 paper — 20 reams" />
      </Field>
      <Field>
        Link to consumable <span style={{ fontWeight: 400, color: "var(--muted)" }}>(optional — auto-restocks on receipt)</span>
        <select className="in" value={form.consumableId} onChange={(e) => setForm({ ...form, consumableId: e.target.value })}>
          <option value="">None</option>
          {consumables.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <Field>
          Quantity
          <input className="in mono" type="number" min={0} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="20" />
        </Field>
        <Field>
          Unit cost (₹)
          <input className="in mono" type="number" min={0} value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} placeholder="250" />
        </Field>
        <Field>
          Order date
          <input className="in mono" type="date" value={form.orderDate} onChange={(e) => setForm({ ...form, orderDate: e.target.value })} />
        </Field>
      </div>
      {error && <div style={{ color: "var(--critical)", fontSize: 12 }}>{error}</div>}
      <button type="button" onClick={submit} disabled={pending} style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 0", fontSize: 13, fontWeight: 700, cursor: pending ? "default" : "pointer" }}>
        {pending ? "Creating…" : "Create purchase order"}
      </button>
    </div>
  );
}

const PO_STATUS_COLOR: Record<string, string> = { DRAFT: "var(--faint)", ORDERED: "var(--info)", RECEIVED: "var(--good)", CANCELLED: "var(--critical)" };

export function PurchaseOrderRow({ po }: { po: { id: string; poNumber: string; vendorName: string; itemDescription: string; quantity: number; unitCost: number; status: string; orderDate: string } }) {
  const [pending, startTransition] = useTransition();
  const total = po.quantity * po.unitCost;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr 1fr 1fr 1fr 1.3fr", alignItems: "center", padding: "11px 20px", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
      <div className="mono" style={{ fontWeight: 600 }}>{po.poNumber}</div>
      <div>
        <div>{po.itemDescription}</div>
        <div style={{ fontSize: 10.5, color: "var(--faint)" }}>{po.vendorName} · Qty {po.quantity}</div>
      </div>
      <div className="mono" style={{ color: "var(--muted)" }}>{formatINR(total)}</div>
      <div style={{ fontSize: 10.5, color: "var(--faint)" }}>{new Date(po.orderDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span className="pill" style={{ background: "transparent", border: `1px solid ${PO_STATUS_COLOR[po.status]}`, color: PO_STATUS_COLOR[po.status] }}>
          {po.status}
        </span>
        {po.status === "DRAFT" && (
          <span onClick={() => startTransition(() => updatePurchaseOrderStatus(po.id, "ORDERED"))} style={{ fontSize: 11, fontWeight: 700, color: "var(--marigold-deep)", cursor: pending ? "default" : "pointer" }}>
            Mark ordered
          </span>
        )}
        {po.status === "ORDERED" && (
          <span onClick={() => startTransition(() => updatePurchaseOrderStatus(po.id, "RECEIVED"))} style={{ fontSize: 11, fontWeight: 700, color: "var(--good)", cursor: pending ? "default" : "pointer" }}>
            Mark received
          </span>
        )}
        {(po.status === "DRAFT" || po.status === "ORDERED") && (
          <span onClick={() => startTransition(() => updatePurchaseOrderStatus(po.id, "CANCELLED"))} style={{ fontSize: 11, fontWeight: 600, color: "var(--critical)", cursor: pending ? "default" : "pointer" }}>
            Cancel
          </span>
        )}
      </div>
    </div>
  );
}
