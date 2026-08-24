import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const jobCards = (await prisma.appJsonRow.findMany({
    where: { collection: "jobCards" }
  })).map(r => r.payload as any);

  const invoices = (await prisma.appJsonRow.findMany({
    where: { collection: "invoices" }
  })).map(r => r.payload as any);

  const year = 2026;
  const startMs = Date.parse("2026-07-01T00:00:00.000Z");
  const endMs = Date.parse("2026-09-30T23:59:59.999Z");

  console.log("=== Q3 (Jul-Sep) Delivered Job Cards ===");
  let jobSum = 0;
  jobCards.forEach(jc => {
    if (jc.status !== "DELIVERED") return;
    const dateStr = jc.actualDelivery || jc.updatedAt || jc.createdAt;
    if (!dateStr) return;
    const time = Date.parse(dateStr);
    if (time >= startMs && time <= endMs) {
      console.log(`Job: ${jc.jobNumber}, Estimated: ${jc.estimatedAmount}, DeliveredAt: ${dateStr}`);
      jobSum += jc.estimatedAmount ?? 0;
    }
  });
  console.log("Job Cards Sum:", jobSum);

  console.log("\n=== Q3 (Jul-Sep) Counter Sale Invoices ===");
  let invSum = 0;
  invoices.forEach(inv => {
    if (inv.status === "CANCELLED") return;
    if (inv.source !== "COUNTER_SALE") return;
    const dateStr = inv.createdAt;
    if (!dateStr) return;
    const time = Date.parse(dateStr);
    if (time >= startMs && time <= endMs) {
      console.log(`Invoice: ${inv.id}, Total: ${inv.grandTotal}, CreatedAt: ${dateStr}`);
      invSum += inv.grandTotal ?? 0;
    }
  });
  console.log("Invoices Sum:", invSum);
  console.log("Grand Total Revenue (Services + Counter Sale):", jobSum + invSum);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
