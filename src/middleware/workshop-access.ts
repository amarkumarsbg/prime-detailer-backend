import type { Request, Response, NextFunction } from "express";
import { loadOrgWorkshopAccess } from "../lib/workshop-access.js";
import { prisma } from "../lib/prisma.js";

/**
 * Hard gate for workshop (studio / customer portal) APIs.
 * Requires `requireAuth` first.
 *
 * Bypass: PLATFORM_OWNER (platform control plane uses `/api/platform`).
 * Allowed without this middleware: auth session, bootstrap, organization subscription renew.
 */
export function requireWorkshopAccess(req: Request, res: Response, next: NextFunction): void {
  void (async () => {
    try {
      if (!req.auth) {
        res.status(401).json({ data: null, error: { message: "Unauthorized" } });
        return;
      }

      if (req.auth.role === "PLATFORM_OWNER") {
        next();
        return;
      }

      let organizationId = req.auth.organizationId;
      if (!organizationId && req.auth.role !== "CUSTOMER") {
        const row = await prisma.user.findUnique({
          where: { id: req.auth.id },
          select: { organizationId: true },
        });
        organizationId = row?.organizationId;
      }

      if (!organizationId) {
        res.status(403).json({
          data: null,
          error: {
            message: "Organization not found on user",
            code: "ORG_MISSING",
          },
        });
        return;
      }

      const result = await loadOrgWorkshopAccess(organizationId);
      if (!result.ok) {
        res.status(403).json({
          data: null,
          error: {
            message: result.message,
            code: result.code,
            subscriptionStatus: result.status,
          },
        });
        return;
      }

      next();
    } catch (e) {
      next(e);
    }
  })();
}
