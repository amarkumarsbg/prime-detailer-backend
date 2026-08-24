import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyInvoiceGstGuard } from "../src/lib/gst-settings.ts";

describe("applyInvoiceGstGuard", () => {
  const taxedPayload = {
    id: "inv-1",
    subtotal: 1000,
    taxRate: 0.18,
    taxAmount: 180,
    discountAmount: 0,
    rewardDiscount: 0,
    referralDiscount: 0,
    grandTotal: 1180,
  };

  it("leaves payloads unchanged when GST is REGISTERED", () => {
    const out = applyInvoiceGstGuard(taxedPayload, null, "REGISTERED");
    assert.deepEqual(out, taxedPayload);
  });

  it("forces tax to 0 on new invoices when NOT_REGISTERED", () => {
    const out = applyInvoiceGstGuard(taxedPayload, null, "NOT_REGISTERED") as Record<
      string,
      number
    >;
    assert.equal(out.taxRate, 0);
    assert.equal(out.taxAmount, 0);
    assert.equal(out.grandTotal, 1000);
  });

  it("forces tax to 0 when previous invoice had no tax", () => {
    const prev = { ...taxedPayload, taxRate: 0, taxAmount: 0, grandTotal: 1000 };
    const out = applyInvoiceGstGuard(taxedPayload, prev, "NOT_REGISTERED") as Record<
      string,
      number
    >;
    assert.equal(out.taxAmount, 0);
    assert.equal(out.grandTotal, 1000);
  });

  it("preserves historical taxed invoices on update (payment path)", () => {
    const withPayment = {
      ...taxedPayload,
      payments: [{ id: "p1", amount: 100, method: "CASH" }],
    };
    const out = applyInvoiceGstGuard(withPayment, taxedPayload, "NOT_REGISTERED");
    assert.deepEqual(out, withPayment);
  });

  it("does not alter already-zero tax payloads", () => {
    const zero = {
      ...taxedPayload,
      taxRate: 0,
      taxAmount: 0,
      grandTotal: 1000,
    };
    const out = applyInvoiceGstGuard(zero, null, "NOT_REGISTERED");
    assert.deepEqual(out, zero);
  });

  it("recomputes grandTotal from subtotal minus discounts when stripping tax", () => {
    const withDiscount = {
      ...taxedPayload,
      discountAmount: 100,
      rewardDiscount: 50,
      referralDiscount: 50,
      taxAmount: 144,
      grandTotal: 944,
    };
    const out = applyInvoiceGstGuard(withDiscount, null, "NOT_REGISTERED") as Record<
      string,
      number
    >;
    assert.equal(out.taxAmount, 0);
    assert.equal(out.grandTotal, 800);
  });
});
