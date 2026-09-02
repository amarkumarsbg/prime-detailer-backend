/**
 * Usage limits — maxCustomers enforcement (Step 7).
 * Run: npm run test:usage-limits
 */
import "dotenv/config";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { sanitizeDatabaseUrl } from "../src/config/env.js";
import { provisionTenant } from "../src/modules/platform/provision-organization.service.js";
import {
  assertCanCreateCustomer,
  getEntitlementForOrg,
} from "../src/modules/organization/organization-subscription.service.js";
import { createCustomer, createCustomersBulk } from "../src/modules/customers/customer.service.js";
import { AppHttpError } from "../src/lib/app-http-error.js";

const prisma = new PrismaClient({
  datasources: { db: { url: sanitizeDatabaseUrl(process.env.DATABASE_URL ?? "") } },
});

const createdOrgIds: string[] = [];
const STRONG_PASSWORD = "Usage#Limit1";

function suffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function cleanup() {
  for (const id of createdOrgIds) {
    await prisma.organization.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
}

describe("usage limits — maxCustomers", () => {
  before(async () => {
    await prisma.$queryRaw`SELECT 1`;
  });

  after(async () => {
    await cleanup();
  });

  it("entitlement exposes customersUsed / effectiveMaxCustomers / canCreateCustomer", async () => {
    const s = suffix();
    const tenant = await provisionTenant(
      {
        organizationName: `Limit Org ${s}`,
        ownerName: "Owner",
        ownerEmail: `limit-${s}@example.com`,
        ownerPhone: "9111100001",
        ownerPassword: STRONG_PASSWORD,
        branchName: "HQ",
      },
      "test:usage"
    );
    createdOrgIds.push(tenant.organization.id);

    const entitlement = await getEntitlementForOrg(tenant.organization.id);
    assert.ok(entitlement);
    assert.equal(entitlement!.subscription.effectiveMaxCustomers, 100);
    assert.equal(entitlement!.usage.customersUsed, 0);
    assert.equal(entitlement!.canCreateCustomer, true);
  });

  it("blocks createCustomer when at maxCustomers", async () => {
    const s = suffix();
    const tenant = await provisionTenant(
      {
        organizationName: `Cap Org ${s}`,
        ownerName: "Owner",
        ownerEmail: `cap-${s}@example.com`,
        ownerPhone: "9111100002",
        ownerPassword: STRONG_PASSWORD,
        branchName: "HQ",
      },
      "test:usage"
    );
    createdOrgIds.push(tenant.organization.id);

    await prisma.organizationSubscription.update({
      where: { organizationId: tenant.organization.id },
      data: { limits: { maxBranches: 1, maxStaff: 3, maxCustomers: 2 } },
    });

    await createCustomer({
      organizationId: tenant.organization.id,
      name: "Cust One",
      phone: "9800000001",
      email: "",
      address: "",
      referralCode: `R1${s}`.slice(0, 12),
    });
    await createCustomer({
      organizationId: tenant.organization.id,
      name: "Cust Two",
      phone: "9800000002",
      email: "",
      address: "",
      referralCode: `R2${s}`.slice(0, 12),
    });

    const entitlement = await getEntitlementForOrg(tenant.organization.id);
    assert.equal(entitlement!.usage.customersUsed, 2);
    assert.equal(entitlement!.canCreateCustomer, false);

    await assert.rejects(
      () =>
        createCustomer({
          organizationId: tenant.organization.id,
          name: "Cust Three",
          phone: "9800000003",
          email: "",
          address: "",
          referralCode: `R3${s}`.slice(0, 12),
        }),
      (err: unknown) => {
        assert.ok(err instanceof AppHttpError);
        assert.equal(err.code, "CUSTOMER_LIMIT_REACHED");
        assert.equal(err.status, 403);
        return true;
      }
    );

    await assert.rejects(() => assertCanCreateCustomer(tenant.organization.id), (err: unknown) => {
      assert.ok(err instanceof AppHttpError);
      assert.equal(err.code, "CUSTOMER_LIMIT_REACHED");
      return true;
    });
  });

  it("bulk import skips excess rows with LIMIT_REACHED", async () => {
    const s = suffix();
    const tenant = await provisionTenant(
      {
        organizationName: `Bulk Cap ${s}`,
        ownerName: "Owner",
        ownerEmail: `bulk-${s}@example.com`,
        ownerPhone: "9111100003",
        ownerPassword: STRONG_PASSWORD,
        branchName: "HQ",
      },
      "test:usage"
    );
    createdOrgIds.push(tenant.organization.id);

    await prisma.organizationSubscription.update({
      where: { organizationId: tenant.organization.id },
      data: { limits: { maxBranches: 1, maxStaff: 3, maxCustomers: 2 } },
    });

    const result = await createCustomersBulk(tenant.organization.id, [
      { name: "A", phone: "9700000001" },
      { name: "B", phone: "9700000002" },
      { name: "C", phone: "9700000003" },
      { name: "D", phone: "9700000004" },
    ]);

    assert.equal(result.created.length, 2);
    assert.equal(result.skipped.filter((x) => x.reason === "LIMIT_REACHED").length, 2);
  });
});
