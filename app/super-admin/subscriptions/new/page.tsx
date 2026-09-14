import { db } from "@/lib/db";
import NewInvoiceForm from "./NewInvoiceForm";

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ school?: string }> }) {
  const params = await searchParams;
  const [schools, plans] = await Promise.all([
    db.school.findMany({ orderBy: { name: "asc" } }),
    db.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <div style={{ padding: "28px 36px" }}>
      <div className="disp" style={{ fontSize: 21, marginBottom: 4 }}>
        Create Invoice
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 0, marginBottom: 22 }}>Bill a school for its subscription.</p>
      <div className="card" style={{ padding: 24, maxWidth: 480 }}>
        <NewInvoiceForm schools={schools} plans={plans.map((p) => ({ id: p.id, name: p.name, price: Number(p.price) }))} defaultSchoolId={params.school} />
      </div>
    </div>
  );
}
