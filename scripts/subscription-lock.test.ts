import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addMonths,
  daysUntilExpiry,
  graceOrLockStatus,
  isExportLocked,
  termLabelFromMonths,
} from "../src/lib/subscription-lock.js";

describe("subscription-lock", () => {
  it("locks when 30 or fewer days remain", () => {
    const now = new Date("2026-08-21T12:00:00.000Z");
    const in30 = new Date("2026-09-20T12:00:00.000Z");
    const in31 = new Date("2026-09-21T12:00:00.000Z");
    assert.equal(daysUntilExpiry(in30, now), 30);
    assert.equal(isExportLocked(in30, now), true);
    assert.equal(graceOrLockStatus(in30, now), "EXPORT_LOCKED");
    assert.equal(isExportLocked(in31, now), false);
    assert.equal(graceOrLockStatus(in31, now), "OK");
  });

  it("marks expired when past expiry", () => {
    const now = new Date("2026-08-21T12:00:00.000Z");
    const past = new Date("2026-08-01T12:00:00.000Z");
    assert.ok((daysUntilExpiry(past, now) ?? 0) < 0);
    assert.equal(isExportLocked(past, now), true);
    assert.equal(graceOrLockStatus(past, now), "EXPIRED");
  });

  it("does not lock when expiresAt is null", () => {
    assert.equal(isExportLocked(null), false);
    assert.equal(graceOrLockStatus(null), "OK");
  });

  it("adds months and labels terms", () => {
    const start = new Date("2026-01-15T00:00:00.000Z");
    const end = addMonths(start, 12);
    assert.ok(end.toISOString().startsWith("2027-01-15"));
    assert.equal(termLabelFromMonths(12), "1 year");
    assert.equal(termLabelFromMonths(24), "2 years");
    assert.equal(termLabelFromMonths(36), "3 years");
  });
});
