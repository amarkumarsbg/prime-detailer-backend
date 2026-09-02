/**
 * Default domain handler for AppJsonRow collections without specialized business rules.
 */
import {
  deleteCollectionItem,
  getCollectionItem,
  listCollectionItems,
  replaceCollectionArray,
  upsertCollectionItem,
} from "./app-json-store.js";

export function createDocumentCollectionService(collection: string) {
  return {
    async list(
      organizationId: string,
      allowedBranchIds?: string[] | null,
      opts?: { page?: number; pageSize?: number }
    ): Promise<unknown[]> {
      return listCollectionItems(collection, { organizationId, allowedBranchIds, ...opts }) as unknown as Promise<unknown[]>;
    },
    get(organizationId: string, entityId: string) {
      return getCollectionItem(collection, entityId, organizationId);
    },
    upsert(organizationId: string, entityId: string, payload: unknown, ctx?: import("./collection.dispatcher.js").CollectionWriteContext) {
      return upsertCollectionItem(collection, entityId, payload, organizationId, ctx);
    },
    delete(organizationId: string, entityId: string, ctx?: import("./collection.dispatcher.js").CollectionWriteContext) {
      return deleteCollectionItem(collection, entityId, organizationId, ctx);
    },
    replace(organizationId: string, items: { id: string }[], ctx?: import("./collection.dispatcher.js").CollectionWriteContext) {
      return replaceCollectionArray(collection, items, organizationId, ctx);
    },
  };
}
