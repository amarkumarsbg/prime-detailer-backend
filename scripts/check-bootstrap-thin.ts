/**
 * Assert thin bootstrap payload shape (no domain dump).
 * Run: npm run test:bootstrap-thin
 */
import assert from "node:assert/strict";
import { BRANDING_KEYS, extractBranding } from "../src/lib/data-scope.js";

const FORBIDDEN_TOP_LEVEL = [
  "customers",
  "vehicles",
  "users",
  "collections",
  "jobCards",
  "invoices",
  "payroll",
  "cashBank",
] as const;

const FORBIDDEN_BRANDING = [
  "bankAccountNumber",
  "bankIfsc",
  "bankUpi",
  "gstin",
  "companyPan",
  "bankName",
] as const;

/** Simulated thin payload contract (mirrors getBootstrapPayload return keys). */
const THIN_KEYS = new Set(["branches", "branding", "entitlement"]);

function assertThinShape(payload: Record<string, unknown>) {
  for (const key of Object.keys(payload)) {
    assert.ok(THIN_KEYS.has(key), `unexpected bootstrap key: ${key}`);
  }
  for (const bad of FORBIDDEN_TOP_LEVEL) {
    assert.equal(bad in payload, false, `bootstrap must not include ${bad}`);
  }
  assert.ok(Array.isArray(payload.branches), "branches must be an array");
  assert.equal(typeof payload.branding, "object");
  assert.ok(payload.branding && !Array.isArray(payload.branding));
  const branding = payload.branding as Record<string, unknown>;
  for (const bad of FORBIDDEN_BRANDING) {
    assert.equal(bad in branding, false, `branding must not include ${bad}`);
  }
  for (const key of Object.keys(branding)) {
    assert.ok(
      (BRANDING_KEYS as readonly string[]).includes(key),
      `unexpected branding key: ${key}`
    );
  }
}

assertThinShape({
  branches: [],
  branding: extractBranding({
    businessName: "X",
    brandPrimary: "#000000",
    gstRegistrationStatus: "NOT_REGISTERED",
    bankAccountNumber: "should-be-stripped",
    gstin: "should-be-stripped",
  }),
  entitlement: null,
});

assert.deepEqual(
  extractBranding({
    businessName: "Studio",
    bankAccountNumber: "secret",
    gstin: "secret",
    gstRegistrationStatus: "REGISTERED",
  }),
  { businessName: "Studio", gstRegistrationStatus: "REGISTERED" }
);

console.log("OK: thin bootstrap contract checks passed.");
