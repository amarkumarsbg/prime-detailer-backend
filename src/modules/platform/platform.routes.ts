import { Router } from "express";
import { requirePlatformAuth } from "../../middleware/platform-auth.js";
import {
  getPlatformOrganization,
  listPlatformOrganizations,
  patchPlatformOrganizationSubscription,
  postPlatformMarkPaid,
  postPlatformVerifyPayment,
  postPlatformConvertTrial,
} from "../organization/organization.controller.js";
import {
  listPlatformRenewals,
  listPlatformBills,
  listPlatformPayments,
  listPlatformAudit,
  listPlatformReferrals,
  createPlatformReferral,
  suspendOrganization,
  restoreOrganization,
  postPlatformProvisionOrganization,
} from "./platform.controller.js";

export const platformRouter = Router();

platformRouter.use(requirePlatformAuth);

// Provision new tenant (must be before /organizations/:orgId/* for clarity)
platformRouter.post("/organizations/provision", postPlatformProvisionOrganization);

// Existing org endpoints
platformRouter.get("/organizations", listPlatformOrganizations);
platformRouter.get("/organizations/:orgId", getPlatformOrganization);
platformRouter.patch("/organizations/:orgId/subscription", patchPlatformOrganizationSubscription);
platformRouter.post("/organizations/:orgId/subscription/verify-payment", postPlatformVerifyPayment);
platformRouter.post("/organizations/:orgId/subscription/mark-paid", postPlatformMarkPaid);
platformRouter.post("/organizations/:orgId/subscription/convert-trial", postPlatformConvertTrial);

// Suspend / restore
platformRouter.post("/organizations/:orgId/suspend", suspendOrganization);
platformRouter.post("/organizations/:orgId/restore", restoreOrganization);

// Cross-org data endpoints
platformRouter.get("/renewals", listPlatformRenewals);
platformRouter.get("/bills", listPlatformBills);
platformRouter.get("/payments", listPlatformPayments);
platformRouter.get("/audit", listPlatformAudit);
platformRouter.get("/referrals", listPlatformReferrals);
platformRouter.post("/referrals", createPlatformReferral);
