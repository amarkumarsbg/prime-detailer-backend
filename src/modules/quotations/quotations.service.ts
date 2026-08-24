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
  allowedBranchIds?: string[] | null
) {
  return listCollectionItems("quotations", { organizationId, allowedBranchIds });
}

export async function getQuotation(organizationId: string, entityId: string) {
  return getCollectionItem("quotations", entityId, organizationId);
}

export async function upsertQuotation(
  organizationId: string,
  entityId: string,
  payload: unknown
): Promise<void> {
  await upsertCollectionItem("quotations", entityId, payload, organizationId);
}

export async function deleteQuotation(
  organizationId: string,
  entityId: string
): Promise<boolean> {
  return deleteCollectionItem("quotations", entityId, organizationId);
}

export async function replaceQuotations(
  organizationId: string,
  items: { id: string }[]
): Promise<void> {
  await replaceCollectionArray("quotations", items, organizationId);
}

export { convertQuotationToJob } from "./quotation-convert.service.js";
