import { randomUUID } from "crypto";
import { type CollectionWriteContext } from "../modules/collections/collection.dispatcher.js";
import { prisma } from "../lib/prisma.js";

export type ActivityAction = 
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "UPDATE_STATUS"
  | "RECORD_PAYMENT"
  | string;

export interface LogBusinessActivityParams {
  action: ActivityAction;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
}

export async function logBusinessActivity(
  ctx: CollectionWriteContext,
  params: LogBusinessActivityParams
): Promise<void> {
  if (!ctx.userId) return; // Silent skip if no user identity

  const timestamp = new Date().toISOString();
  let userName = undefined;
  
  try {
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { name: true },
    });
    if (user?.name) userName = user.name;
  } catch (err) {
    // ignore
  }

  // Format details string for the frontend
  let detailsText = "";
  if (params.action.startsWith("CREATE_")) {
    detailsText = `Created new ${params.entityType.toLowerCase()}`;
  } else if (params.action.startsWith("UPDATE_")) {
    if (params.details?.oldStatus && params.details?.newStatus) {
      detailsText = `Status changed from ${params.details.oldStatus} to ${params.details.newStatus}`;
    } else {
      detailsText = `Updated ${params.entityType.toLowerCase()}`;
    }
  } else if (params.action.startsWith("DELETE_")) {
    detailsText = `Deleted ${params.entityType.toLowerCase()}`;
  } else if (params.action.startsWith("REPLACE_")) {
    detailsText = `Replaced/Synched ${params.entityType.toLowerCase()}`;
  } else {
    detailsText = `${params.action} performed`;
  }
  
  const payload = {
    userId: ctx.userId,
    userName,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    timestamp,
    createdAt: timestamp,
    details: detailsText,
  };

  const activityLogId = randomUUID();

  try {
    await prisma.appJsonRow.upsert({
      where: {
        collection_entityId: { collection: "activityLogs", entityId: activityLogId },
      },
      create: {
        collection: "activityLogs",
        entityId: activityLogId,
        organizationId: ctx.organizationId,
        payload: payload as import("@prisma/client").Prisma.InputJsonObject,
      },
      update: { payload: payload as import("@prisma/client").Prisma.InputJsonObject },
    });
  } catch (err) {
    // We swallow errors here to not fail the primary business transaction, 
    // but in a real-world scenario you might want to alert on this.
    console.error("[ActivityLogger] Failed to write activity log:", err);
  }
}
