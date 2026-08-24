/**
 * One-time backward-compat: grant JOB_CARD_PRICING to every user who already has JOB_CARDS.
 * Preserves pre-RBAC price-edit behavior; Super Admins can revoke afterward for restricted staff.
 *
 * Run: npx tsx scripts/grant-job-card-pricing.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, permissions: true },
  });
  let updated = 0;
  for (const u of users) {
    const perms = u.permissions ?? [];
    if (!perms.includes("JOB_CARDS")) continue;
    if (perms.includes("JOB_CARD_PRICING")) continue;
    await prisma.user.update({
      where: { id: u.id },
      data: { permissions: [...perms, "JOB_CARD_PRICING"] },
    });
    updated += 1;
    console.log(`Granted JOB_CARD_PRICING → ${u.email} (${u.id})`);
  }
  console.log(`Done. Updated ${updated} user(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
