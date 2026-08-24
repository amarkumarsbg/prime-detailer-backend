import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const vendors = await prisma.party.findMany({
    where: { kind: 'VENDOR' as any },
    select: { id: true, name: true, organizationId: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const invoices = await prisma.appJsonRow.count({ where: { collection: 'invoices' } });
  const jobCards = await prisma.appJsonRow.count({ where: { collection: 'jobCards' } });
  const appointments = await prisma.appJsonRow.count({ where: { collection: 'appointments' } });

  console.log({ vendors, invoices, jobCards, appointments });
}

main().finally(async () => prisma.$disconnect());
