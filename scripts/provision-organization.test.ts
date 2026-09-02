/**
 * Tenant provisioning tests (platform Step 3).
 * Run: npm run test:provision
 *
 * Requires a reachable DATABASE_URL (local docker compose postgres is fine).
 */
import "dotenv/config";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { timingSafeEqual } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  createTenantRecordsInTransaction,
  provisionTenant,
  slugifyOrganizationName,
  type PreparedProvisionIds,
} from "../src/modules/platform/provision-organization.service.js";
import { AppHttpError } from "../src/lib/app-http-error.js";
import { sanitizeDatabaseUrl } from "../src/config/env.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient({
  datasources: { db: { url: sanitizeDatabaseUrl(process.env.DATABASE_URL ?? "") } },
});

const createdOrgIds: string[] = [];

const STRONG_PASSWORD = "Provision#Test1";

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function cleanupOrgs(ids: string[]) {
  for (const id of ids) {
    await prisma.organization.delete({ where: { id } }).catch(() => {});
  }
}

/** Mirrors requirePlatformAuth gate (api-key OR PLATFORM_OWNER JWT role). */
function checkPlatformAuth(opts: {
  configuredKey: string;
  headerKey: string;
  jwtRole?: string;
}): { ok?: boolean; status?: number; code?: string } {
  const configured = opts.configuredKey.trim();
  const key = opts.headerKey.trim();
  if (configured && key) {
    const ba = Buffer.from(key);
    const bb = Buffer.from(configured);
    if (ba.length === bb.length && timingSafeEqual(ba, bb)) {
      return { ok: true };
    }
  }
  if (opts.jwtRole === "PLATFORM_OWNER") return { ok: true };
  if (opts.jwtRole) {
    return { status: 403, code: "PLATFORM_FORBIDDEN" };
  }
  return { status: 401 };
}

describe("slugifyOrganizationName", () => {
  it("normalizes names to hyphenated lowercase slugs", () => {
    assert.equal(slugifyOrganizationName("Acme Detailers!"), "acme-detailers");
    assert.equal(slugifyOrganizationName("  "), "org");
  });
});

describe("platform auth gate for provisioning", () => {
  it("rejects studio SUPER_ADMIN / ADMIN (tenant users cannot provision)", () => {
    for (const role of ["SUPER_ADMIN", "ADMIN", "MANAGER", "CUSTOMER"] as const) {
      const r = checkPlatformAuth({
        configuredKey: "platform-secret-key-value",
        headerKey: "",
        jwtRole: role,
      });
      assert.equal(r.status, 403);
      assert.equal(r.code, "PLATFORM_FORBIDDEN");
    }
  });

  it("allows PLATFORM_OWNER JWT and valid platform API key", () => {
    assert.equal(
      checkPlatformAuth({
        configuredKey: "platform-secret-key-value",
        headerKey: "",
        jwtRole: "PLATFORM_OWNER",
      }).ok,
      true
    );
    assert.equal(
      checkPlatformAuth({
        configuredKey: "platform-secret-key-value",
        headerKey: "platform-secret-key-value",
      }).ok,
      true
    );
  });

  it("platform routes mount provision behind requirePlatformAuth", () => {
    const src = readFileSync(join(__dirname, "../src/modules/platform/platform.routes.ts"), "utf8");
    assert.match(src, /platformRouter\.use\(requirePlatformAuth\)/);
    assert.match(src, /\/organizations\/provision/);
    assert.ok(
      src.indexOf("requirePlatformAuth") < src.indexOf("/organizations/provision"),
      "requirePlatformAuth must wrap the router before provision route"
    );
  });
});

