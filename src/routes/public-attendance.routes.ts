import { Router } from "express";
import {
  getPublicAttendanceContext,
  postResolveAttendancePin,
  postPublicPunch,
} from "../controllers/public-attendance.controller.js";

/** No auth — staff scan the branch QR on personal phones without logging in. */
export const publicAttendanceRouter = Router();

publicAttendanceRouter.get("/context", getPublicAttendanceContext);
publicAttendanceRouter.post("/resolve-pin", postResolveAttendancePin);
publicAttendanceRouter.post("/punch", postPublicPunch);
