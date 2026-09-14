"use server";

import { auth } from "@/auth";
import { getScopedDb } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { requireFeature } from "@/lib/feature-flags";
import { buildCsv } from "@/lib/csv";
import { runCustomReport, type BuilderEntity, type BuilderFilters, type ReportData } from "@/lib/report-builder";

async function guard() {
  await requireModuleAccess("Reports", "VIEW");
  const session = await auth();
  await requireFeature(session!.user.schoolId, "reports.customBuilder");
}

export async function previewCustomReport(entity: BuilderEntity, columns: string[], filters: BuilderFilters): Promise<ReportData> {
  await guard();
  const sdb = await getScopedDb();
  const data = await runCustomReport(entity, columns, filters, sdb);
  return { columns: data.columns, rows: data.rows.slice(0, 50) };
}

export async function exportCustomReportCsv(entity: BuilderEntity, columns: string[], filters: BuilderFilters): Promise<string> {
  await guard();
  const sdb = await getScopedDb();
  const data = await runCustomReport(entity, columns, filters, sdb);
  return buildCsv(data.columns, data.rows);
}
