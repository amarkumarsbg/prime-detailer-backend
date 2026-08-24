/**
 * Platform control-plane handlers:
 * - GET /api/platform/renewals       — cross-org renewal history (from bills)
 * - GET /api/platform/bills          — cross-org subscription bills
 * - GET /api/platform/payments       — cross-org subscription payments
 * - GET /api/platform/audit          — cross-org platform audit log
 * - GET /api/platform/referrals      — list platform referral codes
 * - POST /api/platform/referrals     — create a platform referral code
 * - POST /api/platform/organizations/:orgId/suspend
 * - POST /api/platform/organizations/:orgId/restore
 */

import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { AppHttpError } from "../../lib/app-http-error.js";
import { writePlatformAuditLog } from "../../lib/platform-audit.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function actorFromReq(req: Request): string {
  const auth = (req as Request & { auth?: { id?: string; email?: string } }).auth;
  if (auth?.email) return auth.email;
  if (auth?.id) return `user:${auth.id}`;
  const platformActor = (req as Request & { platformActor?: string }).platformActor;
  return platformActor ?? "platform-api-key";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDateFilter(raw: unknown): Date | undefined {
  if (!raw || typeof raw !== "string") return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function pageParams(query: Record<string, unknown>): { skip: number; take: number } {
  const take = Math.min(Number(query.limit ?? 100), 200);
  const page = Math.max(Number(query.page ?? 1), 1);
  return { skip: (page - 1) * take, take };
}

// ─── GET /api/platform/renewals ───────────────────────────────────────────────

export async function listPlatformRenewals(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query as Record<string, unknown>;
    const { skip, take } = pageParams(q);
    const orgId = typeof q.orgId === "string" ? q.orgId : undefined;
    const since = parseDateFilter(q.since);
    const until = parseDateFilter(q.until);
    const paymentStatus = typeof q.paymentStatus === "string" ? q.paymentStatus : undefined;

    const bills = await prisma.subscriptionBill.findMany({
      where: {
        ...(orgId ? { organizationId: orgId } : {}),
        ...(since || until
          ? { createdAt: { ...(since ? { gte: since } : {}), ...(until ? { lte: until } : {}) } }
          : {}),
        ...(paymentStatus ? { payment: { status: paymentStatus as never } } : {}),
      },
      include: {
        organization: { select: { id: true, name: true } },
        payment: {
          select: {
            id: true,
            status: true,
            txnReference: true,
            amount: true,
            method: true,
            verifiedAt: true,
            recordedBy: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });

    const renewals = bills.map((b) => ({
      billId: b.id,
      billNumber: b.billNumber,
      organizationId: b.organizationId,
      organizationName: b.organization.name,
      planName: b.planName,
      termMonths: b.termMonths,
      termLabel: b.termLabel,
      previousExpiry: b.periodStart.toISOString(),
      newExpiry: b.periodEnd.toISOString(),
      baseAmount: b.baseAmount ?? 0,
      referralDiscount: b.referralDiscount ?? 0,
      gstAmount: b.gstAmount ?? 0,
      totalAmount: b.totalAmount ?? b.amount ?? 0,
      currency: b.currency,
      paymentStatus: b.payment?.status ?? null,
      txnReference: b.payment?.txnReference ?? null,
      renewalDate: b.createdAt.toISOString(),
    }));

    res.json({ data: { renewals, total: renewals.length }, error: null });
  } catch (e) {
    next(e);
  }
}

// ─── GET /api/platform/bills ──────────────────────────────────────────────────

export async function listPlatformBills(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query as Record<string, unknown>;
    const { skip, take } = pageParams(q);
    const orgId = typeof q.orgId === "string" ? q.orgId : undefined;
    const since = parseDateFilter(q.since);
    const until = parseDateFilter(q.until);
    const paymentStatus = typeof q.paymentStatus === "string" ? q.paymentStatus : undefined;
    const search = typeof q.search === "string" ? q.search.trim() : undefined;

    const bills = await prisma.subscriptionBill.findMany({
      where: {
        ...(orgId ? { organizationId: orgId } : {}),
        ...(search
          ? {
              OR: [
                { billNumber: { contains: search, mode: "insensitive" } },
                { organization: { name: { contains: search, mode: "insensitive" } } },
              ],
            }
          : {}),
        ...(since || until
          ? { createdAt: { ...(since ? { gte: since } : {}), ...(until ? { lte: until } : {}) } }
          : {}),
        ...(paymentStatus ? { payment: { status: paymentStatus as never } } : {}),
      },
      include: {
        organization: { select: { id: true, name: true } },
        payment: {
          select: { id: true, status: true, txnReference: true, verifiedAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });

    const result = bills.map((b) => ({
      id: b.id,
      billNumber: b.billNumber,
      organizationId: b.organizationId,
      organizationName: b.organization.name,
      planName: b.planName,
      termMonths: b.termMonths,
      termLabel: b.termLabel,
      periodStart: b.periodStart.toISOString(),
      periodEnd: b.periodEnd.toISOString(),
      baseAmount: b.baseAmount ?? 0,
      extraBranchCost: b.extraBranchCost ?? 0,
      extraUserCost: b.extraUserCost ?? 0,
      onboardingFee: b.onboardingFee ?? 0,
      referralDiscount: b.referralDiscount ?? 0,
      gstPercent: b.gstPercent ?? 0,
      gstAmount: b.gstAmount ?? 0,
      totalAmount: b.totalAmount ?? b.amount ?? 0,
      currency: b.currency,
      paymentStatus: b.payment?.status ?? null,
      txnReference: b.payment?.txnReference ?? null,
      verifiedAt: b.payment?.verifiedAt?.toISOString() ?? null,
      createdAt: b.createdAt.toISOString(),
    }));

    res.json({ data: { bills: result, total: result.length }, error: null });
  } catch (e) {
    next(e);
  }
}

// ─── GET /api/platform/payments ───────────────────────────────────────────────

export async function listPlatformPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query as Record<string, unknown>;
    const { skip, take } = pageParams(q);
    const orgId = typeof q.orgId === "string" ? q.orgId : undefined;
    const status = typeof q.status === "string" ? q.status : undefined;
    const since = parseDateFilter(q.since);
    const until = parseDateFilter(q.until);

    const payments = await prisma.subscriptionPayment.findMany({
      where: {
        ...(orgId ? { organizationId: orgId } : {}),
        ...(status ? { status: status as never } : {}),
        ...(since || until
          ? { createdAt: { ...(since ? { gte: since } : {}), ...(until ? { lte: until } : {}) } }
          : {}),
      },
      include: {
        organization: { select: { id: true, name: true } },
        subscription: { select: { planCode: true, planName: true } },
        bill: { select: { billNumber: true, totalAmount: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });

    const result = payments.map((p) => ({
      id: p.id,
      organizationId: p.organizationId,
      organizationName: p.organization.name,
      planCode: p.subscription.planCode,
      planName: p.subscription.planName,
      billNumber: p.bill?.billNumber ?? null,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      txnReference: p.txnReference,
      method: p.method,
      notes: p.notes,
      recordedBy: p.recordedBy,
      verifiedAt: p.verifiedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    }));

    res.json({ data: { payments: result, total: result.length }, error: null });
  } catch (e) {
    next(e);
  }
}

// ─── GET /api/platform/audit ──────────────────────────────────────────────────

export async function listPlatformAudit(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query as Record<string, unknown>;
    const { skip, take } = pageParams(q);
    const orgId = typeof q.orgId === "string" ? q.orgId : undefined;
    const action = typeof q.action === "string" ? q.action : undefined;
    const since = parseDateFilter(q.since);
    const until = parseDateFilter(q.until);

    const logs = await prisma.platformAuditLog.findMany({
      where: {
        ...(orgId ? { organizationId: orgId } : {}),
        ...(action ? { action: { contains: action, mode: "insensitive" } } : {}),
        ...(since || until
          ? { createdAt: { ...(since ? { gte: since } : {}), ...(until ? { lte: until } : {}) } }
          : {}),
      },
      include: {
        organization: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });

    const result = logs.map((l) => ({
      id: l.id,
      organizationId: l.organizationId,
      organizationName: l.organization.name,
      actor: l.actor,
      action: l.action,
      before: l.before,
      after: l.after,
      createdAt: l.createdAt.toISOString(),
    }));

    res.json({ data: { logs: result, total: result.length }, error: null });
  } catch (e) {
    next(e);
  }
}

// ─── GET /api/platform/referrals ─────────────────────────────────────────────

export async function listPlatformReferrals(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query as Record<string, unknown>;
    const showInactive = q.showInactive === "true";

    const codes = await prisma.platformReferralCode.findMany({
      where: showInactive ? {} : { isActive: true },
      orderBy: { createdAt: "desc" },
    });

    // For each code, count how many bills have non-zero referralDiscount
    // (We can't correlate exactly without storing the code on the bill,
    //  but we provide the code list + usage hint from bills)
    const result = codes.map((c) => ({
      id: c.id,
      code: c.code,
      discountAmount: c.discountAmount,
      isActive: c.isActive,
      createdBy: c.createdBy,
      notes: c.notes,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));

    res.json({ data: { referralCodes: result }, error: null });
  } catch (e) {
    next(e);
  }
}

const createReferralSchema = z.object({
  code: z
    .string()
    .min(4)
    .max(24)
    .regex(/^[A-Z0-9-]+$/, "Code must be uppercase letters, digits, or hyphens only."),
  discountAmount: z.number().min(0).default(1000),
  notes: z.string().max(500).optional(),
});

// ─── POST /api/platform/referrals ────────────────────────────────────────────

export async function createPlatformReferral(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createReferralSchema.parse(req.body ?? {});
    const actor = actorFromReq(req);

    const existing = await prisma.platformReferralCode.findUnique({
      where: { code: body.code },
    });
    if (existing) {
      throw new AppHttpError(409, `Referral code "${body.code}" already exists.`, "DUPLICATE_CODE");
    }

    const created = await prisma.platformReferralCode.create({
      data: {
        id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        code: body.code,
        discountAmount: body.discountAmount,
        isActive: true,
        createdBy: actor,
        notes: body.notes ?? null,
      },
    });

    res.status(201).json({ data: created, error: null });
  } catch (e) {
    next(e);
  }
}

// ─── POST /api/platform/organizations/:orgId/suspend ─────────────────────────

const suspendSchema = z.object({
  reason: z.string().min(1).max(500),
});

export async function suspendOrganization(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = String(req.params["orgId"] ?? "");
    if (!orgId) throw new AppHttpError(400, "orgId is required.", "MISSING_PARAM");
    const body = suspendSchema.parse(req.body ?? {});
    const actor = actorFromReq(req);

    const sub = await prisma.organizationSubscription.findUnique({
      where: { organizationId: orgId },
    });
    if (!sub) throw new AppHttpError(404, "Organization subscription not found.", "NOT_FOUND");
    if (sub.status === "CANCELLED") {
      throw new AppHttpError(409, "Subscription is already suspended/cancelled.", "ALREADY_SUSPENDED");
    }

    const before = { status: sub.status };
    await prisma.organizationSubscription.update({
      where: { organizationId: orgId },
      data: { status: "CANCELLED" },
    });

    await writePlatformAuditLog({
      organizationId: orgId,
      actor,
      action: "subscription.suspended",
      before,
      after: { status: "CANCELLED", reason: body.reason },
    });

    res.json({ data: { suspended: true, reason: body.reason }, error: null });
  } catch (e) {
    next(e);
  }
}

// ─── POST /api/platform/organizations/:orgId/restore ─────────────────────────

const restoreSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
});

export async function restoreOrganization(req: Request, res: Response, next: NextFunction) {
  try {
    const orgId = String(req.params["orgId"] ?? "");
    if (!orgId) throw new AppHttpError(400, "orgId is required.", "MISSING_PARAM");
    const body = restoreSchema.parse(req.body ?? {});
    const actor = actorFromReq(req);

    const sub = await prisma.organizationSubscription.findUnique({
      where: { organizationId: orgId },
    });
    if (!sub) throw new AppHttpError(404, "Organization subscription not found.", "NOT_FOUND");

    const before = { status: sub.status };
    await prisma.organizationSubscription.update({
      where: { organizationId: orgId },
      data: { status: "ACTIVE" },
    });

    await writePlatformAuditLog({
      organizationId: orgId,
      actor,
      action: "subscription.restored",
      before,
      after: { status: "ACTIVE", reason: body.reason ?? "Restored by platform admin" },
    });

    res.json({ data: { restored: true }, error: null });
  } catch (e) {
    next(e);
  }
}
