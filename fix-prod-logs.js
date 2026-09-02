import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const logs = await prisma.appJsonRow.findMany({
    where: { collection: 'activityLogs' }
  });
  
  let updated = 0;
  for (const log of logs) {
    const p = log.payload;
    let modified = false;
    
    // Skip already nicely formatted old frontend logs
    if (p.action === 'WHATSAPP_SENT' || p.action === 'STATUS_CHANGED' || p.action === 'PAYMENT_RECEIVED') continue;
    
    if (typeof p.details === 'object' || !p.userName) {
      if (!p.userName && p.userId) {
        try {
          const user = await prisma.user.findUnique({ where: { id: p.userId }, select: { name: true } });
          if (user && user.name) {
            p.userName = user.name;
            modified = true;
          }
        } catch(e) {}
      }
      
      if (typeof p.details === 'object') {
        let detailsText = "";
        if (p.action.startsWith("CREATE_")) {
          detailsText = `Created new ${p.entityType?.toLowerCase() || ''}`;
        } else if (p.action.startsWith("UPDATE_")) {
          if (p.details?.oldStatus && p.details?.newStatus) {
            detailsText = `Status changed from ${p.details.oldStatus} to ${p.details.newStatus}`;
          } else {
            detailsText = `Updated ${p.entityType?.toLowerCase() || ''}`;
          }
        } else if (p.action.startsWith("DELETE_")) {
          detailsText = `Deleted ${p.entityType?.toLowerCase() || ''}`;
        } else if (p.action.startsWith("REPLACE_")) {
          detailsText = `Replaced/Synched ${p.entityType?.toLowerCase() || ''}`;
        } else {
          detailsText = `${p.action} performed`;
        }
        p.details = detailsText;
        modified = true;
      }
      
      if (modified) {
        await prisma.appJsonRow.update({
          where: { collection_entityId: { collection: 'activityLogs', entityId: log.entityId } },
          data: { payload: p }
        });
        updated++;
      }
    }
  }
  console.log('Fixed ' + updated + ' logs in production');
}
main().catch(console.error).finally(() => prisma.$disconnect());
