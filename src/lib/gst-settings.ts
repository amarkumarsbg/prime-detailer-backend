/**
 * Org GST registration from appSettings singleton.
 * Used to guard invoice writes when the business is not GST-registered.
 */
import { getCollectionItem } from "../modules/collections/app-json-store.js";
import { SINGLETON_ENTITY_ID } from "../constants/json-collections.js";

export type GstRegistrationStatus = "REGISTERED" | "NOT_REGISTERED";

/** Matches frontend default when appSettings row is missing. */
export async function getOrgGstRegistrationStatus(
  organizationId: string
): Promise<GstRegistrationStatus> {
  const settings = await getCollectionItem("appSettings", SINGLETON_ENTITY_ID, organizationId);
  if (settings && typeof settings === "object") {
    const status = (settings as { gstRegistrationStatus?: unknown }).gstRegistrationStatus;
    if (status === "NOT_REGISTERED") return "NOT_REGISTERED";
  }
  return "REGISTERED";
}

/**
 * When org is NOT_REGISTERED, strip non-zero tax from new / previously untaxed invoices.
 * Historical invoices that already have taxAmount > 0 are left unchanged (payment updates).
 */
export function applyInvoiceGstGuard(
  payload: unknown,
  previous: unknown | null,
  status: GstRegistrationStatus
): unknown {
  if (status !== "NOT_REGISTERED") return payload;
  if (!payload || typeof payload !== "object") return payload;

  const inv = payload as Record<string, unknown>;
  const incomingTax = toFiniteNumber(inv.taxAmount);
  const incomingRate = toFiniteNumber(inv.taxRate);

  if (incomingTax <= 0 && incomingRate <= 0) {
    return payload;
  }

  const prevTax =
    previous && typeof previous === "object"
      ? toFiniteNumber((previous as Record<string, unknown>).taxAmount)
      : 0;

  // Preserve historical GST invoices (e.g. Record Payment PUT with existing tax).
  if (prevTax > 0) {
    return payload;
  }

  const next = { ...inv };
  const subtotal = toFiniteNumber(next.subtotal);
  const discountAmount = toFiniteNumber(next.discountAmount);
  const rewardDiscount = toFiniteNumber(next.rewardDiscount);
  const referralDiscount = toFiniteNumber(next.referralDiscount);
  const taxable = Math.max(0, subtotal - discountAmount - rewardDiscount - referralDiscount);
  next.taxRate = 0;
  next.taxAmount = 0;
  next.grandTotal = Math.round(taxable * 100) / 100;
  return next;
}

function toFiniteNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}
