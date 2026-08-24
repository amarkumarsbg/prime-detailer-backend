/**
 * Unit assertions for job-card pricing guard (no DB).
 * Run: npx tsx scripts/check-job-card-pricing-guard.ts
 */
import assert from "node:assert/strict";
import {
  evaluateJobCardPricingWrite,
  jobCardHasPricingDelta,
} from "../src/lib/job-card-pricing-guard.js";

const base = {
  status: "AWAITING_SERVICE",
  services: [
    {
      id: "svc-1",
      serviceCatalogId: "cat-1",
      price: 1000,
      isCustomPrice: false,
      priceSource: "CATALOG",
    },
  ],
};

assert.equal(jobCardHasPricingDelta(base, { ...base, estimatedAmount: 9999 } as typeof base), false);

assert.equal(
  jobCardHasPricingDelta(base, {
    ...base,
    services: [{ ...base.services[0]!, price: 1500, isCustomPrice: true, priceSource: "CUSTOM" }],
  }),
  true
);

const noPerm = evaluateJobCardPricingWrite({
  hasPricingPermission: false,
  prev: base,
  next: {
    ...base,
    services: [{ ...base.services[0]!, price: 1500, isCustomPrice: true, priceSource: "CUSTOM" }],
  },
  hasInvoice: false,
});
assert.equal(noPerm.ok, false);
if (!noPerm.ok) assert.equal(noPerm.reason, "MISSING_PERMISSION");

const withPerm = evaluateJobCardPricingWrite({
  hasPricingPermission: true,
  prev: base,
  next: {
    ...base,
    services: [{ ...base.services[0]!, price: 1500, isCustomPrice: true, priceSource: "CUSTOM" }],
  },
  hasInvoice: false,
});
assert.equal(withPerm.ok, true);

const delivered = evaluateJobCardPricingWrite({
  hasPricingPermission: true,
  prev: { ...base, status: "DELIVERED" },
  next: {
    ...base,
    status: "DELIVERED",
    services: [{ ...base.services[0]!, price: 1500, isCustomPrice: true, priceSource: "CUSTOM" }],
  },
  hasInvoice: false,
});
assert.equal(delivered.ok, false);
if (!delivered.ok) assert.equal(delivered.reason, "STATUS_OR_INVOICE_LOCK");

const invoiced = evaluateJobCardPricingWrite({
  hasPricingPermission: true,
  prev: base,
  next: {
    ...base,
    services: [{ ...base.services[0]!, price: 1500, isCustomPrice: true, priceSource: "CUSTOM" }],
  },
  hasInvoice: true,
});
assert.equal(invoiced.ok, false);
if (!invoiced.ok) assert.equal(invoiced.reason, "STATUS_OR_INVOICE_LOCK");

const superAdminStyle = evaluateJobCardPricingWrite({
  hasPricingPermission: true,
  prev: base,
  next: {
    ...base,
    services: [{ ...base.services[0]!, price: 1500, isCustomPrice: true, priceSource: "CUSTOM" }],
  },
  hasInvoice: false,
});
assert.equal(superAdminStyle.ok, true);

console.log("OK: job-card pricing guard checks passed.");
