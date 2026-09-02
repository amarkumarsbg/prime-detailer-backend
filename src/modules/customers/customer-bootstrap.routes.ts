import { Router } from "express";
import { requireAuth, requireCustomerAuth } from "../../middleware/auth.js";
import { requireWorkshopAccess } from "../../middleware/workshop-access.js";
import { getCustomerBootstrap } from "./customer-bootstrap.controller.js";

export const customerBootstrapRouter = Router();

customerBootstrapRouter.get(
  "/bootstrap",
  requireAuth,
  requireCustomerAuth,
  requireWorkshopAccess,
  getCustomerBootstrap
);
