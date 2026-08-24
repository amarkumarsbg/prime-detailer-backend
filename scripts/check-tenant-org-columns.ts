/**
 * Phase 5: verify organizationId columns exist on tenant-scoped tables.
 * Run: npx tsx scripts/check-tenant-org-columns.ts
 */
import { prisma } from "../src/lib/prisma.js";

const TABLES = ["Customer", "Vehicle", "Party", "AppJsonRow"] as const;

async function main() {
  const rows = await prisma.$queryRawUnsafe<Array<{ table_name: string; column_name: string }>>(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND column_name = 'organizationId'
       AND table_name = ANY($1)`,
    [...TABLES]
  );
  const found = new Set(rows.map((r) => r.table_name));
  const missing = TABLES.filter((t) => !found.has(t));
  if (missing.length) {
    console.error("FAIL: missing organizationId on:", missing.join(", "));
    process.exit(1);
  }
  console.log("OK: organizationId present on", TABLES.join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
