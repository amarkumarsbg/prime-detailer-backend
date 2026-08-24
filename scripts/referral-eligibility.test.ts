import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  invoiceCarriesReferral,
  isNewCustomerForReferral,
  shouldAllowNewInvoiceReferral,
} from "../src/lib/referral-eligibility.ts";

describe("isNewCustomerForReferral", () => {
  const now = Date.parse("2026-08-18T12:00:00.000Z");

  it("allows a recently created customer with no prior invoices", () => {
    assert.equal(
      isNewCustomerForReferral({
        createdAt: "2026-08-18T11:00:00.000Z",
        totalVisits: 1,
        otherInvoiceCount: 0,
        nowMs: now,
      }),
      true
    );
  });

  it("blocks an older directory customer without referredBy", () => {
    assert.equal(
      isNewCustomerForReferral({
        createdAt: "2025-01-01T00:00:00.000Z",
        totalVisits: 0,
        otherInvoiceCount: 0,
        nowMs: now,
      }),
      false
    );
  });

  it("blocks when the customer already has another job card", () => {
    assert.equal(
      isNewCustomerForReferral({
        createdAt: "2026-08-18T11:00:00.000Z",
        totalVisits: 1,
        referredBy: "REF-AB12",
        otherInvoiceCount: 0,
        otherJobCardCount: 1,
        nowMs: now,
      }),
      false
    );
  });
});

describe("invoiceCarriesReferral", () => {
  it("is true when a referral discount or code is present", () => {
    assert.equal(invoiceCarriesReferral({ referralDiscount: 200 }), true);
    assert.equal(invoiceCarriesReferral({ referralCodeUsed: "REF-1" }), true);
    assert.equal(invoiceCarriesReferral({ referralDiscount: 0 }), false);
  });
});

describe("shouldAllowNewInvoiceReferral", () => {
  it("allows a new referral only for a new customer", () => {
    assert.equal(
      shouldAllowNewInvoiceReferral({
        payloadCarriesReferral: true,
        previousCarriesReferral: false,
        isNewCustomer: true,
      }),
      true
    );
    assert.equal(
      shouldAllowNewInvoiceReferral({
        payloadCarriesReferral: true,
        previousCarriesReferral: false,
        isNewCustomer: false,
      }),
      false
    );
  });

  it("allows persisting an invoice that already had a referral", () => {
    assert.equal(
      shouldAllowNewInvoiceReferral({
        payloadCarriesReferral: true,
        previousCarriesReferral: true,
        isNewCustomer: false,
      }),
      true
    );
  });
});
