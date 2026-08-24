import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  listCustomers,
  getCustomerById,
  createCustomer,
  createCustomersBulk,
  updateCustomer,
  deleteCustomer,
  adjustWallet,
} from "./customer.service.js";
import { resolveBranchScope } from "../../lib/data-scope.js";

const trimmed = (v: unknown) => (typeof v === "string" ? v.trim() : v);

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.preprocess(trimmed, z.union([z.literal(""), z.string().email()])),
  address: z.preprocess(trimmed, z.string()),
  referralCode: z.string().min(1),
  referredBy: z.string().optional(),
  totalVisits: z.number().int().nonnegative().optional(),
  rewardPoints: z.number().int().nonnegative().optional(),
  walletBalance: z.number().nonnegative().optional(),
  lastVisitDate: z.string().optional(),
  isInactive: z.boolean().optional(),
  emailVerified: z.boolean().optional(),
  avatar: z.string().optional().nullable(),
});

const updateSchema = createSchema.partial().omit({ referredBy: true });

const bulkItemSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.preprocess(
    trimmed,
    z.union([z.literal(""), z.string().email()]).optional()
  ),
  address: z.preprocess(trimmed, z.string().optional()),
});

const bulkSchema = z.object({
  customers: z.array(bulkItemSchema).min(1).max(5000),
});

const walletSchema = z.object({
  amount: z.number().positive(),
  type: z.enum(["CREDIT", "DEBIT"]).default("CREDIT"),
  reason: z.string().min(1).default("Manual Adjustment"),
});

async function requireOrg(req: Request) {
  if (!req.auth) return null;
  return resolveBranchScope(req.auth);
}

function paramId(req: Request): string {
  const raw = req.params.id;
  return Array.isArray(raw) ? raw[0]! : raw!;
}

export async function getCustomers(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = await requireOrg(req);
    if (!scope) {
      res.json({ data: { customers: [] }, error: null });
      return;
    }
    const customers = await listCustomers({ organizationId: scope.organizationId });
    res.json({ data: { customers }, error: null });
  } catch (e) {
    next(e);
  }
}

export async function getCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = await requireOrg(req);
    if (!scope) {
      res.status(401).json({ data: null, error: { message: "Unauthorized" } });
      return;
    }
    const customer = await getCustomerById(paramId(req), scope.organizationId);
    if (!customer) {
      res.status(404).json({ data: null, error: { message: "Customer not found" } });
      return;
    }
    res.json({ data: { customer }, error: null });
  } catch (e) {
    next(e);
  }
}

export async function postCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = await requireOrg(req);
    if (!scope) {
      res.status(401).json({ data: null, error: { message: "Unauthorized" } });
      return;
    }
    const body = createSchema.parse(req.body);
    const customer = await createCustomer({ ...body, organizationId: scope.organizationId });
    res.status(201).json({ data: { customer }, error: null });
  } catch (e) {
    if (e instanceof Error && e.message === "Phone already in use") {
      res.status(409).json({ data: null, error: { message: e.message } });
      return;
    }
    next(e);
  }
}

export async function postCustomersBulk(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = await requireOrg(req);
    if (!scope) {
      res.status(401).json({ data: null, error: { message: "Unauthorized" } });
      return;
    }
    const body = bulkSchema.parse(req.body);
    const result = await createCustomersBulk(
      scope.organizationId,
      body.customers.map((c) => ({
        name: c.name,
        phone: c.phone,
        email: c.email ?? "",
        address: c.address ?? "",
      }))
    );
    res.status(201).json({
      data: {
        created: result.created,
        skipped: result.skipped,
        createdCount: result.created.length,
        skippedCount: result.skipped.length,
      },
      error: null,
    });
  } catch (e) {
    next(e);
  }
}

export async function putCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = await requireOrg(req);
    if (!scope) {
      res.status(401).json({ data: null, error: { message: "Unauthorized" } });
      return;
    }
    const body = updateSchema.parse(req.body);
    const customer = await updateCustomer(paramId(req), scope.organizationId, body);
    if (!customer) {
      res.status(404).json({ data: null, error: { message: "Customer not found" } });
      return;
    }
    res.json({ data: { customer }, error: null });
  } catch (e) {
    if (e instanceof Error && e.message === "Phone already in use") {
      res.status(409).json({ data: null, error: { message: e.message } });
      return;
    }
    next(e);
  }
}

export async function removeCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = await requireOrg(req);
    if (!scope) {
      res.status(401).json({ data: null, error: { message: "Unauthorized" } });
      return;
    }
    const ok = await deleteCustomer(paramId(req), scope.organizationId);
    if (!ok) {
      res.status(404).json({ data: null, error: { message: "Customer not found" } });
      return;
    }
    res.json({ data: { ok: true }, error: null });
  } catch (e) {
    next(e);
  }
}

export async function patchWallet(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = await requireOrg(req);
    if (!scope) {
      res.status(401).json({ data: null, error: { message: "Unauthorized" } });
      return;
    }
    const body = walletSchema.parse(req.body);
    const customer = await adjustWallet(
      paramId(req),
      scope.organizationId,
      body.amount,
      body.type,
      body.reason
    );
    if (!customer) {
      res.status(404).json({ data: null, error: { message: "Customer not found" } });
      return;
    }
    res.json({ data: { customer }, error: null });
  } catch (e) {
    if (e instanceof Error && e.message === "Wallet balance cannot be negative") {
      res.status(400).json({ data: null, error: { message: e.message } });
      return;
    }
    next(e);
  }
}
