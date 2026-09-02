import { Router } from "express";
import { requireAuth, requireCustomerAuth } from "../../middleware/auth.js";
import { requireWorkshopAccess } from "../../middleware/workshop-access.js";
import {
  postCustomerLogin,
  getCustomerMe,
  postCustomerLogout,
  postCustomerSetPassword,
} from "./customer-auth.controller.js";

export const customerAuthRouter = Router();

customerAuthRouter.post("/login", postCustomerLogin);
customerAuthRouter.get("/me", requireAuth, requireCustomerAuth, requireWorkshopAccess, getCustomerMe);
customerAuthRouter.post("/logout", requireAuth, requireCustomerAuth, postCustomerLogout);
customerAuthRouter.post(
  "/set-password",
  requireAuth,
  requireCustomerAuth,
  requireWorkshopAccess,
  postCustomerSetPassword
);
