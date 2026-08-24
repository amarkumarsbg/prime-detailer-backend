/**
 * Soft-check seeded high-risk collection rows against structural Zod schemas.
 * Run: npm run test:collection-payloads
 */
import { PrismaClient } from "@prisma/client";
import { ZodError } from "zod";
import { parseCollectionPayload } from "../src/validations/collection-payloads.js";

const prisma = new PrismaClient();
const COLLECTIONS = ["invoices", "jobCards", "quotations", "payroll", "membership"] as const;

async function main() {
  let failures = 0;
  for (const collection of COLLECTIONS) {
    const rows = await prisma.appJsonRow.findMany({ where: { collection } });
    console.log(`${collection}: ${rows.length} row(s)`);
    for (const row of rows) {
      try {
        parseCollectionPayload(collection, row.payload);
      } catch (e) {
        failures += 1;
        const detail = e instanceof ZodError ? e.flatten() : e;
        console.error(`FAIL ${collection}/${row.entityId}`, detail);
      }
    }
  }
  await prisma.$disconnect();
  if (failures > 0) {
    console.error(`Failed: ${failures} payload(s)`);
    process.exit(1);
  }
  console.log("OK: seeded high-risk collection payloads pass structural validation.");
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
