import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { BRANCH_MUTATION_ROLES } from "../../lib/rbac.js";
import type { UserRole } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { listBranchesApi, upsertBranchApi, patchBranchApi, getBranchDeletionBlockers, deleteBranchApi } from "./branch-api.service.js";

function forbidden(res: Response, message: string) {
  res.status(403).json({ data: null, error: { message } });
}

function canMutateBranch(role: UserRole | undefined): boolean {
  return role !== undefined && (BRANCH_MUTATION_ROLES as readonly string[]).includes(role);
}

function paramId(req: Request): string {
  const raw = req.params.id;
  return Array.isArray(raw) ? raw[0]! : raw!;
}

const tenDigitPhone = z.string().regex(/^\d{10}$/, "Must be a 10-digit mobile number");
const optionalTenDigitPhone = z
  .string()
  .regex(/^$|^\d{10}$/, "Must be a 10-digit mobile number")
  .nullable()
  .optional();

const branchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  address: z.string().min(1),
  phone: tenDigitPhone,
  isActive: z.boolean().optional(),
  qrCodeId: z.string().nullable().optional(),
  code: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  pincode: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  managerName: z.string().nullable().optional(),
  managerPhone: optionalTenDigitPhone,
});

export async function getBranches(req: Request, res: Response, next: NextFunction) {
  try {
    let organizationId = req.auth?.organizationId;
    if (!organizationId && req.auth?.id) {
      const row = await prisma.user.findUnique({
        where: { id: req.auth.id },
        select: { organizationId: true },
      });
      organizationId = row?.organizationId;
    }
    const branches = await listBranchesApi(organizationId);
    res.json({ data: { branches }, error: null });
  } catch (e) {
    next(e);
  }
}

export async function postBranch(req: Request, res: Response, next: NextFunction) {
  try {
    if (!canMutateBranch(req.auth?.role)) {
      forbidden(res, "You do not have permission to create branches.");
      return;
    }
    let orgId = req.auth?.organizationId;
    if (!orgId && req.auth?.id) {
      const row = await prisma.user.findUnique({
        where: { id: req.auth.id },
        select: { organizationId: true },
      });
      orgId = row?.organizationId;
    }
    if (!orgId) {
      res.status(403).json({
        data: null,
        error: { message: "Organization not found on user", code: "ORG_MISSING" },
      });
      return;
    }
    const body = branchSchema.parse(req.body);
    const branch = await upsertBranchApi({
      ...body,
      organizationId: orgId,
    });
    res.status(201).json({ data: { branch }, error: null });
  } catch (e) {
    next(e);
  }
}

const patchBranchSchema = branchSchema.partial().omit({ id: true });

export async function putBranch(req: Request, res: Response, next: NextFunction) {
  try {
    if (!canMutateBranch(req.auth?.role)) {
      forbidden(res, "You do not have permission to update branches.");
      return;
    }
    const id = paramId(req);
    const body = patchBranchSchema.parse(req.body);
    const branch = await patchBranchApi(id, body);
    if (!branch) {
      res.status(404).json({ data: null, error: { message: "Branch not found" } });
      return;
    }
    res.json({ data: { branch }, error: null });
  } catch (e) {
    next(e);
  }
}

export async function getBranchDeletionCheck(req: Request, res: Response, next: NextFunction) {
  try {
    if (!canMutateBranch(req.auth?.role)) {
      forbidden(res, "You do not have permission to manage branches.");
      return;
    }
    const id = paramId(req);
    const blockers = await getBranchDeletionBlockers(id);
    res.json({
      data: { canDelete: blockers.length === 0, blockers },
      error: null,
    });
  } catch (e) {
    next(e);
  }
}

export async function deleteBranch(req: Request, res: Response, next: NextFunction) {
  try {
    if (!canMutateBranch(req.auth?.role)) {
      forbidden(res, "You do not have permission to delete branches.");
      return;
    }
    const id = paramId(req);
    const blockers = await getBranchDeletionBlockers(id);
    if (blockers.length > 0) {
      res.status(409).json({
        data: { blockers },
        error: {
          message: `Cannot delete this site: ${blockers.map((b) => b.message).join("; ")}`,
        },
      });
      return;
    }
    const deleted = await deleteBranchApi(id);
    if (!deleted) {
      res.status(404).json({ data: null, error: { message: "Branch not found" } });
      return;
    }
    res.json({ data: { ok: true }, error: null });
  } catch (e) {
    next(e);
  }
}
