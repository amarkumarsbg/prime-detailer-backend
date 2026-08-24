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
  });
  if (!customer) {
    throw AppError.validation(REFERRAL_EXISTING_CUSTOMER_MESSAGE);
  }

  const invoiceId = typeof next.id === "string" ? next.id : "";
  const jobCardId = typeof next.jobCardId === "string" ? next.jobCardId : "";
  const invoices = await listCollectionItems("invoices", { organizationId });
  const otherInvoiceCount = invoices.filter((row) => {
    if (!row || typeof row !== "object") return false;
    const inv = row as { id?: string; customerId?: string };
    if (inv.customerId !== customerId) return false;
    if (invoiceId && inv.id === invoiceId) return false;
    return true;
  }).length;

  const jobCards = await listCollectionItems("jobCards", { organizationId });
  const otherJobCardCount = jobCards.filter((row) => {
    if (!row || typeof row !== "object") return false;
    const job = row as { id?: string; customerId?: string };
    if (job.customerId !== customerId) return false;
    if (jobCardId && job.id === jobCardId) return false;
    return true;
  }).length;

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
  allowedBranchIds?: string[] | null
) {
  return listCollectionItems("invoices", { organizationId, allowedBranchIds });
}

export async function getInvoice(organizationId: string, entityId: string) {
  return getCollectionItem("invoices", entityId, organizationId);
}

export async function upsertInvoice(
  organizationId: string,
  entityId: string,
  payload: unknown
): Promise<void> {
  const previous = await getCollectionItem("invoices", entityId, organizationId);
  const gstStatus = await getOrgGstRegistrationStatus(organizationId);
  const guarded = applyInvoiceGstGuard(payload, previous, gstStatus);
  await applyInvoiceReferralGuard(organizationId, guarded, previous);
  await handleInvoiceWalletSync(organizationId, entityId, guarded);
  await upsertCollectionItem("invoices", entityId, guarded, organizationId);
}

export async function deleteInvoice(organizationId: string, entityId: string): Promise<boolean> {
  return deleteCollectionItem("invoices", entityId, organizationId);
}

export async function replaceInvoices(
  organizationId: string,
  items: { id: string }[]
): Promise<void> {
  const gstStatus = await getOrgGstRegistrationStatus(organizationId);
  const existing = await listCollectionItems("invoices", { organizationId });
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
  await replaceCollectionArray("invoices", guarded, organizationId);
}
