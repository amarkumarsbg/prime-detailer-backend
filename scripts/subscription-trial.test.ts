/**
 * Subscription trial: provision-with-trial + convert-trial + access rules.
 * Run: npm run test:subscription-trial
 */
import "dotenv/config";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { sanitizeDatabaseUrl } from "../src/config/env.js";
import { provisionTenant } from "../src/modules/platform/provision-organization.service.js";
import { convertTrialSubscription } from "../src/modules/organization/organization-subscription.service.js";
import {
  evaluateWorkshopAccess,
  loadOrgWorkshopAccess,
  addDays,
} from "../src/lib/workshop-access.js";
import { AppHttpError } from "../src/lib/app-http-error.js";

const prisma = new PrismaClient({
  datasources: { db: { url: sanitizeDatabaseUrl(process.env.DATABASE_URL ?? "") } },
});

const createdOrgIds: string[] = [];
const STRONG_PASSWORD = "Trial#TestPass1";

function suffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function cleanup() {
  for (const id of createdOrgIds) {
    await prisma.organization.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
}

describe("subscription trial", () => {
  before(async () => {
    await prisma.$queryRaw`SELECT 1`;
  });

  after(async () => {
    await cleanup();
  });

  it("provisions a TRIAL tenant with trialEndsAt and allows workshop access", async () => {
    const s = suffix();
    const result = await provisionTenant(
      {
        organizationName: `Trial Org ${s}`,
        ownerName: "Trial Owner",
        ownerEmail: `trial-${s}@example.com`,
        ownerPhone: "9555555555",
        ownerPassword: STRONG_PASSWORD,
        branchName: "HQ",
        startTrial: true,
        trialDays: 14,
      },
      "test:trial"
    );
    createdOrgIds.push(result.organization.id);

    assert.equal(result.subscription.status, "TRIAL");
    assert.equal(result.subscription.paymentStatus, "PENDING");
    assert.ok(result.subscription.trialEndsAt);
    assert.equal(result.subscription.expiresAt, null);

    const access = await loadOrgWorkshopAccess(result.organization.id);
    assert.equal(access.ok, true);

    const sub = await prisma.organizationSubscription.findUniqueOrThrow({
      where: { organizationId: result.organization.id },
    });
    assert.equal(sub.status, "TRIAL");
    assert.ok(sub.trialEndsAt);
    const ms = sub.trialEndsAt!.getTime() - Date.now();
    assert.ok(ms > 13 * 24 * 60 * 60 * 1000);
    assert.ok(ms < 15 * 24 * 60 * 60 * 1000);
  });

  it("blocks workshop access when trialEndsAt is in the past", async () => {
    const past = addDays(new Date(), -2);
    const denied = evaluateWorkshopAccess(
      { isActive: true },
      { status: "TRIAL", trialEndsAt: past }
    );
    assert.equal(denied.ok, false);
    if (!denied.ok) assert.equal(denied.code, "SUBSCRIPTION_TRIAL_ENDED");
  });

  it("converts TRIAL → ACTIVE with term window and clears trialEndsAt", async () => {
    const s = suffix();
    const provisioned = await provisionTenant(
      {
        organizationName: `Convert Trial ${s}`,
        ownerName: "Owner",
        ownerEmail: `convert-${s}@example.com`,
        ownerPhone: "9666666666",
        ownerPassword: STRONG_PASSWORD,
        branchName: "HQ",
        startTrial: true,
        trialDays: 7,
      },
      "test:trial"
    );
    createdOrgIds.push(provisioned.organization.id);

    const entitlement = await convertTrialSubscription(
      provisioned.organization.id,
      "test:trial",
      { termMonths: 12, markPaid: false }
    );

    assert.equal(entitlement.subscription.status, "ACTIVE");
    assert.equal(entitlement.subscription.isTrial, false);
    assert.equal(entitlement.subscription.trialEndsAt, null);
    assert.equal(entitlement.subscription.paymentStatus, "PENDING");
    assert.ok(entitlement.subscription.expiresAt);

    const sub = await prisma.organizationSubscription.findUniqueOrThrow({
      where: { organizationId: provisioned.organization.id },
    });
    assert.equal(sub.status, "ACTIVE");
    assert.equal(sub.trialEndsAt, null);
    assert.equal(sub.paymentStatus, "PENDING");
    assert.ok(sub.expiresAt);

    const access = await loadOrgWorkshopAccess(provisioned.organization.id);
    assert.equal(access.ok, true);
  });

  it("convert-trial rejects non-trial subscriptions", async () => {
    const s = suffix();
    const provisioned = await provisionTenant(
      {
        organizationName: `Not Trial ${s}`,
        ownerName: "Owner",
        ownerEmail: `nottrial-${s}@example.com`,
        ownerPhone: "9777777777",
        ownerPassword: STRONG_PASSWORD,
        branchName: "HQ",
        startTrial: false,
      },
      "test:trial"
    );
    createdOrgIds.push(provisioned.organization.id);

    await assert.rejects(
      () => convertTrialSubscription(provisioned.organization.id, "test:trial", { termMonths: 12 }),
      (err: unknown) => {
        assert.ok(err instanceof AppHttpError);
        assert.equal(err.code, "NOT_IN_TRIAL");
        return true;
      }
    );
  });

  it("convert with markPaid=true sets paymentStatus PAID", async () => {
    const s = suffix();
    const provisioned = await provisionTenant(
      {
        organizationName: `Paid Convert ${s}`,
        ownerName: "Owner",
        ownerEmail: `paidconv-${s}@example.com`,
        ownerPhone: "9888888888",
        ownerPassword: STRONG_PASSWORD,
        branchName: "HQ",
        startTrial: true,
        trialDays: 3,
      },
      "test:trial"
    );
    createdOrgIds.push(provisioned.organization.id);

    const entitlement = await convertTrialSubscription(
      provisioned.organization.id,
      "test:trial",
      { termMonths: 12, markPaid: true, planCode: "GROWTH" }
    );
    assert.equal(entitlement.subscription.status, "ACTIVE");
    assert.equal(entitlement.subscription.paymentStatus, "PAID");
    assert.equal(entitlement.subscription.planCode, "GROWTH");
  });
});
