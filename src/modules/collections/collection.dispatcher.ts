/**
 * Resolve domain handlers for a collection name. Unknown / generic → document service.
 */
import { createDocumentCollectionService } from "./document-collection.service.js";
import * as jobCards from "../job-cards/job-cards.service.js";
import * as invoices from "../invoices/invoices.service.js";
import * as quotations from "../quotations/quotations.service.js";
import * as appointments from "../appointments/appointments.service.js";
import {
  upsertExpenseMeta,
  listExpenseMeta,
  getExpenseMeta,
} from "./expense-meta.service.js";
import {
  upsertCashBank,
  listCashBank,
  getCashBank,
} from "./cash-bank.service.js";
import {
  deleteCollectionItem,
  replaceCollectionArray,
} from "./app-json-store.js";

export type CollectionWriteContext = {
  organizationId: string;
  hasJobCardPricingPermission: boolean;
  userId?: string;
  skipGenericActivityLog?: boolean;
};

export type CollectionDomainHandlers = {
  list: (
    organizationId: string,
    allowedBranchIds?: string[] | null,
    opts?: { page?: number; pageSize?: number }
  ) => Promise<unknown[] | { items: unknown[]; page: number; pageSize: number; total: number; totalPages: number }>;
  get: (organizationId: string, entityId: string) => Promise<unknown | null>;
  upsert: (entityId: string, payload: unknown, ctx: CollectionWriteContext) => Promise<void>;
  delete: (organizationId: string, entityId: string, ctx?: CollectionWriteContext) => Promise<boolean>;
  replace: (items: { id: string }[], ctx: CollectionWriteContext) => Promise<void>;
};

const documentCache = new Map<string, CollectionDomainHandlers>();

function asDocumentHandlers(collection: string): CollectionDomainHandlers {
  let cached = documentCache.get(collection);
  if (cached) return cached;
  const doc = createDocumentCollectionService(collection);
  cached = {
    list: (orgId, allowed, opts) => doc.list(orgId, allowed, opts),
    get: (orgId, id) => doc.get(orgId, id),
    upsert: (id, payload, ctx) => doc.upsert(ctx.organizationId, id, payload, ctx),
    delete: (orgId, id, ctx) => doc.delete(orgId, id, ctx),
    replace: (items, ctx) => doc.replace(ctx.organizationId, items, ctx),
  };
  documentCache.set(collection, cached);
  return cached;
}

export function getCollectionDomainHandlers(collection: string): CollectionDomainHandlers {
  if (collection === "jobCards") {
    return {
      list: (orgId, allowed, opts) => jobCards.listJobCards(orgId, allowed, opts),
      get: (orgId, id) => jobCards.getJobCard(orgId, id),
      upsert: (id, payload, ctx) =>
        jobCards.upsertJobCard(id, payload, {
          ...ctx,
          organizationId: ctx.organizationId,
          hasPricingPermission: ctx.hasJobCardPricingPermission,
        }),
      delete: (orgId, id, ctx) => jobCards.deleteJobCard(orgId, id),
      replace: (items, ctx) =>
        jobCards.replaceJobCards(items, {
          ...ctx,
          organizationId: ctx.organizationId,
          hasPricingPermission: ctx.hasJobCardPricingPermission,
        }),
    };
  }
  if (collection === "invoices") {
    return {
      list: (orgId, allowed, opts) => invoices.listInvoices(orgId, allowed, opts),
      get: (orgId, id) => invoices.getInvoice(orgId, id),
      upsert: (id, payload, ctx) => invoices.upsertInvoice(ctx.organizationId, id, payload, ctx),
      delete: (orgId, id, ctx) => invoices.deleteInvoice(orgId, id, ctx),
      replace: (items, ctx) => invoices.replaceInvoices(ctx.organizationId, items, ctx),
    };
  }
  if (collection === "quotations") {
    return {
      list: (orgId, allowed, opts) => quotations.listQuotations(orgId, allowed, opts),
      get: (orgId, id) => quotations.getQuotation(orgId, id),
      upsert: (id, payload, ctx) => quotations.upsertQuotation(ctx.organizationId, id, payload, ctx),
      delete: (orgId, id, ctx) => quotations.deleteQuotation(orgId, id, ctx),
      replace: (items, ctx) => quotations.replaceQuotations(ctx.organizationId, items, ctx),
    };
  }
  if (collection === "appointments") {
    return {
      list: (orgId, allowed, opts) => appointments.listAppointments(orgId, allowed, opts),
      get: (orgId, id) => appointments.getAppointment(orgId, id),
      upsert: (id, payload, ctx) => appointments.upsertAppointment(ctx.organizationId, id, payload, ctx),
      delete: (orgId, id, ctx) => appointments.deleteAppointment(orgId, id, ctx),
      replace: (items, ctx) => appointments.replaceAppointments(ctx.organizationId, items, ctx),
    };
  }
  if (collection === "expenseMeta") {
    return {
      list: (orgId, allowed) => listExpenseMeta(orgId, allowed),
      get: (orgId) => getExpenseMeta(orgId),
      upsert: (_id, payload, ctx) => upsertExpenseMeta(ctx.organizationId, payload),
      delete: (orgId, id) => deleteCollectionItem("expenseMeta", id, orgId),
      replace: (items, ctx) =>
        replaceCollectionArray("expenseMeta", items, ctx.organizationId),
    };
  }
  if (collection === "cashBank") {
    return {
      list: (orgId, allowed) => listCashBank(orgId, allowed),
      get: (orgId) => getCashBank(orgId),
      // Upsert: preserves accounts + transactions if new payload has empty arrays.
      upsert: (_id, payload, ctx) => upsertCashBank(ctx.organizationId, payload),
      delete: (orgId, id) => deleteCollectionItem("cashBank", id, orgId),
      replace: (items, ctx) =>
        replaceCollectionArray("cashBank", items, ctx.organizationId),
    };
  }
  return asDocumentHandlers(collection);
}
