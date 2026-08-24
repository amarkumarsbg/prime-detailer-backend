import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.appJsonRow.findMany({
    where: { collection: "pickupDropRequests" },
    orderBy: { updatedAt: "desc" },
  });

  console.log(`\n=== pickupDropRequests (${rows.length} rows) ===\n`);

  if (rows.length === 0) {
    console.log("No pickup/drop rows yet.");
    console.log("Create one: Job Cards → New → Pickup = Yes, or use Pickup & Drop page.\n");
  } else {
    for (const r of rows) {
      console.log("─".repeat(60));
      console.log(`entityId:  ${r.entityId}`);
      console.log(`updatedAt: ${r.updatedAt.toISOString()}`);
      console.log(JSON.stringify(r.payload, null, 2));
      console.log();
    }
  }

  const counts = await prisma.appJsonRow.groupBy({
    by: ["collection"],
    _count: { collection: true },
    orderBy: { _count: { collection: "desc" } },
  });

  console.log("=== All AppJsonRow collections ===\n");
  for (const c of counts) {
    console.log(`${c.collection.padEnd(24)} ${c._count.collection}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
