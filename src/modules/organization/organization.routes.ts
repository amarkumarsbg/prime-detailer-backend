import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import {
  getStudioSubscriptionRenewals,
  getStudioSubscription,
  getStudioSubscriptionBill,
  getStudioSubscriptionBills,
  postStudioSubscriptionPricing,
  postStudioRenewRequest,
} from "./organization.controller.js";

export const organizationRouter = Router();

organizationRouter.use(requireAuth);
organizationRouter.get("/subscription", getStudioSubscription);
organizationRouter.post("/subscription/pricing", postStudioSubscriptionPricing);
organizationRouter.post("/subscription/renew", postStudioRenewRequest);
organizationRouter.get("/subscription/bills", getStudioSubscriptionBills);
organizationRouter.get("/subscription/bills/:billId", getStudioSubscriptionBill);
organizationRouter.get("/subscription/renewals", getStudioSubscriptionRenewals);
