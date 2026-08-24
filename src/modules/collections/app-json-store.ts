/**
 * AppJsonRow storage adapter. Domain services own business rules; this layer persists
 * and enforces tenant (organizationId) scope when provided.
 */
import { prisma } from "../../lib/prisma.js";
import { sortCollectionPayloads } from "../../lib/sort-collection-payloads.js";
import {
  isArrayCollection,
  isSingletonCollection,
  SINGLETON_ENTITY_ID,
} from "../../constants/json-collections.js";
import { applyCollectionBranchScope } from "../../lib/data-scope.js";
import { AppError } from "../../lib/app-error.js";

export type ListCollectionOpts = {
  /** When set, only return rows for this organization. */
  organizationId?: string;
  allowedBranchIds?: string[] | null;
};

export async function listCollectionItems(
  collection: string,
  allowedBranchIdsOrOpts?: string[] | null | ListCollectionOpts
): Promise<unknown[]> {
  const opts: ListCollectionOpts =
    allowedBranchIdsOrOpts !== null &&
    typeof allowedBranchIdsOrOpts === "object" &&
    !Array.isArray(allowedBranchIdsOrOpts)
      ? allowedBranchIdsOrOpts
      : { allowedBranchIds: allowedBranchIdsOrOpts as string[] | null | undefined };

  let items: unknown[];
  if (isSingletonCollection(collection)) {
    const row = await prisma.appJsonRow.findFirst({
      where: {
        collection,
        entityId: SINGLETON_ENTITY_ID,
        ...(opts.organizationId ? { organizationId: opts.organizationId } : {}),
      },
    });
    items = row ? [row.payload] : [];
  } else {
    const rows = await prisma.appJsonRow.findMany({
      where: {
        collection,
        ...(opts.organizationId ? { organizationId: opts.organizationId } : {}),
      },
    });
    const payloads = rows.map((r) => r.payload);
    items = sortCollectionPayloads(collection, payloads);
  }

  if (opts.allowedBranchIds === undefined) return items;
  return applyCollectionBranchScope(collection, items, opts.allowedBranchIds);
}

/**
 * Tenant-scoped get. When organizationId is set, the row must belong to that org.
 * When omitted (public / migration), lookup is by collection + entityId only.
 */
export async function getCollectionItem(
  collection: string,
  entityId: string,
  organizationId?: string
): Promise<unknown | null> {
  const row = await prisma.appJsonRow.findUnique({
    where: { collection_entityId: { collection, entityId } },
  });
  if (!row) return null;
  if (organizationId && row.organizationId !== organizationId) return null;
  return row.payload;
}

export async function upsertCollectionItem(
  collection: string,
  entityId: string,
  payload: unknown,
  organizationId: string
): Promise<void> {
  const existing = await prisma.appJsonRow.findUnique({
    where: { collection_entityId: { collection, entityId } },
    select: { organizationId: true },
  });
  if (existing && existing.organizationId !== organizationId) {
    throw AppError.conflict("Document id already exists in another organization");
  }

  await prisma.appJsonRow.upsert({
    where: { collection_entityId: { collection, entityId } },
    create: {
      collection,
      entityId,
      organizationId,
      payload: payload as object,
    },
    update: { payload: payload as object, organizationId },
  });
}

export async function deleteCollectionItem(
  collection: string,
  entityId: string,
  organizationId: string
): Promise<boolean> {
  const existing = await prisma.appJsonRow.findUnique({
    where: { collection_entityId: { collection, entityId } },
    select: { organizationId: true },
  });
  if (!existing) return false;
  if (existing.organizationId !== organizationId) return false;
  try {
    await prisma.appJsonRow.delete({
      where: { collection_entityId: { collection, entityId } },
    });
    return true;
  } catch {
    return false;
  }
}

export async function replaceCollectionArray(
  collection: string,
  items: { id: string }[],
  organizationId: string
): Promise<void> {
  if (!isArrayCollection(collection)) {
    throw new Error("replaceCollectionArray only for array collections");
  }
  const byId = new Map<string, { id: string }>();
  for (const item of items) {
    if (!item || typeof item.id !== "string") continue;
    const id = item.id.trim();
    if (!id) continue;
    byId.set(id, { ...item, id });
  }
  const uniqueItems = [...byId.values()];

  // Reject snapshot that would clobber another org's entity ids.
  if (uniqueItems.length > 0) {
    const foreign = await prisma.appJsonRow.findMany({
      where: {
        collection,
        entityId: { in: uniqueItems.map((i) => i.id) },
        NOT: { organizationId },
      },
      select: { entityId: true },
      take: 1,
    });
    if (foreign.length > 0) {
      throw AppError.conflict("Snapshot contains ids owned by another organization");
    }
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`appJsonRow:${organizationId}:${collection}`}))`;
      await tx.appJsonRow.deleteMany({ where: { collection, organizationId } });
      if (uniqueItems.length === 0) return;
      await tx.appJsonRow.createMany({
        data: uniqueItems.map((item) => ({
          collection,
          entityId: item.id,
          organizationId,
          payload: item as object,
        })),
        skipDuplicates: true,
      });
    },
    { timeout: 30_000 }
  );
}

export async function upsertSingleton(
  collection: string,
  payload: unknown,
  organizationId: string
): Promise<void> {
  if (!isSingletonCollection(collection)) {
    throw new Error("Not a singleton collection");
  }
  await upsertCollectionItem(collection, SINGLETON_ENTITY_ID, payload, organizationId);
}
