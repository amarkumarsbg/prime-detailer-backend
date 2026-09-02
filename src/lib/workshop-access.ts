import type { Organization, OrganizationSubscription, SubscriptionStatus } from "@prisma/client";
import { prisma } from "./prisma.js";
import { AppHttpError } from "./app-http-error.js";

/** Subscription statuses that still allow workshop (studio) operations. */
export const WORKSHOP_ALLOWED_SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = [
  "ACTIVE",
  "PAST_DUE",
] as const;

export type WorkshopAccessDenialCode =
  | "ORG_INACTIVE"
  | "SUBSCRIPTION_MISSING"
  | "SUBSCRIPTION_EXPIRED"
  | "SUBSCRIPTION_CANCELLED"
  | "ORG_MISSING";

export type WorkshopAccessResult =
  | { ok: true }
  | {
      ok: false;
      code: WorkshopAccessDenialCode;
      message: string;
      status: SubscriptionStatus | null;
    };

/**
 * Evaluate whether a tenant may use workshop APIs.
 * - Inactive org → denied (platform suspend).
 * - Missing subscription → denied.
 * - ACTIVE / PAST_DUE → allowed (PAST_DUE = payment grace).
 * - EXPIRED / CANCELLED → denied for workshop (renew / platform restore separately).
 */
export function evaluateWorkshopAccess(
  org: Pick<Organization, "isActive"> | null | undefined,
  subscription: Pick<OrganizationSubscription, "status"> | null | undefined
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
      status: subscription?.status ?? null,
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
  if (
    !(WORKSHOP_ALLOWED_SUBSCRIPTION_STATUSES as readonly string[]).includes(subscription.status)
  ) {
    if (subscription.status === "EXPIRED") {
      return {
        ok: false,
        code: "SUBSCRIPTION_EXPIRED",
        message: "Your subscription has expired. Renew to continue using the workshop.",
        status: subscription.status,
      };
    }
    return {
      ok: false,
      code: "SUBSCRIPTION_CANCELLED",
      message: "Your subscription is cancelled. Contact support or renew to continue.",
      status: subscription.status,
    };
  }
  return { ok: true };
}

export async function loadOrgWorkshopAccess(organizationId: string): Promise<WorkshopAccessResult> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      isActive: true,
      subscription: { select: { status: true } },
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
 * Expired tenants may still sign in so the studio can show renew / entitlement UI.
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
