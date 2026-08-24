import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { getAttendance, deleteAttendance } from "../controllers/attendance.controller.js";

/** Authenticated dashboard reads (and admin reset) of staff attendance records. */
export const attendanceRouter = Router();

attendanceRouter.use(requireAuth);
attendanceRouter.use(requirePermission("ATTENDANCE"));

attendanceRouter.get("/", getAttendance);
attendanceRouter.delete("/", deleteAttendance);
