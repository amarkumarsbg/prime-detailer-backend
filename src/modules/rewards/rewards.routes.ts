import { Router } from "express";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import {
  getCompanyTargetResultsHandler,
  getStaffIncentiveSummaryHandler,
  getRewardSettingsHandler,
} from "./rewards.controller.js";

export const rewardsRouter = Router();

rewardsRouter.use(requireAuth);

/** GET /api/rewards/settings — read normalized reward settings */
rewardsRouter.get(
  "/settings",
  requirePermission("STAFF_REWARDS"),
  getRewardSettingsHandler
);

/** GET /api/rewards/company-target/results?year=2026&periodType=MONTHLY&staffId=... */
rewardsRouter.get(
  "/company-target/results",
  requirePermission("STAFF_REWARDS"),
  getCompanyTargetResultsHandler
);

/** GET /api/rewards/staff/:staffId/summary?year=2026 */
rewardsRouter.get(
  "/staff/:staffId/summary",
  requirePermission("STAFF_REWARDS"),
  getStaffIncentiveSummaryHandler
);
