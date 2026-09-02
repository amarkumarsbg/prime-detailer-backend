import { Router } from "express";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import {
  getStudioSubscriptionRenewals,
  getStudioSubscription,
  getStudioSubscriptionBill,
  getStudioSubscriptionBills,
  getStudioBillingGatewayStatus,
  getStudioExportCheck,
  getStudioMessagingSettings,
  patchStudioMessagingSettings,
  postStudioExportCollection,
  postStudioExportCustomers,
  postStudioSubscriptionPricing,
  postStudioRenewRequest,
  postStudioSubscriptionCheckout,
  postStudioSubscriptionCheckoutConfirm,
} from "./organization.controller.js";

export const organizationRouter = Router();

organizationRouter.use(requireAuth);
organizationRouter.get("/subscription", getStudioSubscription);
organizationRouter.get("/subscription/billing-status", getStudioBillingGatewayStatus);
organizationRouter.post("/subscription/pricing", postStudioSubscriptionPricing);
organizationRouter.post("/subscription/renew", postStudioRenewRequest);
organizationRouter.post("/subscription/checkout", postStudioSubscriptionCheckout);
organizationRouter.post("/subscription/checkout/confirm", postStudioSubscriptionCheckoutConfirm);
organizationRouter.get("/subscription/bills", getStudioSubscriptionBills);
organizationRouter.get("/subscription/bills/:billId", getStudioSubscriptionBill);
organizationRouter.get("/subscription/renewals", getStudioSubscriptionRenewals);

organizationRouter.get("/export/check", getStudioExportCheck);
organizationRouter.post("/export/customers", postStudioExportCustomers);
organizationRouter.post("/export/collections/:collection", postStudioExportCollection);

organizationRouter.get("/messaging-settings", getStudioMessagingSettings);
organizationRouter.patch(
  "/messaging-settings",
  requirePermission("SETTINGS"),
  patchStudioMessagingSettings
);
