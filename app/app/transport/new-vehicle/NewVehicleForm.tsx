"use client";

import { useRouter } from "next/navigation";
import { VehicleForm } from "../VehiclesPanel";

export default function NewVehicleForm() {
  const router = useRouter();
  return <VehicleForm vehicle={null} onSaved={(id) => id && router.push(`/app/transport/vehicles/${id}`)} />;
}
