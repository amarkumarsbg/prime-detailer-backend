import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import {
  getStudioSubscriptionRenewals,
  getStudioSubscription,
  getStudioSubscriptionBill,
  getStudioSubscriptionBills,
  getStudioBillingGatewayStatus,
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
