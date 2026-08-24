import { Router } from "express";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import {
  deleteInvoiceRow,
  getInvoices,
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
invoicesRouter.use(requirePermission("BILLING"));

invoicesRouter.get("/", getInvoices);
invoicesRouter.post("/snapshot", postInvoicesSnapshot);
invoicesRouter.put("/:id", putInvoice);
invoicesRouter.delete("/:id", deleteInvoiceRow);
