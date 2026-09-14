import { notFound } from "next/navigation";
import Link from "next/link";
import { getScopedDb } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { avatarColorFor } from "@/lib/academic";
import { IconTruck } from "@/components/icons";
import VehicleSections from "./VehicleSections";

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const accessLevel = await requireModuleAccess("Transport", "VIEW");
  const canEdit = accessLevel === "EDIT";
  const { id } = await params;
  const sdb = await getScopedDb();

  const vehicle = await sdb.transportVehicle.findFirst({
    where: { id },
    include: { routes: true },
  });
  if (!vehicle) notFound();

  const [logs, documents] = await Promise.all([
    sdb.vehicleLog.findMany({ where: { vehicleId: vehicle.id }, orderBy: { date: "desc" } }),
    sdb.personDocument.findMany({ where: { vehicleId: vehicle.id, subjectType: "VEHICLE" }, orderBy: { uploadedAt: "desc" } }),
  ]);

  const vehicleRow = {
    id: vehicle.id,
    vehicleNo: vehicle.vehicleNo,
    vehicleType: vehicle.vehicleType,
    capacity: vehicle.capacity,
    make: vehicle.make,
    model: vehicle.model,
    driverName: vehicle.driverName,
    driverPhone: vehicle.driverPhone,
    driverLicenseNo: vehicle.driverLicenseNo,
    driverLicenseExpiry: vehicle.driverLicenseExpiry?.toISOString() ?? null,
    insurancePolicyNo: vehicle.insurancePolicyNo,
    insuranceExpiry: vehicle.insuranceExpiry?.toISOString() ?? null,
    fitnessExpiry: vehicle.fitnessExpiry?.toISOString() ?? null,
    pollutionCertExpiry: vehicle.pollutionCertExpiry?.toISOString() ?? null,
    notes: vehicle.notes,
    isActive: vehicle.isActive,
    lastKnownLat: vehicle.lastKnownLat,
    lastKnownLng: vehicle.lastKnownLng,
    lastLocationAt: vehicle.lastLocationAt?.toISOString() ?? null,
    routeNames: vehicle.routes.map((r) => r.name),
  };

  return (
    <div style={{ padding: "26px 34px", display: "flex", flexDirection: "column", gap: 16, height: "100dvh", boxSizing: "border-box", overflowY: "auto" }}>
      <div>
        <Link href="/app/transport?tab=vehicles" style={{ fontSize: 12.5, color: "var(--muted)", textDecoration: "none" }}>
          ← Back to Vehicles
        </Link>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: avatarColorFor(vehicle.id),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            flex: "none",
          }}
        >
          <IconTruck width={26} height={26} />
        </div>
        <div>
          <div className="disp mono" style={{ fontSize: 20 }}>
            {vehicle.vehicleNo}
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
            {[vehicle.vehicleType, vehicle.make, vehicle.model].filter(Boolean).join(" · ") || "No details set"}
            {vehicle.capacity ? ` · ${vehicle.capacity} seats` : ""}
          </div>
        </div>
      </div>

      <VehicleSections
        vehicle={vehicleRow}
        logs={logs.map((l) => ({ id: l.id, type: l.type, date: l.date.toISOString(), description: l.description, cost: l.cost ? Number(l.cost) : null, odometerReading: l.odometerReading }))}
        documents={documents.map((d) => ({ id: d.id, category: d.category, label: d.label, filePath: d.filePath, expiryDate: d.expiryDate?.toISOString() ?? null, uploadedAt: d.uploadedAt.toISOString() }))}
        canEdit={canEdit}
      />
    </div>
  );
}
