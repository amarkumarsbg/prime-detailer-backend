import { Router } from "express";
import { requireInternalJobAuth } from "../../middleware/internal-job-auth.js";
import { postProcessRemindersJob } from "./reminder-job.controller.js";

export const jobsRouter = Router();

/**
 * Daily reminder WhatsApp processor (external cron).
 * Auth: header `X-Internal-Job-Key: $INTERNAL_JOB_SECRET` or Bearer JWT (org-scoped).
 */
jobsRouter.post("/reminders/process", requireInternalJobAuth, postProcessRemindersJob);
