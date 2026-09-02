/**
 * Platform tenant provisioning — creates Organization + HQ Branch + Owner SUPER_ADMIN
 * + OrganizationSubscription in one DB transaction.
 *
 * Default subscription (startTrial=false):
 * - status: ACTIVE, paymentStatus: PENDING, expiresAt: null
 *
 * Trial subscription (startTrial=true):
 * - status: TRIAL, paymentStatus: PENDING
 * - trialEndsAt: now + trialDays (default SUBSCRIPTION_TRIAL_DAYS or 14, max 90)
 * - expiresAt: null until convert-trial / mark-paid
 *
 * Do not set paymentStatus PAID here — that would imply a completed subscription payment.
 */
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Prisma, SubscriptionStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppHttpError } from "../../lib/app-http-error.js";
import { PLAN_CATALOG, type PlanLimits } from "../../lib/plan-catalog.js";
import { validateStrongPassword } from "../../lib/password-policy.js";
import { writePlatformAuditLog } from "../../lib/platform-audit.js";
import { env } from "../../config/env.js";
import { addDays, defaultTrialDays } from "../../lib/workshop-access.js";

export type ProvisionTenantInput = {
  organizationName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  ownerPassword: string;
  branchName: string;
  /** Optional explicit slug; otherwise derived from organizationName. */
  organizationSlug?: string;
  /** When true, create subscription as TRIAL with trialEndsAt. */
  startTrial?: boolean;
  /** Trial length in days (1–90). Defaults to SUBSCRIPTION_TRIAL_DAYS or 14. */
  trialDays?: number;
};

export type ProvisionTenantResult = {
  organization: {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
  };
  branch: {
    id: string;
    name: string;
    organizationId: string;
    isActive: boolean;
  };
  owner: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: "SUPER_ADMIN";
    organizationId: string;
    branchId: string;
    mustChangePassword: boolean;
  };
  subscription: {
    id: string;
    organizationId: string;
    planCode: "STARTER";
    planName: string;
    status: SubscriptionStatus;
    paymentStatus: "PENDING";
    termMonths: number;
    startsAt: string;
    expiresAt: null;
    trialEndsAt: string | null;
    limits: PlanLimits;
  };
};

function asLimitsJson(limits: PlanLimits): Prisma.InputJsonValue {
  return limits as unknown as Prisma.InputJsonValue;
}

/** Lowercase hyphenated slug, max 48 chars. */
export function slugifyOrganizationName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "org";
}

