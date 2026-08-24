/**
 * Development-safe performance instrumentation middleware.
 * Logs every request with total wall-clock time.
 * In production: only logs slow requests (> SLOW_THRESHOLD_MS).
 * In development: logs all requests.
 */
import type { Request, Response, NextFunction } from "express";

const SLOW_THRESHOLD_MS = 1000;
const isProduction = process.env.NODE_ENV === "production";

export function perfMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - start) / 1_000_000;
    const rounded = Math.round(ms);
    const slow = rounded >= SLOW_THRESHOLD_MS;
    if (!isProduction || slow) {
      const tag = slow ? " ⚠ SLOW" : "";
      console.info(`[PERF] ${req.method} ${req.path} ${res.statusCode} ${rounded}ms${tag}`);
    }
  });
  next();
}