describe("provisionTenant integration", () => {
  before(async () => {
    await prisma.$queryRaw`SELECT 1`;
  });

  after(async () => {
    await cleanupOrgs(createdOrgIds);
    await prisma.$disconnect();
  });

  it("successfully provisions org, owner SUPER_ADMIN, branch, and subscription", async () => {
    const suffix = uniqueSuffix();
    const result = await provisionTenant(
      {
        organizationName: `Provision Test ${suffix}`,
        ownerName: "Owner User",
        ownerEmail: `owner-${suffix}@example.com`,
        ownerPhone: "9876543210",
        ownerPassword: STRONG_PASSWORD,
        branchName: "Main Workshop",
      },
      "test:provision"
    );
    createdOrgIds.push(result.organization.id);

    assert.ok(result.organization.id.startsWith("org-"));
    assert.ok(result.organization.slug);
    assert.equal(result.organization.isActive, true);

    assert.equal(result.owner.role, "SUPER_ADMIN");
    assert.equal(result.owner.organizationId, result.organization.id);
    assert.equal(result.owner.branchId, result.branch.id);
    assert.equal(result.owner.email, `owner-${suffix}@example.com`);

    assert.equal(result.branch.organizationId, result.organization.id);
    assert.equal(result.branch.name, "Main Workshop");

    assert.equal(result.subscription.organizationId, result.organization.id);
    assert.equal(result.subscription.planCode, "STARTER");
    assert.equal(result.subscription.status, "ACTIVE");
    assert.equal(result.subscription.paymentStatus, "PENDING");
    assert.equal(result.subscription.expiresAt, null);

    // Safe response: no password / hash / token fields
    const json = JSON.stringify(result);
    assert.equal(json.includes("password"), false);
    assert.equal(json.includes("passwordHash"), false);
    assert.equal(json.includes("accessToken"), false);
    assert.equal(json.includes("JWT"), false);

    // DB relationships
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: result.owner.id } });
    assert.equal(owner.organizationId, result.organization.id);
    assert.equal(owner.branchId, result.branch.id);
    assert.ok(owner.passwordHash.length > 20);
    assert.notEqual(owner.passwordHash, STRONG_PASSWORD);

    const branch = await prisma.branch.findUniqueOrThrow({ where: { id: result.branch.id } });
    assert.equal(branch.organizationId, result.organization.id);

    const sub = await prisma.organizationSubscription.findUniqueOrThrow({
      where: { organizationId: result.organization.id },
    });
    assert.equal(sub.paymentStatus, "PENDING");
    assert.equal(sub.status, "ACTIVE");
  });

  it("rolls back all records when a later step fails inside the transaction", async () => {
    const suffix = uniqueSuffix();
    const slug = slugifyOrganizationName(`Rollback Org ${suffix}`);
    const ids: PreparedProvisionIds = {
      organizationId: `org-rollback-${suffix}`,
      branchId: `br-rollback-${suffix}`,
      ownerId: `usr-rollback-${suffix}`,
      subscriptionId: `sub-rollback-${suffix}`,
      slug: `${slug}-${suffix}`.slice(0, 48),
    };

    await assert.rejects(async () => {
      await prisma.$transaction(async (tx) => {
        await createTenantRecordsInTransaction(
          tx,
          {
            organizationName: `Rollback Org ${suffix}`,
            ownerName: "Rollback Owner",
            ownerEmail: `rollback-${suffix}@example.com`,
            ownerPhone: "9123456780",
            ownerPassword: STRONG_PASSWORD,
            branchName: "HQ",
          },
          ids
        );
        throw new Error("forced failure after creates");
      });
    });

    assert.equal(await prisma.organization.findUnique({ where: { id: ids.organizationId } }), null);
    assert.equal(await prisma.branch.findUnique({ where: { id: ids.branchId } }), null);
    assert.equal(await prisma.user.findUnique({ where: { id: ids.ownerId } }), null);
    assert.equal(
      await prisma.organizationSubscription.findUnique({
        where: { organizationId: ids.organizationId },
      }),
      null
    );
  });

  it("rejects duplicate organization slug when explicitly provided", async () => {
    const suffix = uniqueSuffix();
    const slug = `dup-slug-${suffix}`;
    const first = await provisionTenant(
      {
        organizationName: `Dup Slug A ${suffix}`,
        organizationSlug: slug,
        ownerName: "Owner A",
        ownerEmail: `slug-a-${suffix}@example.com`,
        ownerPhone: "9000000001",
        ownerPassword: STRONG_PASSWORD,
        branchName: "HQ",
      },
      "test:provision"
    );
    createdOrgIds.push(first.organization.id);

    await assert.rejects(
      () =>
        provisionTenant(
          {
            organizationName: `Dup Slug B ${suffix}`,
            organizationSlug: slug,
            ownerName: "Owner B",
            ownerEmail: `slug-b-${suffix}@example.com`,
            ownerPhone: "9000000002",
            ownerPassword: STRONG_PASSWORD,
            branchName: "HQ",
          },
          "test:provision"
        ),
      (err: unknown) => {
        assert.ok(err instanceof AppHttpError);
        assert.equal(err.status, 409);
        assert.equal(err.code, "DUPLICATE_SLUG");
        return true;
      }
    );
  });

  it("rejects duplicate owner email (global unique constraint)", async () => {
    const suffix = uniqueSuffix();
    const email = `dup-email-${suffix}@example.com`;
    const first = await provisionTenant(
      {
        organizationName: `Dup Email Org ${suffix}`,
        ownerName: "Owner One",
        ownerEmail: email,
        ownerPhone: "9111111111",
        ownerPassword: STRONG_PASSWORD,
        branchName: "HQ",
      },
      "test:provision"
    );
    createdOrgIds.push(first.organization.id);

    await assert.rejects(
      () =>
        provisionTenant(
          {
            organizationName: `Dup Email Org 2 ${suffix}`,
            ownerName: "Owner Two",
            ownerEmail: email,
            ownerPhone: "9222222222",
            ownerPassword: STRONG_PASSWORD,
            branchName: "HQ",
          },
          "test:provision"
        ),
      (err: unknown) => {
        assert.ok(err instanceof AppHttpError);
        assert.equal(err.status, 409);
        assert.equal(err.code, "DUPLICATE_EMAIL");
        return true;
      }
    );
  });

  it("never accepts a caller-supplied organizationId (server generates ids)", async () => {
    const suffix = uniqueSuffix();
    const result = await provisionTenant(
      {
        organizationName: `No Client OrgId ${suffix}`,
        ownerName: "Owner",
        ownerEmail: `noclient-${suffix}@example.com`,
        ownerPhone: "9333333333",
        ownerPassword: STRONG_PASSWORD,
        branchName: "HQ",
        // @ts-expect-error intentional — organizationId must not be part of the public input
        organizationId: "org-default",
      } as Parameters<typeof provisionTenant>[0],
      "test:provision"
    );
    createdOrgIds.push(result.organization.id);
    assert.notEqual(result.organization.id, "org-default");
    assert.ok(result.organization.id.startsWith("org-"));
  });

  it("keeps all created records on the same organization with no cross-tenant refs", async () => {
    const suffix = uniqueSuffix();
    const result = await provisionTenant(
      {
        organizationName: `Cross Check ${suffix}`,
        ownerName: "Owner",
        ownerEmail: `cross-${suffix}@example.com`,
        ownerPhone: "9444444444",
        ownerPassword: STRONG_PASSWORD,
        branchName: "HQ",
      },
      "test:provision"
    );
    createdOrgIds.push(result.organization.id);

    const orgId = result.organization.id;
    assert.equal(result.branch.organizationId, orgId);
    assert.equal(result.owner.organizationId, orgId);
    assert.equal(result.subscription.organizationId, orgId);

    const otherBranch = await prisma.branch.findFirst({
      where: { id: result.branch.id, NOT: { organizationId: orgId } },
    });
    assert.equal(otherBranch, null);

    const foreignUser = await prisma.user.findFirst({
      where: {
        id: result.owner.id,
        OR: [
          { organizationId: { not: orgId } },
          { branch: { organizationId: { not: orgId } } },
        ],
      },
    });
    assert.equal(foreignUser, null);
  });
});
