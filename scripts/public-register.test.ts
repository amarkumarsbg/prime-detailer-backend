/**
 * Public self-serve register (Step 5).
 * Run: npm run test:public-register
 *
 * Requires a reachable DATABASE_URL (local docker compose postgres is fine).
 */
import "dotenv/config";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { sanitizeDatabaseUrl } from "../src/config/env.js";
import {
  isPublicSelfServeSignupEnabled,
  registerSelfServeTenant,
} from "../src/modules/public/self-serve-register.service.js";
import { loadOrgWorkshopAccess } from "../src/lib/workshop-access.js";
import { AppHttpError } from "../src/lib/app-http-error.js";

const prisma = new PrismaClient({
  datasources: { db: { url: sanitizeDatabaseUrl(process.env.DATABASE_URL ?? "") } },
});

const createdOrgIds: string[] = [];
const STRONG_PASSWORD = "Register#Test1";

function suffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function cleanup() {
  for (const id of createdOrgIds) {
    await prisma.organization.delete({ where: { id } }).catch(() => {});
  }
  await prisma.$disconnect();
}

describe("isPublicSelfServeSignupEnabled", () => {
  const prev = process.env.PUBLIC_SELF_SERVE_SIGNUP;

  after(() => {
    if (prev === undefined) delete process.env.PUBLIC_SELF_SERVE_SIGNUP;
    else process.env.PUBLIC_SELF_SERVE_SIGNUP = prev;
  });

  it("defaults to enabled when unset", () => {
    delete process.env.PUBLIC_SELF_SERVE_SIGNUP;
    assert.equal(isPublicSelfServeSignupEnabled(), true);
  });

  it("disables on false/0/off/no", () => {
    for (const v of ["false", "0", "off", "no", "FALSE"]) {
      process.env.PUBLIC_SELF_SERVE_SIGNUP = v;
      assert.equal(isPublicSelfServeSignupEnabled(), false, v);
    }
  });
});

describe("registerSelfServeTenant", () => {
  before(async () => {
    await prisma.$queryRaw`SELECT 1`;
    delete process.env.PUBLIC_SELF_SERVE_SIGNUP;
  });

  after(async () => {
    await cleanup();
  });

  it("creates a TRIAL tenant and allows workshop access", async () => {
    const s = suffix();
    const result = await registerSelfServeTenant(
      {
        organizationName: `Public Reg ${s}`,
        ownerName: "Public Owner",
        ownerEmail: `public-reg-${s}@example.com`,
        ownerPhone: "9666666666",
        ownerPassword: STRONG_PASSWORD,
        branchName: "HQ",
      },
      "test:public-register"
    );
    createdOrgIds.push(result.organization.id);

    assert.equal(result.subscription.status, "TRIAL");
    assert.equal(result.subscription.paymentStatus, "PENDING");
    assert.equal(result.subscription.planCode, "STARTER");
    assert.ok(result.subscription.trialEndsAt);
    assert.equal(result.owner.role, "SUPER_ADMIN");

    const access = await loadOrgWorkshopAccess(result.organization.id);
    assert.equal(access.ok, true);
  });

  it("rejects duplicate owner email", async () => {
    const s = suffix();
    const email = `dup-reg-${s}@example.com`;
    const first = await registerSelfServeTenant(
      {
        organizationName: `Dup A ${s}`,
        ownerName: "Owner A",
        ownerEmail: email,
        ownerPhone: "9777777777",
        ownerPassword: STRONG_PASSWORD,
        branchName: "HQ",
      },
      "test:public-register"
    );
    createdOrgIds.push(first.organization.id);

    await assert.rejects(
      () =>
        registerSelfServeTenant(
          {
            organizationName: `Dup B ${s}`,
            ownerName: "Owner B",
            ownerEmail: email,
            ownerPhone: "9888888888",
            ownerPassword: STRONG_PASSWORD,
            branchName: "HQ",
          },
          "test:public-register"
        ),
      (err: unknown) => {
        assert.ok(err instanceof AppHttpError);
        assert.equal(err.status, 409);
        assert.equal(err.code, "DUPLICATE_EMAIL");
        return true;
      }
    );
  });

  it("rejects when self-serve is disabled", async () => {
    const prev = process.env.PUBLIC_SELF_SERVE_SIGNUP;
    process.env.PUBLIC_SELF_SERVE_SIGNUP = "false";
    try {
      await assert.rejects(
        () =>
          registerSelfServeTenant(
            {
              organizationName: "Should Fail",
              ownerName: "X",
              ownerEmail: `disabled-${suffix()}@example.com`,
              ownerPhone: "9111111111",
              ownerPassword: STRONG_PASSWORD,
              branchName: "HQ",
            },
            "test:public-register"
          ),
        (err: unknown) => {
          assert.ok(err instanceof AppHttpError);
          assert.equal(err.status, 403);
          assert.equal(err.code, "SELF_SERVE_DISABLED");
          return true;
        }
      );
    } finally {
      if (prev === undefined) delete process.env.PUBLIC_SELF_SERVE_SIGNUP;
      else process.env.PUBLIC_SELF_SERVE_SIGNUP = prev;
    }
  });
});
