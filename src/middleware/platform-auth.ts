import { timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";
import { requireAuth } from "./auth.js";

function safeEqualString(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Platform control-plane auth: PLATFORM_ADMIN_API_KEY header OR JWT with PLATFORM_OWNER.
 * Does not trust studio SUPER_ADMIN.
 */
export function requirePlatformAuth(req: Request, res: Response, next: NextFunction): void {
  const keyHeader = req.headers["x-platform-admin-key"];
  const key = typeof keyHeader === "string" ? keyHeader.trim() : "";
  const configured = env.PLATFORM_ADMIN_API_KEY?.trim() ?? "";

  if (configured && key && safeEqualString(key, configured)) {
    (req as Request & { platformActor?: string }).platformActor = "api-key";
    next();
    return;
  }

  requireAuth(req, res, () => {
    if (req.auth?.role === "PLATFORM_OWNER") {
      (req as Request & { platformActor?: string }).platformActor = `user:${req.auth.id}`;
      next();
      return;
    }
    res.status(403).json({
      data: null,
      error: { message: "Platform owner access required", code: "PLATFORM_FORBIDDEN" },
    });
  });
}
