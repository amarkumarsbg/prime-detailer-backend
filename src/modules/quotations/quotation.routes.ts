import { Router } from "express";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { postConvertQuotationToJob } from "./quotation-convert.controller.js";
import {
  deleteQuotationRow,
  getQuotations,
  postQuotationsSnapshot,
  putQuotation,
} from "./quotations.controller.js";

/**
 * Dedicated quotations surface (Phase 3 aliases + convert action).
 * Collections `/api/collections/quotations` remain supported until FE cutover.
 */
export const quotationRouter = Router();

quotationRouter.use(requireAuth);
quotationRouter.use(requirePermission("QUOTATIONS"));

quotationRouter.get("/", getQuotations);
quotationRouter.post("/snapshot", postQuotationsSnapshot);
quotationRouter.post("/convert-to-job", postConvertQuotationToJob);
quotationRouter.put("/:id", putQuotation);
quotationRouter.delete("/:id", deleteQuotationRow);
