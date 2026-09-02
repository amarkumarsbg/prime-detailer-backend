/**
 * Workshop access evaluation unit checks (includes Trial).
 * Run: npx tsx scripts/workshop-access.test.ts
 */
import assert from "node:assert/strict";
import { evaluateWorkshopAccess, addDays } from "../src/lib/workshop-access.js";

assert.equal(evaluateWorkshopAccess({ isActive: true }, { status: "ACTIVE" }).ok, true);
assert.equal(evaluateWorkshopAccess({ isActive: true }, { status: "PAST_DUE" }).ok, true);

const now = new Date("2026-06-15T12:00:00.000Z");
const future = addDays(now, 7);
const past = addDays(now, -1);

assert.equal(
  evaluateWorkshopAccess({ isActive: true }, { status: "TRIAL", trialEndsAt: future }, now).ok,
  true
);
assert.equal(
  evaluateWorkshopAccess({ isActive: true }, { status: "TRIAL", trialEndsAt: null }, now).ok,
  true
);

const trialEnded = evaluateWorkshopAccess(
  { isActive: true },
  { status: "TRIAL", trialEndsAt: past },
  now
);
assert.equal(trialEnded.ok, false);
if (!trialEnded.ok) assert.equal(trialEnded.code, "SUBSCRIPTION_TRIAL_ENDED");

const inactive = evaluateWorkshopAccess({ isActive: false }, { status: "ACTIVE" });
assert.equal(inactive.ok, false);
if (!inactive.ok) assert.equal(inactive.code, "ORG_INACTIVE");

const expired = evaluateWorkshopAccess({ isActive: true }, { status: "EXPIRED" });
assert.equal(expired.ok, false);
if (!expired.ok) assert.equal(expired.code, "SUBSCRIPTION_EXPIRED");

const cancelled = evaluateWorkshopAccess({ isActive: true }, { status: "CANCELLED" });
assert.equal(cancelled.ok, false);
if (!cancelled.ok) assert.equal(cancelled.code, "SUBSCRIPTION_CANCELLED");

const missingSub = evaluateWorkshopAccess({ isActive: true }, null);
assert.equal(missingSub.ok, false);
if (!missingSub.ok) assert.equal(missingSub.code, "SUBSCRIPTION_MISSING");

const missingOrg = evaluateWorkshopAccess(null, { status: "ACTIVE" });
assert.equal(missingOrg.ok, false);
if (!missingOrg.ok) assert.equal(missingOrg.code, "ORG_MISSING");

console.log("workshop-access.test.ts: ok");
