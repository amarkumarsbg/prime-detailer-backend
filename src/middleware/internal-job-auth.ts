import { timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";
import { requireAuth } from "./auth.js";

export type JobAuthContext =
  | { mode: "secret" }
  | { mode: "user"; organizationId: string; userId: string };

declare global {
  namespace Express {
    interface Request {
      jobAuth?: JobAuthContext;
    }
  }
}

function safeEqualString(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function headerJobKey(req: Request): string {
  const raw = req.headers["x-internal-job-key"];
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * Protects scheduled job endpoints.
 * - Preferred: `X-Internal-Job-Key: <INTERNAL_JOB_SECRET>` (external cron)
 * - Alternate: Bearer JWT (org-scoped studio trigger for Reminders page)
 */
export function requireInternalJobAuth(req: Request, res: Response, next: NextFunction): void {
  const configured = env.INTERNAL_JOB_SECRET?.trim() ?? "";
  const key = headerJobKey(req);

  if (configured) {
    if (key && safeEqualString(key, configured)) {
      req.jobAuth = { mode: "secret" };
      next();
      return;
    }
    if (key) {
      res.status(401).json({
        data: null,
        error: { message: "Invalid job credentials", code: "JOB_UNAUTHORIZED" },
      });
      return;
    }
  }

  // No valid secret → allow authenticated org user (Reminders page deferral)
  requireAuth(req, res, () => {
    const orgId = req.auth?.organizationId?.trim();
    if (!orgId) {
      res.status(401).json({
        data: null,
        error: { message: "Organization required", code: "JOB_UNAUTHORIZED" },
      });
      return;
    }
    const perms = req.auth?.permissions ?? [];
    const role = req.auth?.role;
    const allowed =
      role === "SUPER_ADMIN" ||
      role === "ADMIN" ||
      role === "PLATFORM_OWNER" ||
      perms.includes("REMINDERS") ||
      perms.includes("SETTINGS");
    if (!allowed) {
      res.status(403).json({
        data: null,
        error: { message: "Reminders permission required", code: "JOB_FORBIDDEN" },
      });
      return;
    }
    req.jobAuth = { mode: "user", organizationId: orgId, userId: req.auth!.id };
    next();
  });
}

/** Strict secret-only auth (unit tests / ops). */
export function requireInternalJobSecretOnly(req: Request, res: Response, next: NextFunction): void {
  const configured = env.INTERNAL_JOB_SECRET?.trim() ?? "";
  const key = headerJobKey(req);
  if (!configured) {
    res.status(503).json({
      data: null,
      error: {
        message: "INTERNAL_JOB_SECRET is not configured on the API server",
        code: "JOB_SECRET_NOT_CONFIGURED",
      },
    });
    return;
  }
  if (!key || !safeEqualString(key, configured)) {
    res.status(401).json({
      data: null,
      error: { message: "Invalid job credentials", code: "JOB_UNAUTHORIZED" },
    });
    return;
  }
  req.jobAuth = { mode: "secret" };
  next();
}
