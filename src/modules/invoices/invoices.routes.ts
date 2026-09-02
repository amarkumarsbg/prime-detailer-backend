import { Router } from "express";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { requireWorkshopAccess } from "../../middleware/workshop-access.js";
import {
  deleteInvoiceRow,
  getInvoices,
  getInvoiceById,
  postInvoicesSnapshot,
  putInvoice,
} from "./invoices.controller.js";

/**
 * Dedicated invoices surface (Phase 3 aliases).
 * Collections `/api/collections/invoices` remain supported until FE cutover.
 * Public invoice view stays at `/api/public/invoices/:id`.
 */
export const invoicesRouter = Router();

invoicesRouter.use(requireAuth);
invoicesRouter.use(requireWorkshopAccess);
invoicesRouter.use(requirePermission("BILLING"));

invoicesRouter.get("/", getInvoices);
invoicesRouter.get("/:id", getInvoiceById);
invoicesRouter.post("/snapshot", postInvoicesSnapshot);
invoicesRouter.put("/:id", putInvoice);
invoicesRouter.delete("/:id", deleteInvoiceRow);
