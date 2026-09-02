/**
 * Quotations domain service.
 * HTTP: `/api/quotations` aliases + `/api/collections/quotations` (+ convert action).
 */
import {
  deleteCollectionItem,
  getCollectionItem,
  listCollectionItems,
  replaceCollectionArray,
  upsertCollectionItem,
} from "../collections/app-json-store.js";

export async function listQuotations(
  organizationId: string,
  allowedBranchIds?: string[] | null,
  opts?: { page?: number; pageSize?: number }
) {
  return listCollectionItems("quotations", { organizationId, allowedBranchIds, ...opts });
}

export async function getQuotation(organizationId: string, entityId: string) {
  return getCollectionItem("quotations", entityId, organizationId);
}

export async function upsertQuotation(
  organizationId: string,
  entityId: string,
  payload: unknown,
  ctx?: import("../collections/collection.dispatcher.js").CollectionWriteContext
): Promise<void> {
  await upsertCollectionItem("quotations", entityId, payload, organizationId, ctx);
}

export async function deleteQuotation(
  organizationId: string,
  entityId: string,
  ctx?: import("../collections/collection.dispatcher.js").CollectionWriteContext
): Promise<boolean> {
  return deleteCollectionItem("quotations", entityId, organizationId, ctx);
}

export async function replaceQuotations(
  organizationId: string,
  items: { id: string }[],
  ctx?: import("../collections/collection.dispatcher.js").CollectionWriteContext
): Promise<void> {
  await replaceCollectionArray("quotations", items, organizationId, ctx);
}

export { convertQuotationToJob } from "./quotation-convert.service.js";
