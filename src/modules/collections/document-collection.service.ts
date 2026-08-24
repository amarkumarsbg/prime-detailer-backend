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
    list(organizationId: string, allowedBranchIds?: string[] | null) {
      return listCollectionItems(collection, { organizationId, allowedBranchIds });
    },
    get(organizationId: string, entityId: string) {
      return getCollectionItem(collection, entityId, organizationId);
    },
    upsert(organizationId: string, entityId: string, payload: unknown) {
      return upsertCollectionItem(collection, entityId, payload, organizationId);
    },
    delete(organizationId: string, entityId: string) {
      return deleteCollectionItem(collection, entityId, organizationId);
    },
    replace(organizationId: string, items: { id: string }[]) {
      return replaceCollectionArray(collection, items, organizationId);
    },
  };
}
