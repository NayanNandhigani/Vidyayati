import { db } from "@/lib/db";

export { buildContractTemplate } from "@/lib/contract-template";

/** Contract numbers look like VY-CTR-2026-0007 — year of creation + a running sequence within that year. */
export async function generateContractNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `VY-CTR-${year}-`;
  const count = await db.contract.count({ where: { contractNumber: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}
