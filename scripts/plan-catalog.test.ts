import { describe, expect, it } from "node:test";
import assert from "node:assert/strict";
import {
  canCreateWithLimit,
  effectiveMaxBranches,
  isUnlimited,
  parsePlanLimits,
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
});
