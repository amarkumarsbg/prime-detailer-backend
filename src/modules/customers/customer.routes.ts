import { Router } from "express";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import {
  getCustomers,
  getCustomer,
  postCustomer,
  postCustomersBulk,
  putCustomer,
  removeCustomer,
  patchWallet,
} from "./customer.controller.js";

export const customerRouter = Router();

customerRouter.use(requireAuth);
customerRouter.use(requirePermission("CUSTOMERS"));

customerRouter.get("/", getCustomers);
customerRouter.post("/", postCustomer);
customerRouter.post("/bulk", postCustomersBulk);
customerRouter.patch("/:id/wallet", patchWallet);
customerRouter.get("/:id", getCustomer);
customerRouter.put("/:id", putCustomer);
customerRouter.delete("/:id", removeCustomer);
