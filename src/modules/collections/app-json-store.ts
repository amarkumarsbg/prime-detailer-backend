/**
 * AppJsonRow storage adapter. Domain services own business rules; this layer persists
 * and enforces tenant (organizationId) scope when provided.
 */
import { prisma } from "../../lib/prisma.js";
import { Prisma } from "@prisma/client";
import { sortCollectionPayloads } from "../../lib/sort-collection-payloads.js";
import {
  isArrayCollection,
  isSingletonCollection,
  SINGLETON_ENTITY_ID,
} from "../../constants/json-collections.js";
import { applyCollectionBranchScope } from "../../lib/data-scope.js";
import { AppError } from "../../lib/app-error.js";

function isPickupDropWriteBlocked(): boolean {
  const raw = process.env.BLOCK_PICKUP_DROP_WRITES?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

function assertCollectionWriteAllowed(collection: string): void {
  if (collection !== "pickupDropRequests") return;
  if (!isPickupDropWriteBlocked()) return;
  throw AppError.forbidden("Pickup/Drop writes are temporarily blocked.");
}

export type ListCollectionOpts = {
  /** When set, only return rows for this organization. */
  organizationId?: string;
  allowedBranchIds?: string[] | null;
  page?: number;
  pageSize?: number;
  /**
   * JSON keys to strip from each payload before returning.
   * Applied at DB level (SQL `payload - 'key'`) for the fast pagination path to reduce
   * network transfer when payloads contain large embedded data (e.g. base64 PDFs).
   * Applied in Node for the general (branch-filtered) path.
   */
  stripPayloadFields?: string[];
};

export async function listCollectionItems(
  collection: string,
  allowedBranchIdsOrOpts?: string[] | null | ListCollectionOpts
): Promise<unknown[] | { items: unknown[]; page: number; pageSize: number; total: number; totalPages: number }> {
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
      select: { payload: true },
    });
    items = row ? [row.payload] : [];
  } else {
    const where = {
      collection,
      ...(opts.organizationId ? { organizationId: opts.organizationId } : {}),
    };

    // Fast path: pagination with no branch filter.
    // Uses a single raw SQL query with COUNT(*) OVER() window function to get both
    // total count and page data in one DB round-trip (critical for high-latency remote DBs).
    // stripPayloadFields removes large embedded fields (e.g. base64 PDFs) at DB level
    // to minimise network transfer.
    const needsBranchFilter = Array.isArray(opts.allowedBranchIds) && opts.allowedBranchIds.length >= 0;
    if (opts.page && opts.pageSize && !needsBranchFilter) {
      const skip = (opts.page - 1) * opts.pageSize;
      const orgFilter = opts.organizationId
        ? Prisma.sql`AND "organizationId" = ${opts.organizationId}`
        : Prisma.empty;

      // Build a SQL expression that strips requested keys from the JSONB payload.
      // e.g. stripPayloadFields=['pdf','photos'] → payload - 'pdf' - 'photos'
      const stripFields = opts.stripPayloadFields ?? [];
      const payloadExpr =
        stripFields.length > 0
          ? Prisma.sql`(${Prisma.join(
              [Prisma.sql`payload`, ...stripFields.map((f) => Prisma.sql`${f}`)],
              " - "
            )})`
          : Prisma.sql`payload`;

      const rows = await prisma.$queryRaw<Array<{ payload: unknown; total_count: bigint }>>`
        SELECT ${payloadExpr} AS payload, COUNT(*) OVER() AS total_count
        FROM "AppJsonRow"
        WHERE collection = ${collection}
        ${orgFilter}
        ORDER BY "createdAt" DESC
        LIMIT ${opts.pageSize} OFFSET ${skip}
      `;
      const total = rows.length > 0 ? Number(rows[0]!.total_count) : 0;
      return {
        items: rows.map((r) => r.payload),
        page: opts.page,
        pageSize: opts.pageSize,
        total,
        totalPages: Math.ceil(total / opts.pageSize),
      };
    }

    // General path: load all rows for this collection/org, sort in JS.
    // Used when branch filtering is required (non-null allowedBranchIds) or no pagination.
    const rows = await prisma.appJsonRow.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: { payload: true },
    });
    items = rows.map((r) => {
      // Apply stripPayloadFields in Node for the general (non-fast) path.
      if (opts.stripPayloadFields?.length && r.payload && typeof r.payload === "object") {
        const copy = { ...(r.payload as Record<string, unknown>) };
        for (const f of opts.stripPayloadFields) delete copy[f];
        return copy;
      }
      return r.payload;
    });
    // Data is already ordered by createdAt DESC from DB; sortCollectionPayloads re-sorts
    // only when the collection uses a non-createdAt primary sort field (e.g. appointments by date).
    items = sortCollectionPayloads(collection, items);
  }

  if (opts.allowedBranchIds !== undefined) {
    items = applyCollectionBranchScope(collection, items, opts.allowedBranchIds);
  }

  if (opts.page && opts.pageSize) {
    const total = items.length;
    const start = (opts.page - 1) * opts.pageSize;
    return {
      items: items.slice(start, start + opts.pageSize),
      page: opts.page,
      pageSize: opts.pageSize,
      total,
      totalPages: Math.ceil(total / opts.pageSize),
    };
  }

  return items;
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
  assertCollectionWriteAllowed(collection);

  const existing = await prisma.appJsonRow.findUnique({
    where: { collection_entityId: { collection, entityId } },
    select: { organizationId: true },
  });
  if (existing && existing.organizationId !== organizationId) {
    throw AppError.conflict("Document id already exists in another organization");
  }

  // Extract createdAt from payload for correct ordering. Fall back to now() for new rows.
  let createdAt: Date | undefined;
  if (!existing && payload && typeof payload === "object") {
    const raw = (payload as Record<string, unknown>).createdAt;
    if (typeof raw === "string" && raw) {
      const t = new Date(raw);
      if (!isNaN(t.getTime())) createdAt = t;
    }
  }

  await prisma.appJsonRow.upsert({
    where: { collection_entityId: { collection, entityId } },
    create: {
      collection,
      entityId,
      organizationId,
      payload: payload as object,
      ...(createdAt ? { createdAt } : {}),
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
  assertCollectionWriteAllowed(collection);

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
        data: uniqueItems.map((item) => {
          let createdAt: Date | undefined;
          const raw = (item as Record<string, unknown>).createdAt;
          if (typeof raw === "string" && raw) {
            const t = new Date(raw);
            if (!isNaN(t.getTime())) createdAt = t;
          }
          return {
            collection,
            entityId: item.id,
            organizationId,
            payload: item as object,
            ...(createdAt ? { createdAt } : {}),
          };
        }),
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
