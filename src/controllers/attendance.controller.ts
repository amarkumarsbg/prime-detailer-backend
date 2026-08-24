import type { Request, Response, NextFunction } from "express";
import { listAttendance, resetAttendance } from "../services/attendance.service.js";

export async function getAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    const branchId =
      typeof req.query.branchId === "string" && req.query.branchId.trim()
        ? req.query.branchId.trim()
        : undefined;
    const records = await listAttendance(branchId);
    res.json({ data: { records }, error: null });
  } catch (e) {
    next(e);
  }
}

export async function deleteAttendance(_req: Request, res: Response, next: NextFunction) {
  try {
    await resetAttendance();
    res.json({ data: { ok: true, records: [] }, error: null });
  } catch (e) {
    next(e);
  }
}
