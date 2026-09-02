import type { Request, Response, NextFunction } from "express";
import { handleBillingWebhook } from "./subscription-checkout.service.js";

/**
 * POST /api/public/billing/webhook
 * Raw body required for HMAC verification (mounted with express.raw in index.ts).
 */
export async function postPublicBillingWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    const raw =
      Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {}), "utf8");
    const result = await handleBillingWebhook(raw, req.headers as Record<string, string | string[] | undefined>);
    res.json({
      data: {
        ok: result.ok,
        paymentId: result.paymentId,
        entitlement: {
          status: result.entitlement.subscription.status,
          paymentStatus: result.entitlement.subscription.paymentStatus,
          expiresAt: result.entitlement.subscription.expiresAt,
        },
      },
      error: null,
    });
  } catch (e) {
    next(e);
  }
}
