import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { requireWorkshopAccess } from "../middleware/workshop-access.js";
import { getAttendance, deleteAttendance, upsertAttendanceRecord } from "../controllers/attendance.controller.js";

/** Authenticated dashboard reads (and admin reset) of staff attendance records. */
export const attendanceRouter = Router();

attendanceRouter.use(requireAuth);
attendanceRouter.use(requireWorkshopAccess);
attendanceRouter.use(requirePermission("ATTENDANCE"));

attendanceRouter.get("/", getAttendance);
attendanceRouter.post("/", upsertAttendanceRecord);   // manual create or update
attendanceRouter.put("/:id", upsertAttendanceRecord);  // update by record id
attendanceRouter.delete("/", deleteAttendance);
