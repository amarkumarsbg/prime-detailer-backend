/**
 * Public self-serve signup — provisions a STARTER tenant on TRIAL via the same
 * transactional path as platform provisioning. No payment / no JWT issued here.
 *
 * Disable with PUBLIC_SELF_SERVE_SIGNUP=false (default: enabled).
 * Trial length always uses SUBSCRIPTION_TRIAL_DAYS (or 14); callers cannot set trialDays.
 */
import { AppHttpError } from "../../lib/app-http-error.js";
import {
  provisionTenant,
  type ProvisionTenantInput,
  type ProvisionTenantResult,
} from "../platform/provision-organization.service.js";

export type SelfServeRegisterInput = {
  organizationName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  ownerPassword: string;
  branchName: string;
  /** Optional explicit slug; otherwise derived from organizationName. */
  organizationSlug?: string;
};

export function isPublicSelfServeSignupEnabled(): boolean {
  const raw = process.env.PUBLIC_SELF_SERVE_SIGNUP?.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "off" || raw === "no") {
    return false;
  }
  return true;
}

export async function registerSelfServeTenant(
  input: SelfServeRegisterInput,
  actorLabel: string
): Promise<ProvisionTenantResult> {
  if (!isPublicSelfServeSignupEnabled()) {
    throw new AppHttpError(
      403,
      "Self-serve signup is currently disabled. Please contact sales.",
      "SELF_SERVE_DISABLED"
    );
  }

  const payload: ProvisionTenantInput = {
    organizationName: input.organizationName,
    ownerName: input.ownerName,
    ownerEmail: input.ownerEmail,
    ownerPhone: input.ownerPhone,
    ownerPassword: input.ownerPassword,
    branchName: input.branchName,
    organizationSlug: input.organizationSlug,
    startTrial: true,
  };

  return provisionTenant(payload, actorLabel);
}
