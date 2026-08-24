import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { convertQuotationToJob } from "./quotation-convert.service.js";
import { requireDocumentOrg } from "../collections/alias-http.js";

const bodySchema = z.object({
  jobCard: z.record(z.string(), z.unknown()),
  quotation: z.record(z.string(), z.unknown()),
});

/**
 * Atomically persist a new job card and the converted quotation.
 */
export async function postConvertQuotationToJob(req: Request, res: Response, next: NextFunction) {
  try {
    const org = await requireDocumentOrg(req);
    if (!org) {
      res.status(401).json({ data: null, error: { message: "Unauthorized" } });
      return;
    }
    const body = bodySchema.parse(req.body);
    await convertQuotationToJob({ ...body, organizationId: org.organizationId });
    res.json({ data: { ok: true }, error: null });
  } catch (e) {
    next(e);
  }
}
