import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  getBranchAttendanceContext,
  resolveAttendancePin,
} from "../services/public-attendance.service.js";
import { punchAttendance } from "../services/attendance.service.js";

/** Use the staff member's local calendar values when valid; otherwise the server clock. */
function resolveClock(clientLocalDate?: unknown, clientLocalTime?: unknown): {
  date: string;
  time: string;
} {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const serverDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const serverTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const dateOk =
    typeof clientLocalDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(clientLocalDate.trim());
  const timeRaw = typeof clientLocalTime === "string" ? clientLocalTime.trim() : "";
  const timeOk = /^\d{1,2}:\d{2}$/.test(timeRaw);
  const time = timeOk
    ? `${timeRaw.split(":")[0]!.padStart(2, "0")}:${timeRaw.split(":")[1]}`
    : serverTime;

  return {
    date: dateOk ? (clientLocalDate as string).trim() : serverDate,
    time,
  };
}

export async function getPublicAttendanceContext(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const branchId = String(req.query.branchId ?? "").trim();
    const qr = typeof req.query.qr === "string" ? req.query.qr : undefined;
    if (!branchId) {
      res.status(400).json({
        data: null,
        error: { message: "branchId is required", code: "MISSING_BRANCH" },
      });
      return;
    }

    const result = await getBranchAttendanceContext(branchId, qr);
    if (!result.ok) {
      const code = result.error;
      res.status(code === "INVALID_QR" ? 403 : 404).json({
        data: null,
        error: {
          message:
            code === "INVALID_QR"
              ? "This QR link is not valid for this branch."
              : "Unknown or inactive branch.",
          code,
        },
      });
      return;
    }

    res.json({ data: result, error: null });
  } catch (e) {
    next(e);
  }
}

const punchSchema = z.object({
  staffId: z.string().min(1),
  branchId: z.string().min(1),
  clientLocalDate: z.string().optional(),
  clientLocalTime: z.string().optional(),
});

export async function postPublicPunch(req: Request, res: Response, next: NextFunction) {
  try {
    const body = punchSchema.parse(req.body);
    const clock = resolveClock(body.clientLocalDate, body.clientLocalTime);
    const result = await punchAttendance({
      staffId: body.staffId,
      branchId: body.branchId,
      date: clock.date,
      time: clock.time,
    });

    if (!result.ok) {
      const status = result.error === "WRONG_BRANCH" ? 403 : 404;
      res.status(status).json({
        data: null,
        error: { message: "Could not record punch.", code: result.error },
      });
      return;
    }

    res.json({
      data: { ok: true, kind: result.kind, time: result.time, record: result.record },
      error: null,
    });
  } catch (e) {
    next(e);
  }
}

const resolvePinSchema = z.object({
  pin: z.string().min(1).max(16),
  branchId: z.string().min(1),
});

export async function postResolveAttendancePin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const body = resolvePinSchema.parse(req.body);
    const result = await resolveAttendancePin(body.pin, body.branchId);
    if (!result.ok) {
      const status =
        result.error === "WRONG_BRANCH" ? 403 : 404;
      res.status(status).json({
        data: null,
        error: {
          message:
            result.error === "WRONG_BRANCH"
              ? "You are not assigned to this branch."
              : "PIN not recognized.",
          code: result.error,
        },
      });
      return;
    }
    res.json({ data: result, error: null });
  } catch (e) {
    next(e);
  }
}
