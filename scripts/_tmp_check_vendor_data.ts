import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const vendors = await prisma.party.findMany({
    where: { type: 'VENDOR' as any },
    select: {
      id: true,
      name: true,
      openingBalance: true,
      currentBalance: true,
      totalPayable: true,
      totalReceivable: true,
      totalTransactions: true,
      organizationId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const vendorCount = await prisma.party.count({ where: { type: 'VENDOR' as any } });
  const payableNonZero = vendors.filter(v => (v.totalPayable ?? 0) !== 0).length;
  const receivableNonZero = vendors.filter(v => (v.totalReceivable ?? 0) !== 0).length;

  console.log({ vendorCount, payableNonZero, receivableNonZero, vendors });
}

main().finally(async () => prisma.$disconnect());
