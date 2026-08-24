/**
 * Resolve domain handlers for a collection name. Unknown / generic → document service.
 */
import { createDocumentCollectionService } from "./document-collection.service.js";
import * as jobCards from "../job-cards/job-cards.service.js";
import * as invoices from "../invoices/invoices.service.js";
import * as quotations from "../quotations/quotations.service.js";

export type CollectionWriteContext = {
  organizationId: string;
  hasJobCardPricingPermission: boolean;
};

export type CollectionDomainHandlers = {
  list: (
    organizationId: string,
    allowedBranchIds?: string[] | null
  ) => Promise<unknown[]>;
  get: (organizationId: string, entityId: string) => Promise<unknown | null>;
  upsert: (entityId: string, payload: unknown, ctx: CollectionWriteContext) => Promise<void>;
  delete: (organizationId: string, entityId: string) => Promise<boolean>;
  replace: (items: { id: string }[], ctx: CollectionWriteContext) => Promise<void>;
};

const documentCache = new Map<string, CollectionDomainHandlers>();

function asDocumentHandlers(collection: string): CollectionDomainHandlers {
  let cached = documentCache.get(collection);
  if (cached) return cached;
  const doc = createDocumentCollectionService(collection);
  cached = {
    list: (orgId, allowed) => doc.list(orgId, allowed),
    get: (orgId, id) => doc.get(orgId, id),
    upsert: (id, payload, ctx) => doc.upsert(ctx.organizationId, id, payload),
    delete: (orgId, id) => doc.delete(orgId, id),
    replace: (items, ctx) => doc.replace(ctx.organizationId, items),
  };
  documentCache.set(collection, cached);
  return cached;
}

export function getCollectionDomainHandlers(collection: string): CollectionDomainHandlers {
  if (collection === "jobCards") {
    return {
      list: (orgId, allowed) => jobCards.listJobCards(orgId, allowed),
      get: (orgId, id) => jobCards.getJobCard(orgId, id),
      upsert: (id, payload, ctx) =>
        jobCards.upsertJobCard(id, payload, {
          organizationId: ctx.organizationId,
          hasPricingPermission: ctx.hasJobCardPricingPermission,
        }),
      delete: (orgId, id) => jobCards.deleteJobCard(orgId, id),
      replace: (items, ctx) =>
        jobCards.replaceJobCards(items, {
          organizationId: ctx.organizationId,
          hasPricingPermission: ctx.hasJobCardPricingPermission,
        }),
    };
  }
  if (collection === "invoices") {
    return {
      list: (orgId, allowed) => invoices.listInvoices(orgId, allowed),
      get: (orgId, id) => invoices.getInvoice(orgId, id),
      upsert: (id, payload, ctx) => invoices.upsertInvoice(ctx.organizationId, id, payload),
      delete: (orgId, id) => invoices.deleteInvoice(orgId, id),
      replace: (items, ctx) => invoices.replaceInvoices(ctx.organizationId, items),
    };
  }
  if (collection === "quotations") {
    return {
      list: (orgId, allowed) => quotations.listQuotations(orgId, allowed),
      get: (orgId, id) => quotations.getQuotation(orgId, id),
      upsert: (id, payload, ctx) => quotations.upsertQuotation(ctx.organizationId, id, payload),
      delete: (orgId, id) => quotations.deleteQuotation(orgId, id),
      replace: (items, ctx) => quotations.replaceQuotations(ctx.organizationId, items),
    };
  }
  return asDocumentHandlers(collection);
}
