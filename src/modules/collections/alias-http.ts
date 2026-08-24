/**
 * Shared HTTP helpers for dedicated document-module aliases.
 * Response envelopes match `/api/collections/*` so cutover is path-only.
 */
import type { Request } from "express";
import {
  intersectQueryBranchId,
  resolveBranchScope,
  type BranchScope,
} from "../../lib/data-scope.js";

export type ListScopeResult =
  | { kind: "ok"; scope: BranchScope; allowedBranchIds: string[] | null }
  | { kind: "empty" };

/** Resolve org + branch scope for document list endpoints. */
export async function resolveDocumentListScope(req: Request): Promise<ListScopeResult> {
  if (!req.auth) return { kind: "empty" };
  const scope = await resolveBranchScope(req.auth);
  if (!scope) return { kind: "empty" };
  const q = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
  return {
    kind: "ok",
    scope,
    allowedBranchIds: intersectQueryBranchId(scope, q),
  };
}

/** Require authenticated org for writes; null if missing. */
export async function requireDocumentOrg(req: Request): Promise<BranchScope | null> {
  if (!req.auth) return null;
  return resolveBranchScope(req.auth);
}

export function hasJobCardPricingPermission(req: Request): boolean {
  if (!req.auth) return false;
  if (req.auth.role === "SUPER_ADMIN") return true;
  return Boolean(req.auth.permissions?.includes("JOB_CARD_PRICING"));
}

export function entityIdParam(req: Request, name = "id"): string {
  const raw = req.params[name];
  return Array.isArray(raw) ? raw[0]! : raw!;
}
