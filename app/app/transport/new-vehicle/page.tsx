import { requireModuleAccess } from "@/lib/permissions";
import NewVehicleForm from "./NewVehicleForm";

export default async function NewVehiclePage() {
  await requireModuleAccess("Transport", "EDIT");

  return (
    <div style={{ padding: "26px 34px" }}>
      <div className="disp" style={{ fontSize: 21, marginBottom: 4 }}>
        Add Vehicle
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 0, marginBottom: 22 }}>Register a new vehicle for transport.</p>
      <div className="card" style={{ padding: 24, maxWidth: 620 }}>
        <NewVehicleForm />
      </div>
    </div>
  );
}
