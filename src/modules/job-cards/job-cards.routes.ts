import { Router } from "express";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { inspectionPhotoUploadHandler } from "../../middleware/inspection-photo-upload.js";
import { postJobCardInspectionPhoto } from "./job-card-upload.controller.js";
import {
  deleteJobCardRow,
  getJobCards,
  postJobCardsSnapshot,
  putJobCard,
} from "./job-cards.controller.js";

/**
 * Dedicated job-cards surface (Phase 3 aliases + existing photo action).
 * Collections `/api/collections/jobCards` remain supported until FE cutover.
 */
export const jobCardsRouter = Router();

jobCardsRouter.use(requireAuth);
jobCardsRouter.use(requirePermission("JOB_CARDS"));

jobCardsRouter.get("/", getJobCards);
jobCardsRouter.post("/snapshot", postJobCardsSnapshot);
jobCardsRouter.put("/:id", putJobCard);
jobCardsRouter.delete("/:id", deleteJobCardRow);

jobCardsRouter.post(
  "/:jobCardId/photos",
  inspectionPhotoUploadHandler,
  postJobCardInspectionPhoto
);

/** @deprecated Prefer `jobCardsRouter` — same router. */
export const jobCardUploadRouter = jobCardsRouter;
