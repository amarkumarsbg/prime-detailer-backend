/**
 * Pure Job Card pricing delta + write evaluation (mirrors frontend/src/lib/job-card-pricing-rbac.ts).
 * estimatedAmount / incentiveAmount are derived and are NOT treated as protected inputs.
 */

export type JobCardLike = {
  status?: string;
  services?: Array<{
    id?: string;
    serviceCatalogId?: string;
    price?: number;
    isCustomPrice?: boolean;
    priceSource?: string;
  }>;
  highEndAdvanceAmountInr?: number;
  highEndAdvanceHintPercent?: number;
  waiveHighEndAdvance?: boolean;
  highEndAdvanceCollectedAt?: string;
  highEndAdvanceMethod?: string;
  highEndAdvanceReference?: string;
};

const TOP_KEYS = [
  "highEndAdvanceAmountInr",
  "highEndAdvanceHintPercent",
  "waiveHighEndAdvance",
  "highEndAdvanceCollectedAt",
  "highEndAdvanceMethod",
  "highEndAdvanceReference",
] as const;

function numEq(a: unknown, b: unknown): boolean {
  const na = typeof a === "number" && Number.isFinite(a) ? a : null;
  const nb = typeof b === "number" && Number.isFinite(b) ? b : null;
  if (na === null && nb === null) return true;
  if (na === null || nb === null) return false;
  return Math.abs(na - nb) < 0.001;
}

function serviceLineKey(s: { id?: string; serviceCatalogId?: string }): string {
  return s.id || s.serviceCatalogId || "";
}

export function jobCardPricingEditable(status: string | undefined, hasInvoice: boolean): boolean {
  if (status === "DELIVERED" || status === "CANCELLED") return false;
  return !hasInvoice;
}

export function jobCardHasPricingDelta(prev: JobCardLike, next: JobCardLike): boolean {
  for (const key of TOP_KEYS) {
    const a = prev[key];
    const b = next[key];
    if (key === "waiveHighEndAdvance") {
      if (Boolean(a) !== Boolean(b)) return true;
      continue;
    }
    if (
      key === "highEndAdvanceMethod" ||
      key === "highEndAdvanceReference" ||
      key === "highEndAdvanceCollectedAt"
    ) {
      if (String(a ?? "") !== String(b ?? "")) return true;
      continue;
    }
    if (!numEq(a, b)) return true;
  }

  const prevServices = prev.services ?? [];
  const nextServices = next.services ?? [];
  const prevByKey = new Map(prevServices.map((s) => [serviceLineKey(s), s]));
  const nextByKey = new Map(nextServices.map((s) => [serviceLineKey(s), s]));

  for (const [key, n] of nextByKey) {
    const p = prevByKey.get(key);
    if (!p) {
      if (n.isCustomPrice === true || n.priceSource === "CUSTOM") return true;
      continue;
    }
    if (!numEq(p.price, n.price)) return true;
    if (Boolean(p.isCustomPrice) !== Boolean(n.isCustomPrice)) return true;
    if (String(p.priceSource ?? "") !== String(n.priceSource ?? "")) {
      if (n.priceSource === "CUSTOM" || p.priceSource === "CUSTOM") return true;
      if (Boolean(n.isCustomPrice) || Boolean(p.isCustomPrice)) return true;
    }
  }

  return false;
}

export type JobCardPricingWriteDecision =
  | { ok: true }
  | { ok: false; reason: "MISSING_PERMISSION" | "STATUS_OR_INVOICE_LOCK"; message: string };

export function evaluateJobCardPricingWrite(opts: {
  hasPricingPermission: boolean;
  prev: JobCardLike;
  next: JobCardLike;
  hasInvoice: boolean;
}): JobCardPricingWriteDecision {
  if (!jobCardHasPricingDelta(opts.prev, opts.next)) {
    return { ok: true };
  }
  if (!opts.hasPricingPermission) {
    return {
      ok: false,
      reason: "MISSING_PERMISSION",
      message: "Forbidden: Missing permission JOB_CARD_PRICING",
    };
  }
  if (!jobCardPricingEditable(opts.prev.status, opts.hasInvoice)) {
    return {
      ok: false,
      reason: "STATUS_OR_INVOICE_LOCK",
      message: opts.hasInvoice
        ? "Job card pricing is locked because an invoice already exists"
        : "Job card pricing is locked for this status",
    };
  }
  return { ok: true };
}
