import type { Request } from "express";
import { AppHttpError } from "../lib/app-http-error.js";
import {
  assertCanExportData,
  enforceExportLockIfRequested,
} from "../modules/organization/organization-subscription.service.js";

export async function requireExportAllowed(req: Request): Promise<string> {
  const orgId = req.auth?.organizationId;
  if (!orgId) {
    throw new AppHttpError(403, "Organization not found on user", "ORG_MISSING");
  }
  await assertCanExportData(orgId);
  return orgId;
}

export { enforceExportLockIfRequested, assertCanExportData };
