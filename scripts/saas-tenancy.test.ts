/**
 * Steps 8–9: org storage keys, messaging credential resolve, export lock.
 * Run: npm run test:saas-tenancy
 */
import "dotenv/config";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { sanitizeDatabaseUrl } from "../src/config/env.js";
import { orgObjectKey, orgStorageKeyPrefix } from "../src/lib/org-storage-key.js";
import {
  resolveOrgMessagingCredentials,
  saveOrgMessagingSettings,
  loadOrgMessagingSettings,
  redactMessagingSettings,
} from "../src/lib/org-messaging-credentials.js";
import {
  assertCanExportData,
  isExportIntentRequest,
  enforceExportLockIfRequested,
} from "../src/modules/organization/organization-subscription.service.js";
import { provisionTenant } from "../src/modules/platform/provision-organization.service.js";
import { AppHttpError } from "../src/lib/app-http-error.js";
import { addDays } from "../src/lib/workshop-access.js";

const prisma = new PrismaClient({
  datasources: { db: { url: sanitizeDatabaseUrl(process.env.DATABASE_URL ?? "") } },
});

const createdOrgIds: string[] = [];
const STRONG_PASSWORD = "Tenancy#Test1";

function suffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function cleanup() {
  for (const id of createdOrgIds) {
    await prisma.organization.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
}

describe("org storage keys", () => {
  it("prefixes object keys with orgs/{orgId}", () => {
    assert.equal(orgStorageKeyPrefix("org-acme"), "orgs/org-acme");
    assert.equal(
      orgObjectKey("org-acme", "avatars", "u1.png"),
      "orgs/org-acme/avatars/u1.png"
    );
    assert.equal(
      orgObjectKey("org/weird id!", "job-cards", "jc1", "before", "p.jpg"),
      "orgs/org_weird_id_/job-cards/jc1/before/p.jpg"
    );
  });
});

describe("export intent detection", () => {
  it("detects export query/header flags", () => {
    assert.equal(isExportIntentRequest({ query: { export: "1" } }), true);
    assert.equal(isExportIntentRequest({ query: { download: "true" } }), true);
    assert.equal(isExportIntentRequest({ query: { format: "csv" } }), true);
    assert.equal(isExportIntentRequest({ headers: { "x-export-intent": "1" } }), true);
    assert.equal(isExportIntentRequest({ query: { page: "1" } }), false);
  });
});

describe("messaging + export tenancy integration", () => {
  before(async () => {
    await prisma.$queryRaw`SELECT 1`;
  });

  after(async () => {
    await cleanup();
  });

  it("stores org messaging overrides and redacts secrets", async () => {
    const s = suffix();
    const tenant = await provisionTenant(
      {
        organizationName: `Msg Org ${s}`,
        ownerName: "Owner",
        ownerEmail: `msg-${s}@example.com`,
        ownerPhone: "9111200001",
        ownerPassword: STRONG_PASSWORD,
        branchName: "HQ",
      },
      "test:tenancy"
    );
    createdOrgIds.push(tenant.organization.id);

    await saveOrgMessagingSettings(tenant.organization.id, {
      twilioFromNumber: "+15551234567",
      resendApiKey: "re_test_secret",
      mailFrom: "Shop <shop@example.com>",
    });

    const loaded = await loadOrgMessagingSettings(tenant.organization.id);
    assert.equal(loaded.twilioFromNumber, "+15551234567");
    assert.equal(loaded.resendApiKey, "re_test_secret");

    const redacted = redactMessagingSettings(loaded);
    assert.equal(redacted.resendApiKeySet, true);
    assert.equal(redacted.twilioFromNumber, "+15551234567");
    assert.equal((redacted as { resendApiKey?: string }).resendApiKey, undefined);

    const resolved = await resolveOrgMessagingCredentials(tenant.organization.id);
    assert.equal(resolved.hasOrgOverrides, true);
    assert.equal(resolved.twilioFromNumber, "+15551234567");
    assert.equal(resolved.mailFrom, "Shop <shop@example.com>");
  });

  it("blocks assertCanExportData when within export-lock window", async () => {
    const s = suffix();
    const tenant = await provisionTenant(
      {
        organizationName: `Export Org ${s}`,
        ownerName: "Owner",
        ownerEmail: `exp-${s}@example.com`,
        ownerPhone: "9111200002",
        ownerPassword: STRONG_PASSWORD,
        branchName: "HQ",
      },
      "test:tenancy"
    );
    createdOrgIds.push(tenant.organization.id);

    // Fresh provision with null expiresAt → export allowed
    await assertCanExportData(tenant.organization.id);

    await prisma.organizationSubscription.update({
      where: { organizationId: tenant.organization.id },
      data: {
        status: "ACTIVE",
        expiresAt: addDays(new Date(), 10),
        currentPeriodEnd: addDays(new Date(), 10),
        trialEndsAt: null,
      },
    });

    await assert.rejects(() => assertCanExportData(tenant.organization.id), (err: unknown) => {
      assert.ok(err instanceof AppHttpError);
      assert.equal(err.code, "EXPORT_LOCKED");
      assert.equal(err.status, 403);
      return true;
    });

    await assert.rejects(
      () =>
        enforceExportLockIfRequested(tenant.organization.id, {
          query: { export: "1" },
        }),
      (err: unknown) => {
        assert.ok(err instanceof AppHttpError);
        assert.equal(err.code, "EXPORT_LOCKED");
        return true;
      }
    );

    // Normal list (no export intent) must not throw
    await enforceExportLockIfRequested(tenant.organization.id, { query: { page: "1" } });
  });
});
