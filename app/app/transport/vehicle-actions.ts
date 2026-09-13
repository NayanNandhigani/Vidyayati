"use server";

import { revalidatePath } from "next/cache";
import { Prisma, VehicleLogType } from "@prisma/client";
import { auth } from "@/auth";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { deleteUploadedFile, saveUploadedFile } from "@/lib/storage";

export type VehicleFields = {
  vehicleNo: string;
  vehicleType: string | null;
  capacity: number | null;
  make: string | null;
  model: string | null;
  driverName: string | null;
  driverPhone: string | null;
  driverLicenseNo: string | null;
  driverLicenseExpiry: string | null;
  insurancePolicyNo: string | null;
  insuranceExpiry: string | null;
  fitnessExpiry: string | null;
  pollutionCertExpiry: string | null;
  notes: string | null;
};

export async function createVehicle(fields: VehicleFields) {
  await requireModuleAccess("Transport", "EDIT");
  if (!fields.vehicleNo.trim()) throw new Error("Vehicle (registration) number is required.");
  const sdb = await getScopedDb();
  const vehicle = await sdb.transportVehicle.create({
    data: scopedCreateData<Prisma.TransportVehicleUncheckedCreateInput>({
      vehicleNo: fields.vehicleNo.trim(),
      vehicleType: fields.vehicleType,
      capacity: fields.capacity,
      make: fields.make,
      model: fields.model,
      driverName: fields.driverName,
      driverPhone: fields.driverPhone,
      driverLicenseNo: fields.driverLicenseNo,
      driverLicenseExpiry: fields.driverLicenseExpiry ? new Date(fields.driverLicenseExpiry) : null,
      insurancePolicyNo: fields.insurancePolicyNo,
      insuranceExpiry: fields.insuranceExpiry ? new Date(fields.insuranceExpiry) : null,
      fitnessExpiry: fields.fitnessExpiry ? new Date(fields.fitnessExpiry) : null,
      pollutionCertExpiry: fields.pollutionCertExpiry ? new Date(fields.pollutionCertExpiry) : null,
    }),
  });
  revalidatePath("/app/transport");
  return { id: vehicle.id };
}

export async function updateVehicle(vehicleId: string, fields: VehicleFields) {
  await requireModuleAccess("Transport", "EDIT");
  if (!fields.vehicleNo.trim()) throw new Error("Vehicle (registration) number is required.");
  const sdb = await getScopedDb();
  await sdb.transportVehicle.update({
    where: { id: vehicleId },
    data: {
      vehicleNo: fields.vehicleNo.trim(),
      vehicleType: fields.vehicleType,
      capacity: fields.capacity,
      make: fields.make,
      model: fields.model,
      driverName: fields.driverName,
      driverPhone: fields.driverPhone,
      driverLicenseNo: fields.driverLicenseNo,
      driverLicenseExpiry: fields.driverLicenseExpiry ? new Date(fields.driverLicenseExpiry) : null,
      insurancePolicyNo: fields.insurancePolicyNo,
      insuranceExpiry: fields.insuranceExpiry ? new Date(fields.insuranceExpiry) : null,
      fitnessExpiry: fields.fitnessExpiry ? new Date(fields.fitnessExpiry) : null,
      pollutionCertExpiry: fields.pollutionCertExpiry ? new Date(fields.pollutionCertExpiry) : null,
      notes: fields.notes,
    },
  });
  revalidatePath("/app/transport");
  revalidatePath(`/app/transport/vehicles/${vehicleId}`);
}

export async function toggleVehicleActive(vehicleId: string) {
  await requireModuleAccess("Transport", "EDIT");
  const sdb = await getScopedDb();
  const vehicle = await sdb.transportVehicle.findUniqueOrThrow({ where: { id: vehicleId } });
  await sdb.transportVehicle.update({ where: { id: vehicleId }, data: { isActive: !vehicle.isActive } });
  revalidatePath("/app/transport");
  revalidatePath(`/app/transport/vehicles/${vehicleId}`);
}

export async function updateVehicleLocation(vehicleId: string, lat: number, lng: number) {
  await requireModuleAccess("Transport", "EDIT");
  const sdb = await getScopedDb();
  await sdb.transportVehicle.update({ where: { id: vehicleId }, data: { lastKnownLat: lat, lastKnownLng: lng, lastLocationAt: new Date() } });
  revalidatePath("/app/transport");
  revalidatePath(`/app/transport/vehicles/${vehicleId}`);
}

// ------------------------------------------------------------- Service log

export async function addVehicleLog(vehicleId: string, type: VehicleLogType, date: string, description: string, cost: number | null, odometerReading: number | null) {
  await requireModuleAccess("Transport", "EDIT");
  if (!date || !description.trim()) throw new Error("Date and description are required.");
  const sdb = await getScopedDb();
  await sdb.transportVehicle.findUniqueOrThrow({ where: { id: vehicleId }, select: { id: true } });
  await sdb.vehicleLog.create({
    data: scopedCreateData<Prisma.VehicleLogUncheckedCreateInput>({ vehicleId, type, date: new Date(date), description: description.trim(), cost, odometerReading }),
  });
  revalidatePath("/app/transport");
  revalidatePath(`/app/transport/vehicles/${vehicleId}`);
}

export async function deleteVehicleLog(logId: string, vehicleId: string) {
  await requireModuleAccess("Transport", "EDIT");
  const sdb = await getScopedDb();
  await sdb.vehicleLog.delete({ where: { id: logId } });
  revalidatePath("/app/transport");
  revalidatePath(`/app/transport/vehicles/${vehicleId}`);
}

// -------------------------------------------------------------- Documents

export async function addVehicleDocument(vehicleId: string, category: string, formData: FormData) {
  await requireModuleAccess("Transport", "EDIT");
  const session = await auth();
  const sdb = await getScopedDb();
  await sdb.transportVehicle.findUniqueOrThrow({ where: { id: vehicleId }, select: { id: true } });

  const file = formData.get("file");
  const expiryDate = formData.get("expiryDate");
  if (!(file instanceof File) || file.size === 0) return;

  const bytes = Buffer.from(await file.arrayBuffer());
  const { storagePath } = await saveUploadedFile(`vehicle-documents/${session!.user.schoolId}`, file.name, bytes);

  await sdb.personDocument.create({
    data: scopedCreateData<Prisma.PersonDocumentUncheckedCreateInput>({
      subjectType: "VEHICLE",
      vehicleId,
      category,
      label: file.name,
      filePath: storagePath,
      expiryDate: typeof expiryDate === "string" && expiryDate ? new Date(expiryDate) : null,
    }),
  });
  revalidatePath("/app/transport");
  revalidatePath(`/app/transport/vehicles/${vehicleId}`);
}

/** Transport-scoped sibling of Students'/Employees' deletePersonDocument — that shared helper hardcodes a Students EDIT check, which would incorrectly gate vehicle-document deletion behind the wrong module. redirectPath is this vehicle's own detail page, passed in by the caller so this revalidates correctly regardless of where it's rendered from. */
export async function deleteVehicleDocument(redirectPath: string, documentId: string) {
  await requireModuleAccess("Transport", "EDIT");
  const sdb = await getScopedDb();
  const doc = await sdb.personDocument.findUnique({ where: { id: documentId } });
  if (doc) await deleteUploadedFile(doc.filePath);
  await sdb.personDocument.delete({ where: { id: documentId } });
  revalidatePath("/app/transport");
  revalidatePath(redirectPath);
}
