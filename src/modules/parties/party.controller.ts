import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  getPartyById,
  getPartyLedger,
  hideParty,
  listParties,
  listPartiesWithBalance,
  upsertParty,
  type UpsertPartyInput,
} from "./party.service.js";
import { resolveBranchScope } from "../../lib/data-scope.js";

const partyKindSchema = z.enum(["customer", "supplier"]);
const openingSideSchema = z.enum(["toCollect", "toPay"]);

const bankSchema = z.object({
  id: z.string().optional(),
  accountNumber: z.string().min(1),
  ifsc: z.string().optional(),
  accountHolderName: z.string().optional(),
  bankName: z.string().optional(),
  branchName: z.string().optional(),
  upiId: z.string().optional(),
});

const addressSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  street: z.string().min(1),
  state: z.string().optional(),
  pincode: z.string().optional(),
  city: z.string().optional(),
  isDefault: z.boolean().optional(),
});

const customFieldSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});

const upsertSchema = z
  .object({
    name: z.string().min(1),
    kind: partyKindSchema,
    category: z.string().optional(),
    mobile: z.string().optional(),
    email: z.string().optional(),
    gstin: z.string().optional(),
    pan: z.string().optional(),
    billingAddress: z.string().optional(),
    shippingAddress: z.string().optional(),
    openingBalance: z.number().optional(),
    openingBalanceSide: openingSideSchema.optional(),
    creditPeriodDays: z.number().int().nonnegative().optional(),
    creditLimit: z.number().nonnegative().optional(),
    contactPersonName: z.string().optional(),
    dateOfBirth: z.string().optional(),
    customerId: z.string().optional(),
    vendorKey: z.string().optional(),
    bankAccounts: z.array(bankSchema).optional(),
    shippingAddresses: z.array(addressSchema).optional(),
    customFields: z.array(customFieldSchema).optional(),
  })
  .passthrough();

function paramId(req: Request): string {
  const raw = req.params.id;
  return Array.isArray(raw) ? raw[0]! : raw!;
}

async function requireOrg(req: Request) {
  if (!req.auth) return null;
  return resolveBranchScope(req.auth);
}

export async function getParties(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = await requireOrg(req);
    if (!scope) {
      res.json({ data: { parties: [] }, error: null });
      return;
    }
    const withBalance = req.query.balance === "1" || req.query.balance === "true";
    const parties = withBalance
      ? await listPartiesWithBalance(scope.organizationId)
      : await listParties(scope.organizationId);
    res.json({ data: { parties }, error: null });
  } catch (e) {
    next(e);
  }
}

export async function getParty(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = await requireOrg(req);
    if (!scope) {
      res.status(401).json({ data: null, error: { message: "Unauthorized" } });
      return;
    }
    const party = await getPartyById(paramId(req), scope.organizationId);
    if (!party) {
      res.status(404).json({ data: null, error: { message: "Party not found" } });
      return;
    }
    res.json({ data: { party }, error: null });
  } catch (e) {
    next(e);
  }
}

export async function getPartyLedgerHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = await requireOrg(req);
    if (!scope) {
      res.status(401).json({ data: null, error: { message: "Unauthorized" } });
      return;
    }
    const period = typeof req.query.period === "string" ? req.query.period : "last365";
    const ledger = await getPartyLedger(paramId(req), period, scope.organizationId);
    if (!ledger) {
      res.status(404).json({ data: null, error: { message: "Party not found" } });
      return;
    }
    res.json({ data: { ledger }, error: null });
  } catch (e) {
    next(e);
  }
}

export async function postParty(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = await requireOrg(req);
    if (!scope) {
      res.status(401).json({ data: null, error: { message: "Unauthorized" } });
      return;
    }
    const body = upsertSchema.parse(req.body);
    const party = await upsertParty(null, scope.organizationId, body as UpsertPartyInput);
    res.status(201).json({ data: { party }, error: null });
  } catch (e) {
    next(e);
  }
}

export async function putParty(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = await requireOrg(req);
    if (!scope) {
      res.status(401).json({ data: null, error: { message: "Unauthorized" } });
      return;
    }
    const body = upsertSchema.parse(req.body);
    const party = await upsertParty(paramId(req), scope.organizationId, body as UpsertPartyInput);
    res.json({ data: { party }, error: null });
  } catch (e) {
    next(e);
  }
}

export async function removeParty(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = await requireOrg(req);
    if (!scope) {
      res.status(401).json({ data: null, error: { message: "Unauthorized" } });
      return;
    }
    const party = await getPartyById(paramId(req), scope.organizationId);
    if (!party) {
      res.status(404).json({ data: null, error: { message: "Party not found" } });
      return;
    }
    const ok = await hideParty(paramId(req), scope.organizationId);
    if (!ok) {
      res.status(404).json({ data: null, error: { message: "Party not found" } });
      return;
    }
    res.json({ data: { ok: true }, error: null });
  } catch (e) {
    next(e);
  }
}
