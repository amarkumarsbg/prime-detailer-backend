import { prisma } from "./prisma.js";

interface AuditEntry {
  organizationId: string;
  actor: string;
  action: string;
  before?: unknown;
  after?: unknown;
}

export async function writePlatformAuditLog(entry: AuditEntry): Promise<void> {
  await prisma.platformAuditLog.create({
    data: {
      id: `pal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      organizationId: entry.organizationId,
      actor: entry.actor,
      action: entry.action,
      before: (entry.before ?? undefined) as never,
      after: (entry.after ?? undefined) as never,
    },
  });
}
