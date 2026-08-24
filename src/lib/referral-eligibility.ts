import { AppError } from "./app-error.js";

export const REFERRAL_NEW_CUSTOMER_WINDOW_MS = 48 * 60 * 60 * 1000;

export const REFERRAL_EXISTING_CUSTOMER_MESSAGE =
  "Referral codes can only be used for new customers — not existing customers.";

export function invoiceCarriesReferral(inv: {
  referralDiscount?: unknown;
  referralCodeUsed?: unknown;
}): boolean {
  const discount = typeof inv.referralDiscount === "number" ? inv.referralDiscount : Number(inv.referralDiscount);
  const code = typeof inv.referralCodeUsed === "string" ? inv.referralCodeUsed.trim() : "";
  return (Number.isFinite(discount) ? discount : 0) > 0.01 || Boolean(code);
}

export function isNewCustomerForReferral(input: {
  createdAt: Date | string;
  totalVisits: number;
  referredBy?: string | null;
  otherInvoiceCount: number;
  otherJobCardCount?: number;
  nowMs?: number;
}): boolean {
  if (input.otherInvoiceCount > 0) return false;
  if ((input.otherJobCardCount ?? 0) > 0) return false;
  if (input.totalVisits > 1) return false;
  if (input.referredBy?.trim()) return true;
  const created =
    input.createdAt instanceof Date ? input.createdAt.getTime() : new Date(input.createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  const now = input.nowMs ?? Date.now();
  return now - created <= REFERRAL_NEW_CUSTOMER_WINDOW_MS;
}

export function assertNewCustomerReferralAllowed(input: {
  createdAt: Date | string;
  totalVisits: number;
  referredBy?: string | null;
  otherInvoiceCount: number;
  otherJobCardCount?: number;
}): void {
  if (!isNewCustomerForReferral(input)) {
    throw AppError.validation(REFERRAL_EXISTING_CUSTOMER_MESSAGE);
  }
}

/** New referral on an invoice is allowed only for a first-visit new customer. Historical rows may persist. */
export function shouldAllowNewInvoiceReferral(input: {
  payloadCarriesReferral: boolean;
  previousCarriesReferral: boolean;
  isNewCustomer: boolean;
}): boolean {
  if (!input.payloadCarriesReferral) return true;
  if (input.previousCarriesReferral) return true;
  return input.isNewCustomer;
}