function shortId(): string {
  return randomBytes(4).toString("hex");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function digitsPhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

async function allocateUniqueSlug(preferred: string, tx: Prisma.TransactionClient): Promise<string> {
  let candidate = preferred.slice(0, 48);
  for (let i = 0; i < 8; i++) {
    const existing = await tx.organization.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    const suffix = shortId();
    candidate = `${preferred.slice(0, Math.max(1, 48 - suffix.length - 1))}-${suffix}`;
  }
  throw new AppHttpError(409, "Could not allocate a unique organization slug.", "DUPLICATE_SLUG");
}

async function allocateUniqueOrgId(slug: string, tx: Prisma.TransactionClient): Promise<string> {
  let candidate = `org-${slug}`.slice(0, 64);
  for (let i = 0; i < 8; i++) {
    const existing = await tx.organization.findUnique({
      where: { id: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `org-${shortId()}`;
  }
  throw new AppHttpError(409, "Could not allocate a unique organization id.", "ORG_ID_CONFLICT");
}

export type PreparedProvisionIds = {
  organizationId: string;
  branchId: string;
  ownerId: string;
  subscriptionId: string;
  slug: string;
};

/**
 * Core creates used inside a transaction. Exported for rollback tests that inject a failure
 * after these writes.
 */
export async function createTenantRecordsInTransaction(
  tx: Prisma.TransactionClient,
  input: ProvisionTenantInput,
  ids: PreparedProvisionIds
): Promise<void> {
  const email = normalizeEmail(input.ownerEmail);
  const phone = input.ownerPhone.trim();
  const branchPhone = digitsPhone(phone).slice(-10) || digitsPhone(phone) || "0000000000";
  const now = new Date();
  const starter = PLAN_CATALOG.STARTER;
  const limits: PlanLimits = {
    maxBranches: starter.limits.maxBranches,
    maxStaff: starter.limits.maxStaff ?? 3,
    maxCustomers: starter.limits.maxCustomers ?? 100,
  };
  const passwordHash = await bcrypt.hash(input.ownerPassword, 10);
  const startTrial = input.startTrial === true;
  let trialDays = defaultTrialDays();
  if (input.trialDays !== undefined) {
    const n = Math.floor(Number(input.trialDays));
    if (!Number.isFinite(n) || n < 1 || n > 90) {
      throw new AppHttpError(400, "trialDays must be between 1 and 90.", "VALIDATION");
    }
    trialDays = n;
  }
  const trialEndsAt = startTrial ? addDays(now, trialDays) : null;

  await tx.organization.create({
    data: {
      id: ids.organizationId,
      name: input.organizationName.trim(),
      slug: ids.slug,
      isActive: true,
      activatedAt: now,
    },
  });

  await tx.branch.create({
    data: {
      id: ids.branchId,
      name: input.branchName.trim(),
      address: "Address pending",
      phone: branchPhone.length >= 10 ? branchPhone.slice(-10) : branchPhone.padStart(10, "0"),
      isActive: true,
      code: "HQ",
      organizationId: ids.organizationId,
      createdByUserId: ids.ownerId,
    },
  });

  await tx.user.create({
    data: {
      id: ids.ownerId,
      name: input.ownerName.trim(),
      email,
      phone,
      role: "SUPER_ADMIN",
      branchId: ids.branchId,
      organizationId: ids.organizationId,
      passwordHash,
      permissions: [],
      isActive: true,
      mustChangePassword: false,
      passwordUpdatedAt: now,
      createdByUserId: ids.ownerId,
    },
  });

  await tx.organizationSubscription.create({
    data: {
      id: ids.subscriptionId,
      organizationId: ids.organizationId,
      planCode: starter.planCode,
      planName: starter.planName,
      status: startTrial ? "TRIAL" : "ACTIVE",
      paymentStatus: "PENDING",
      limits: asLimitsJson(limits),
      termMonths: 12,
      startsAt: now,
      expiresAt: null,
      currentPeriodEnd: null,
      trialEndsAt,
      contactUsUrl:
        env.DEFAULT_CONTACT_US_URL?.trim() ||
        "mailto:support@primedetailers.in?subject=Subscription%20help",
      contactPhone: process.env.DEFAULT_CONTACT_PHONE?.trim() || null,
      upgradeUrl:
        env.DEFAULT_UPGRADE_URL?.trim() ||
        "mailto:support@primedetailers.in?subject=Upgrade%20plan%20request",
    },
  });
}

async function prepareIds(
  input: ProvisionTenantInput,
  tx: Prisma.TransactionClient
): Promise<PreparedProvisionIds> {
  const preferredSlug = slugifyOrganizationName(
    input.organizationSlug?.trim() || input.organizationName
  );
  const slug = await allocateUniqueSlug(preferredSlug, tx);
  const organizationId = await allocateUniqueOrgId(slug, tx);
  return {
    organizationId,
    branchId: `br-${shortId()}`,
    ownerId: `usr-${shortId()}`,
    subscriptionId: `sub-${shortId()}`,
    slug,
  };
}

/**
 * Validate input + uniqueness, then create all tenant records atomically.
 * Never accepts a caller-supplied organizationId (ids are server-generated).
 */
export async function provisionTenant(
  input: ProvisionTenantInput,
  actorLabel: string
): Promise<ProvisionTenantResult> {
  const organizationName = input.organizationName?.trim() ?? "";
  const ownerName = input.ownerName?.trim() ?? "";
  const ownerEmail = normalizeEmail(input.ownerEmail ?? "");
  const ownerPhone = input.ownerPhone?.trim() ?? "";
  const ownerPassword = input.ownerPassword ?? "";
  const branchName = input.branchName?.trim() ?? "";

  if (!organizationName) {
    throw new AppHttpError(400, "organizationName is required.", "VALIDATION");
  }
  if (!ownerName) {
    throw new AppHttpError(400, "ownerName is required.", "VALIDATION");
  }
  if (!ownerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
    throw new AppHttpError(400, "ownerEmail must be a valid email.", "VALIDATION");
  }
  if (!ownerPhone || digitsPhone(ownerPhone).length < 7) {
    throw new AppHttpError(400, "ownerPhone is required.", "VALIDATION");
  }
  const pwErr = validateStrongPassword(ownerPassword);
  if (pwErr) {
    throw new AppHttpError(400, pwErr, "VALIDATION");
  }
  if (!branchName) {
    throw new AppHttpError(400, "branchName is required.", "VALIDATION");
  }

  const emailClash = await prisma.user.findUnique({
    where: { email: ownerEmail },
    select: { id: true },
  });
  if (emailClash) {
    throw new AppHttpError(409, "An account with this email already exists.", "DUPLICATE_EMAIL");
  }

  if (input.organizationSlug?.trim()) {
    const slugClash = await prisma.organization.findUnique({
      where: { slug: slugifyOrganizationName(input.organizationSlug) },
      select: { id: true },
    });
    if (slugClash) {
      throw new AppHttpError(409, "Organization slug is already in use.", "DUPLICATE_SLUG");
    }
  }

  const preparedInput: ProvisionTenantInput = {
    organizationName,
    ownerName,
    ownerEmail,
    ownerPhone,
    ownerPassword,
    branchName,
    organizationSlug: input.organizationSlug,
    startTrial: input.startTrial === true,
    trialDays: input.trialDays,
  };

  if (preparedInput.startTrial && preparedInput.trialDays !== undefined) {
    const n = Math.floor(Number(preparedInput.trialDays));
    if (!Number.isFinite(n) || n < 1 || n > 90) {
      throw new AppHttpError(400, "trialDays must be between 1 and 90.", "VALIDATION");
    }
  }

  const created = await prisma.$transaction(async (tx) => {
    const ids = await prepareIds(preparedInput, tx);
    await createTenantRecordsInTransaction(tx, preparedInput, ids);

    const [organization, branch, owner, subscription] = await Promise.all([
      tx.organization.findUniqueOrThrow({ where: { id: ids.organizationId } }),
      tx.branch.findUniqueOrThrow({ where: { id: ids.branchId } }),
      tx.user.findUniqueOrThrow({ where: { id: ids.ownerId } }),
      tx.organizationSubscription.findUniqueOrThrow({
        where: { organizationId: ids.organizationId },
      }),
    ]);

    return { organization, branch, owner, subscription, ids };
  });

  await writePlatformAuditLog({
    organizationId: created.organization.id,
    actor: actorLabel,
    action: "organization.provisioned",
    before: null,
    after: {
      organizationId: created.organization.id,
      slug: created.organization.slug,
      ownerUserId: created.owner.id,
      branchId: created.branch.id,
      subscriptionId: created.subscription.id,
      planCode: created.subscription.planCode,
      paymentStatus: created.subscription.paymentStatus,
    },
  });

  const limits = PLAN_CATALOG.STARTER.limits;

  return {
    organization: {
      id: created.organization.id,
      name: created.organization.name,
      slug: created.organization.slug!,
      isActive: created.organization.isActive,
    },
    branch: {
      id: created.branch.id,
      name: created.branch.name,
      organizationId: created.branch.organizationId,
      isActive: created.branch.isActive,
    },
    owner: {
      id: created.owner.id,
      name: created.owner.name,
      email: created.owner.email,
      phone: created.owner.phone,
      role: "SUPER_ADMIN",
      organizationId: created.owner.organizationId,
      branchId: created.owner.branchId,
      mustChangePassword: created.owner.mustChangePassword,
    },
    subscription: {
      id: created.subscription.id,
      organizationId: created.subscription.organizationId,
      planCode: "STARTER",
      planName: created.subscription.planName,
      status: created.subscription.status,
      paymentStatus: "PENDING",
      termMonths: created.subscription.termMonths,
      startsAt: created.subscription.startsAt!.toISOString(),
      expiresAt: null,
      trialEndsAt: created.subscription.trialEndsAt?.toISOString() ?? null,
      limits: {
        maxBranches: limits.maxBranches,
        maxStaff: limits.maxStaff ?? 3,
        maxCustomers: limits.maxCustomers ?? null,
      },
    },
  };
}
