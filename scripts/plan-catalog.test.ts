import { describe, expect, it } from "node:test";
import assert from "node:assert/strict";
import {
  canCreateWithLimit,
  effectiveMaxBranches,
  effectiveMaxCustomers,
  isUnlimited,
  parsePlanLimits,
  remainingCapacity,
  PLAN_CATALOG,
} from "../src/lib/plan-catalog.ts";

describe("plan-catalog", () => {
  it("parses limits and treats null as unlimited", () => {
    assert.deepEqual(parsePlanLimits({ maxBranches: null }).maxBranches, null);
    assert.equal(isUnlimited(null), true);
    assert.equal(canCreateWithLimit(100, null), true);
  });

  it("override wins over plan limits", () => {
    assert.equal(effectiveMaxBranches({ maxBranches: 1 }, 5), 5);
    assert.equal(effectiveMaxBranches({ maxBranches: 10 }, null), 10);
  });

  it("blocks at capacity", () => {
    assert.equal(canCreateWithLimit(1, 1), false);
    assert.equal(canCreateWithLimit(0, 1), true);
  });

  it("defines maxCustomers on catalog plans", () => {
    assert.equal(PLAN_CATALOG.STARTER.limits.maxCustomers, 100);
    assert.equal(PLAN_CATALOG.ENTERPRISE.limits.maxCustomers, null);
    assert.equal(effectiveMaxCustomers({ maxBranches: 1, maxCustomers: 50 }), 50);
    assert.equal(effectiveMaxCustomers({ maxBranches: 1 }), null);
    assert.equal(remainingCapacity(98, 100), 2);
    assert.equal(remainingCapacity(100, 100), 0);
    assert.equal(remainingCapacity(5, null), null);
  });
});
