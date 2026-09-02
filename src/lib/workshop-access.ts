import type { Organization, OrganizationSubscription, SubscriptionStatus } from "@prisma/client";
import { prisma } from "./prisma.js";
import { AppHttpError } from "./app-http-error.js";

/**
 * Workshop-eligible subscription statuses (string literals — keep in sync with
 * Prisma `SubscriptionStatus`, including TRIAL from migration 20260902190000).
 *
 * Compared via string helpers so editors with a stale Prisma client (pre-TRIAL)
 * still typecheck; `tsc` / runtime use the generated client after `prisma generate`.
 */
export const WORKSHOP_ALLOWED_SUBSCRIPTION_STATUSES = [
  "ACTIVE",
  "PAST_DUE",
  "TRIAL",
] as const;

export type WorkshopAllowedStatus = (typeof WORKSHOP_ALLOWED_SUBSCRIPTION_STATUSES)[number];

export type WorkshopAccessDenialCode =
  | "ORG_INACTIVE"
  | "SUBSCRIPTION_MISSING"
  | "SUBSCRIPTION_EXPIRED"
  | "SUBSCRIPTION_CANCELLED"
  | "SUBSCRIPTION_TRIAL_ENDED"
  | "ORG_MISSING";

export type WorkshopAccessResult =
  | { ok: true }
  | {
      ok: false;
      code: WorkshopAccessDenialCode;
      message: string;
      status: SubscriptionStatus | null;
    };

export type WorkshopSubscriptionSlice = {
  status: SubscriptionStatus | string;
  trialEndsAt?: Date | null;
};

function statusKey(status: SubscriptionStatus | string): string {
  return String(status);
}

/** True when status alone is in the workshop-allowed set (does not check trialEndsAt). */
export function isWorkshopAllowedStatus(status: SubscriptionStatus | string): boolean {
  return (WORKSHOP_ALLOWED_SUBSCRIPTION_STATUSES as readonly string[]).includes(statusKey(status));
}

/**
 * Evaluate whether a tenant may use workshop APIs.
 * - Inactive org → denied (platform suspend).
 * - Missing subscription → denied.
 * - ACTIVE / PAST_DUE → allowed (PAST_DUE = payment grace).
 * - TRIAL → allowed until trialEndsAt (if set and past → denied).
 * - EXPIRED / CANCELLED → denied for workshop (renew / platform restore separately).
 */
export function evaluateWorkshopAccess(
  org: Pick<Organization, "isActive"> | null | undefined,
  subscription: WorkshopSubscriptionSlice | null | undefined,
  now: Date = new Date()
): WorkshopAccessResult {
  if (!org) {
    return {
      ok: false,
      code: "ORG_MISSING",
      message: "Organization not found.",
      status: null,
    };
  }
  if (!org.isActive) {
    return {
      ok: false,
      code: "ORG_INACTIVE",
      message: "This organization has been suspended. Contact support to restore access.",
      status: (subscription?.status as SubscriptionStatus | undefined) ?? null,
    };
  }
  if (!subscription) {
    return {
      ok: false,
      code: "SUBSCRIPTION_MISSING",
      message: "Organization subscription not found.",
      status: null,
    };
  }
  const status = statusKey(subscription.status);
  if (!isWorkshopAllowedStatus(status)) {
    if (status === "EXPIRED") {
      return {
        ok: false,
        code: "SUBSCRIPTION_EXPIRED",
        message: "Your subscription has expired. Renew to continue using the workshop.",
        status: subscription.status as SubscriptionStatus,
      };
    }
    return {
      ok: false,
      code: "SUBSCRIPTION_CANCELLED",
      message: "Your subscription is cancelled. Contact support or renew to continue.",
      status: subscription.status as SubscriptionStatus,
    };
  }
  if (status === "TRIAL") {
    const ends = subscription.trialEndsAt ?? null;
    if (ends && ends.getTime() < now.getTime()) {
      return {
        ok: false,
        code: "SUBSCRIPTION_TRIAL_ENDED",
        message: "Your trial has ended. Convert to a paid plan to continue using the workshop.",
        status: subscription.status as SubscriptionStatus,
      };
    }
  }
  return { ok: true };
}

export async function loadOrgWorkshopAccess(organizationId: string): Promise<WorkshopAccessResult> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      isActive: true,
      subscription: { select: { status: true, trialEndsAt: true } },
    },
  });
  if (!org) {
    return {
      ok: false,
      code: "ORG_MISSING",
      message: "Organization not found.",
      status: null,
    };
  }
  return evaluateWorkshopAccess(org, org.subscription);
}

/** Throw AppHttpError when workshop access is denied. */
export async function assertWorkshopAccess(organizationId: string): Promise<void> {
  const result = await loadOrgWorkshopAccess(organizationId);
  if (result.ok) return;
  throw new AppHttpError(403, result.message, result.code, {
    subscriptionStatus: result.status,
  });
}

/**
 * Login gate for inactive orgs only.
 * Expired / ended-trial tenants may still sign in so the studio can show renew / convert UI.
 * Suspended (isActive=false) tenants cannot obtain a token.
 */
export async function assertOrgAllowsLogin(organizationId: string): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { isActive: true },
  });
  if (!org) {
    throw new AppHttpError(403, "Organization not found.", "ORG_MISSING");
  }
  if (!org.isActive) {
    throw new AppHttpError(
      403,
      "This organization has been suspended. Contact support to restore access.",
      "ORG_INACTIVE"
    );
  }
}

/** Default trial length in days when provisioning with startTrial. */
export function defaultTrialDays(): number {
  const raw = Number(process.env.SUBSCRIPTION_TRIAL_DAYS ?? 14);
  if (!Number.isFinite(raw) || raw < 1) return 14;
  return Math.min(90, Math.floor(raw));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
