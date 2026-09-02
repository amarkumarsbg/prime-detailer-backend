/**
 * SaaS subscription billing gateway (Step 6).
 * Run: npm run test:billing-gateway
 *
 * Uses MOCK provider (no Razorpay network). Requires DATABASE_URL.
 */
import "dotenv/config";
import { createHmac } from "node:crypto";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { sanitizeDatabaseUrl } from "../src/config/env.js";
import { provisionTenant } from "../src/modules/platform/provision-organization.service.js";
import {
  createSubscriptionCheckout,
  confirmSubscriptionCheckout,
  handleBillingWebhook,
  getBillingGatewayStatus,
} from "../src/modules/billing/subscription-checkout.service.js";
import { resolveBillingGatewayProviderId } from "../src/modules/billing/billing-provider.js";
import { AppHttpError } from "../src/lib/app-http-error.js";

process.env.BILLING_GATEWAY_PROVIDER = "mock";
process.env.BILLING_WEBHOOK_SECRET = process.env.BILLING_WEBHOOK_SECRET || "test-billing-webhook-secret";

const prisma = new PrismaClient({
  datasources: { db: { url: sanitizeDatabaseUrl(process.env.DATABASE_URL ?? "") } },
});

const createdOrgIds: string[] = [];
const STRONG_PASSWORD = "Billing#Test1";

function suffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function cleanup() {
  for (const id of createdOrgIds) {
    await prisma.organization.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
}

describe("billing gateway provider resolution", () => {
  it("resolves mock when BILLING_GATEWAY_PROVIDER=mock", () => {
    assert.equal(resolveBillingGatewayProviderId(), "MOCK");
    assert.equal(getBillingGatewayStatus().enabled, true);
  });
});

describe("subscription checkout (MOCK)", () => {
  before(async () => {
    await prisma.$queryRaw`SELECT 1`;
  });

  after(async () => {
    await cleanup();
  });

  it("creates checkout, confirms with token, activates paid term", async () => {
    const s = suffix();
    const tenant = await provisionTenant(
      {
        organizationName: `Bill Org ${s}`,
        ownerName: "Bill Owner",
        ownerEmail: `bill-${s}@example.com`,
        ownerPhone: "9444444444",
        ownerPassword: STRONG_PASSWORD,
        branchName: "HQ",
        startTrial: true,
        trialDays: 7,
      },
      "test:billing"
    );
    createdOrgIds.push(tenant.organization.id);

    const session = await createSubscriptionCheckout(
      tenant.organization.id,
      "test:billing",
      { termMonths: 12 }
    );

    assert.equal(session.provider, "MOCK");
    assert.equal(session.payment.status, "PROCESSING");
    assert.ok(session.order.confirmToken);
    assert.ok(session.order.orderId);
    assert.ok((session.payment.amount ?? 0) > 0);

    const entitlement = await confirmSubscriptionCheckout(
      tenant.organization.id,
      {
        paymentId: session.payment.id,
        confirmToken: session.order.confirmToken!,
      },
      "test:billing"
    );

    assert.equal(entitlement.subscription.status, "ACTIVE");
    assert.equal(entitlement.subscription.paymentStatus, "PAID");
    assert.ok(entitlement.subscription.expiresAt);
    assert.equal(entitlement.subscription.trialEndsAt, null);

    const bill = await prisma.subscriptionBill.findFirst({
      where: { organizationId: tenant.organization.id },
    });
    assert.ok(bill);

    // Idempotent confirm
    const again = await confirmSubscriptionCheckout(
      tenant.organization.id,
      {
        paymentId: session.payment.id,
        confirmToken: session.order.confirmToken!,
      },
      "test:billing"
    );
    assert.equal(again.subscription.paymentStatus, "PAID");
    const billCount = await prisma.subscriptionBill.count({
      where: { organizationId: tenant.organization.id },
    });
    assert.equal(billCount, 1);
  });

  it("rejects bad confirm token", async () => {
    const s = suffix();
    const tenant = await provisionTenant(
      {
        organizationName: `Bill Bad ${s}`,
        ownerName: "Bill Owner",
        ownerEmail: `bill-bad-${s}@example.com`,
        ownerPhone: "9333333333",
        ownerPassword: STRONG_PASSWORD,
        branchName: "HQ",
      },
      "test:billing"
    );
    createdOrgIds.push(tenant.organization.id);

    const session = await createSubscriptionCheckout(
      tenant.organization.id,
      "test:billing",
      { termMonths: 12 }
    );

    await assert.rejects(
      () =>
        confirmSubscriptionCheckout(
          tenant.organization.id,
          { paymentId: session.payment.id, confirmToken: "not-a-real-token" },
          "test:billing"
        ),
      (err: unknown) => {
        assert.ok(err instanceof AppHttpError);
        assert.equal(err.status, 401);
        assert.equal(err.code, "BILLING_CONFIRM_INVALID");
        return true;
      }
    );
  });

  it("completes payment via signed mock webhook", async () => {
    const s = suffix();
    const tenant = await provisionTenant(
      {
        organizationName: `Bill Hook ${s}`,
        ownerName: "Bill Owner",
        ownerEmail: `bill-hook-${s}@example.com`,
        ownerPhone: "9222222222",
        ownerPassword: STRONG_PASSWORD,
        branchName: "HQ",
      },
      "test:billing"
    );
    createdOrgIds.push(tenant.organization.id);

    const session = await createSubscriptionCheckout(
      tenant.organization.id,
      "test:billing",
      { termMonths: 12 }
    );

    const bodyObj = {
      paymentId: session.payment.id,
      organizationId: tenant.organization.id,
      outcome: "PAID",
      txnReference: `MOCK-WH-${session.payment.id}`,
      orderId: session.order.orderId,
      amount: session.payment.amount,
    };
    const raw = Buffer.from(JSON.stringify(bodyObj), "utf8");
    const sig = createHmac("sha256", process.env.BILLING_WEBHOOK_SECRET!).update(raw).digest("hex");

    const result = await handleBillingWebhook(raw, {
      "x-billing-signature": sig,
      "x-billing-provider": "MOCK",
    });

    assert.equal(result.ok, true);
    assert.equal(result.entitlement.subscription.paymentStatus, "PAID");
    assert.equal(result.entitlement.subscription.status, "ACTIVE");
  });

  it("rejects webhook with bad signature", async () => {
    const raw = Buffer.from(JSON.stringify({ paymentId: "x" }), "utf8");
    await assert.rejects(
      () =>
        handleBillingWebhook(raw, {
          "x-billing-signature": "deadbeef",
          "x-billing-provider": "MOCK",
        }),
      (err: unknown) => {
        assert.ok(err instanceof AppHttpError);
        assert.equal(err.status, 401);
        return true;
      }
    );
  });
});
