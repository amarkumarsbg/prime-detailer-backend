import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  getCompanyTargetResults,
  getStaffIncentiveSummary,
  getRewardSettings,
} from "./rewards.service.js";
import type { PeriodType } from "../../lib/company-target-periods.js";
import { AppError } from "../../lib/app-error.js";

const PERIOD_TYPES = ["MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY"] as const;

const companyTargetResultsQuerySchema = z.object({
  year: z
    .string()
    .regex(/^\d{4}$/, "year must be a 4-digit number")
    .transform(Number),
  periodType: z.enum(PERIOD_TYPES).optional(),
  staffId: z.string().optional(),
});

const staffSummaryParamsSchema = z.object({
  staffId: z.string().min(1),
});

const staffSummaryQuerySchema = z.object({
  year: z
    .string()
    .regex(/^\d{4}$/, "year must be a 4-digit number")
    .transform(Number),
  periodType: z.enum(PERIOD_TYPES).optional(),
});

/** GET /api/rewards/company-target/results */
export async function getCompanyTargetResultsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ data: null, error: { message: "Unauthorized" } });
      return;
    }

    const query = companyTargetResultsQuerySchema.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({
        data: null,
        error: { message: "Invalid query parameters", details: query.error.flatten() },
      });
      return;
    }

    const organizationId = req.auth.organizationId;
    if (!organizationId) {
      throw AppError.forbidden("No organization context");
    }

    const results = await getCompanyTargetResults({
      organizationId,
      year: query.data.year,
      periodType: query.data.periodType as PeriodType | undefined,
      staffId: query.data.staffId,
    });

    res.json({ data: results, error: null });
  } catch (e) {
    next(e);
  }
}

/** GET /api/rewards/staff/:staffId/summary */
export async function getStaffIncentiveSummaryHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ data: null, error: { message: "Unauthorized" } });
      return;
    }

    const params = staffSummaryParamsSchema.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ data: null, error: { message: "Invalid staff id" } });
      return;
    }

    const query = staffSummaryQuerySchema.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({
        data: null,
        error: { message: "Invalid query parameters", details: query.error.flatten() },
      });
      return;
    }

    const organizationId = req.auth.organizationId;
    if (!organizationId) {
      throw AppError.forbidden("No organization context");
    }

    const summary = await getStaffIncentiveSummary({
      organizationId,
      staffId: params.data.staffId,
      year: query.data.year,
    });

    res.json({ data: summary, error: null });
  } catch (e) {
    next(e);
  }
}

/** GET /api/rewards/settings */
export async function getRewardSettingsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.auth) {
      res.status(401).json({ data: null, error: { message: "Unauthorized" } });
      return;
    }

    const organizationId = req.auth.organizationId;
    if (!organizationId) {
      throw AppError.forbidden("No organization context");
    }

    const settings = await getRewardSettings(organizationId);
    res.json({ data: settings, error: null });
  } catch (e) {
    next(e);
  }
}
