/**
 * Invoices / billing domain service.
 * HTTP: `/api/invoices` aliases + `/api/collections/invoices` (+ public view).
 */
import {
  deleteCollectionItem,
  getCollectionItem,
  listCollectionItems,
  replaceCollectionArray,
  upsertCollectionItem,
} from "../collections/app-json-store.js";
import {
  applyInvoiceGstGuard,
  getOrgGstRegistrationStatus,
} from "../../lib/gst-settings.js";
import { handleInvoiceWalletSync } from "./wallet-sync.service.js";
import { prisma } from "../../lib/prisma.js";
import { Prisma } from "@prisma/client";
import { AppError } from "../../lib/app-error.js";
import {
  invoiceCarriesReferral,
  isNewCustomerForReferral,
  REFERRAL_EXISTING_CUSTOMER_MESSAGE,
} from "../../lib/referral-eligibility.js";

async function applyInvoiceReferralGuard(
  organizationId: string,
  payload: unknown,
  previous: unknown | null
): Promise<unknown> {
  if (!payload || typeof payload !== "object") return payload;
  const next = payload as Record<string, unknown>;
  if (!invoiceCarriesReferral(next)) return payload;

  const prev =
    previous && typeof previous === "object" ? (previous as Record<string, unknown>) : null;
  const previousCarriesReferral = Boolean(prev && invoiceCarriesReferral(prev));
  if (previousCarriesReferral) return payload;

  const customerId = typeof next.customerId === "string" ? next.customerId : "";
  if (!customerId) {
    throw AppError.validation(REFERRAL_EXISTING_CUSTOMER_MESSAGE);
  }

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId },
    select: { id: true, createdAt: true, totalVisits: true, referredBy: true },
  });
  if (!customer) {
    throw AppError.validation(REFERRAL_EXISTING_CUSTOMER_MESSAGE);
  }

  const invoiceId = typeof next.id === "string" ? next.id : "";
  const jobCardId = typeof next.jobCardId === "string" ? next.jobCardId : "";

  // Use COUNT queries with JSON operators instead of loading entire collections.
  const [otherInvoiceCountResult, otherJobCardCountResult] = await Promise.all([
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint AS count FROM "AppJsonRow"
      WHERE collection = 'invoices'
        AND "organizationId" = ${organizationId}
        AND payload->>'customerId' = ${customerId}
        ${invoiceId ? Prisma.sql`AND "entityId" != ${invoiceId}` : Prisma.empty}
    `,
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint AS count FROM "AppJsonRow"
      WHERE collection = 'jobCards'
        AND "organizationId" = ${organizationId}
        AND payload->>'customerId' = ${customerId}
        ${jobCardId ? Prisma.sql`AND "entityId" != ${jobCardId}` : Prisma.empty}
    `,
  ]);
  const otherInvoiceCount = Number(otherInvoiceCountResult[0]?.count ?? 0);
  const otherJobCardCount = Number(otherJobCardCountResult[0]?.count ?? 0);

  const isNewCustomer = isNewCustomerForReferral({
    createdAt: customer.createdAt,
    totalVisits: customer.totalVisits,
    referredBy: customer.referredBy,
    otherInvoiceCount,
    otherJobCardCount,
  });
  if (!isNewCustomer) {
    throw AppError.validation(REFERRAL_EXISTING_CUSTOMER_MESSAGE);
  }
  return payload;
}

export async function listInvoices(
  organizationId: string,
  allowedBranchIds?: string[] | null,
  opts?: { page?: number; pageSize?: number }
) {
  // Strip the `storedPdf` field from list payloads — PDFs are large base64 blobs
  // (~500KB each) and are only needed on the individual invoice GET, not on list views.
  // This dramatically reduces network transfer for the list endpoint.
  return listCollectionItems("invoices", {
    organizationId,
    allowedBranchIds,
    ...opts,
    stripPayloadFields: ["storedPdf"],
  });
}

export async function getInvoice(organizationId: string, entityId: string) {
  return getCollectionItem("invoices", entityId, organizationId);
}

export async function upsertInvoice(
  organizationId: string,
  entityId: string,
  payload: unknown,
  ctx?: import("../collections/collection.dispatcher.js").CollectionWriteContext
): Promise<void> {
  const previous = await getCollectionItem("invoices", entityId, organizationId);
  const gstStatus = await getOrgGstRegistrationStatus(organizationId);
  const guarded = applyInvoiceGstGuard(payload, previous, gstStatus);
  await applyInvoiceReferralGuard(organizationId, guarded, previous);
  await handleInvoiceWalletSync(organizationId, entityId, guarded);
  await upsertCollectionItem("invoices", entityId, guarded, organizationId, ctx);
}

export async function deleteInvoice(organizationId: string, entityId: string, ctx?: import("../collections/collection.dispatcher.js").CollectionWriteContext): Promise<boolean> {
  return deleteCollectionItem("invoices", entityId, organizationId, ctx);
}

export async function replaceInvoices(
  organizationId: string,
  items: { id: string }[],
  ctx?: import("../collections/collection.dispatcher.js").CollectionWriteContext
): Promise<void> {
  const gstStatus = await getOrgGstRegistrationStatus(organizationId);
  const existingRaw = await listCollectionItems("invoices", { organizationId });
  const existing = Array.isArray(existingRaw) ? existingRaw : existingRaw.items;
  const prevById = new Map<string, unknown>();
  for (const row of existing) {
    if (row && typeof row === "object" && typeof (row as { id?: string }).id === "string") {
      prevById.set((row as { id: string }).id, row);
    }
  }
  const guarded: { id: string }[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") {
      guarded.push(item);
      continue;
    }
    const id = (item as { id?: string }).id;
    const prev = typeof id === "string" ? prevById.get(id) ?? null : null;
    const gstGuarded = applyInvoiceGstGuard(item, prev, gstStatus) as { id: string };
    await applyInvoiceReferralGuard(organizationId, gstGuarded, prev);
    guarded.push(gstGuarded);
  }
  await replaceCollectionArray("invoices", guarded, organizationId, ctx);
}
