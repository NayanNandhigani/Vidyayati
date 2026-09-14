import { requireModuleAccess } from "@/lib/permissions";
import { getScopedDb } from "@/lib/tenant-db";
import NewRouteForm from "./NewRouteForm";

export default async function NewRoutePage() {
  await requireModuleAccess("Transport", "EDIT");
  const sdb = await getScopedDb();
  const vehicles = await sdb.transportVehicle.findMany({ where: { isActive: true }, orderBy: { vehicleNo: "asc" } });

  return (
    <div style={{ padding: "26px 34px" }}>
      <div className="disp" style={{ fontSize: 21, marginBottom: 4 }}>
        Add Route
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 0, marginBottom: 22 }}>Set up a new transport route.</p>
      <div className="card" style={{ padding: 24, maxWidth: 460 }}>
        <NewRouteForm vehicles={vehicles.map((v) => ({ id: v.id, vehicleNo: v.vehicleNo }))} />
      </div>
    </div>
  );
}
