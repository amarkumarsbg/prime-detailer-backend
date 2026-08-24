import { Router } from "express";
import { requirePlatformAuth } from "../../middleware/platform-auth.js";
import {
  getPlatformOrganization,
  listPlatformOrganizations,
  patchPlatformOrganizationSubscription,
  postPlatformMarkPaid,
  postPlatformVerifyPayment,
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
} from "./platform.controller.js";

export const platformRouter = Router();

platformRouter.use(requirePlatformAuth);

// Existing org endpoints
platformRouter.get("/organizations", listPlatformOrganizations);
platformRouter.get("/organizations/:orgId", getPlatformOrganization);
platformRouter.patch("/organizations/:orgId/subscription", patchPlatformOrganizationSubscription);
platformRouter.post("/organizations/:orgId/subscription/verify-payment", postPlatformVerifyPayment);
platformRouter.post("/organizations/:orgId/subscription/mark-paid", postPlatformMarkPaid);

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
