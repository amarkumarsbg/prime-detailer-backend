import type { UserRole } from "@prisma/client";
import type { AuthUser } from "../middleware/auth.js";
import { prisma } from "./prisma.js";
import {
  isArrayCollection,
  isSingletonCollection,
} from "../constants/json-collections.js";

/** Mirrors frontend `canOrgWideRole` — may view all branches in their org. */
const ORG_WIDE_BRANCH_ROLES: readonly UserRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "BRANCH_MANAGER",
] as const;

/** Singletons whose payload nests branch-tagged arrays. */
const BRANCH_NESTED_SINGLETONS = new Set(["payroll", "cashBank", "membership", "leaveConfig"]);

const PAYROLL_NESTED_KEYS = [
  "salaryStructures",
  "payrollRecords",
  "salaryAdvances",
  "salaryAdvanceRecoveries",
] as const;

const CASH_BANK_NESTED_KEYS = ["accounts", "transactions"] as const;

const MEMBERSHIP_NESTED_KEYS = ["packages", "subscriptions"] as const;

export type BranchScope = {
  organizationId: string;
  /** null = all branches in the org (org-wide role). */
  allowedBranchIds: string[] | null;
};

export function canUseOrgWideBranchScope(role: UserRole): boolean {
  return (ORG_WIDE_BRANCH_ROLES as readonly string[]).includes(role);
}

export function payloadBranchId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const id = (payload as { branchId?: unknown }).branchId;
  return typeof id === "string" && id.trim() ? id : undefined;
}

/**
 * Keep item if it has no branchId (treated as org-global) or branchId is allowed.
 * When `allowedBranchIds` is null, keep everything.
 */
export function isPayloadInBranchScope(
  payload: unknown,
  allowedBranchIds: string[] | null
): boolean {
  if (allowedBranchIds === null) return true;
  const branchId = payloadBranchId(payload);
  if (branchId) return allowedBranchIds.includes(branchId);
  if (!payload || typeof payload !== "object") return true;
  const rec = payload as { fromBranchId?: unknown; toBranchId?: unknown };
  const from = typeof rec.fromBranchId === "string" ? rec.fromBranchId : undefined;
  const to = typeof rec.toBranchId === "string" ? rec.toBranchId : undefined;
  if (from || to) {
    return (
      (from != null && allowedBranchIds.includes(from)) ||
      (to != null && allowedBranchIds.includes(to))
    );
  }
  return true;
}

export function filterPayloadsByBranch(
  items: unknown[],
  allowedBranchIds: string[] | null
): unknown[] {
  if (allowedBranchIds === null) return items;
  return items.filter((item) => isPayloadInBranchScope(item, allowedBranchIds));
}

function filterNestedArrayByBranch(
  arr: unknown,
  allowedBranchIds: string[] | null
): unknown[] {
  if (!Array.isArray(arr)) return [];
  return filterPayloadsByBranch(arr, allowedBranchIds);
}

/**
 * Filter nested branch-tagged rows inside payroll / cashBank / membership singletons.
 * Packages in membership often lack branchId — those are kept (org-global catalog).
 */
export function filterNestedSingletonPayload(
  collection: string,
  payload: unknown,
  allowedBranchIds: string[] | null
): unknown {
  if (allowedBranchIds === null) return payload;
  if (!payload || typeof payload !== "object") return payload;
  const src = payload as Record<string, unknown>;

  if (collection === "payroll") {
    const next: Record<string, unknown> = { ...src };
    for (const key of PAYROLL_NESTED_KEYS) {
      if (key in src) next[key] = filterNestedArrayByBranch(src[key], allowedBranchIds);
    }
    return next;
  }

  if (collection === "cashBank") {
    const next: Record<string, unknown> = { ...src };
    for (const key of CASH_BANK_NESTED_KEYS) {
      if (key in src) next[key] = filterNestedArrayByBranch(src[key], allowedBranchIds);
    }
    return next;
  }


  if (collection === "leaveConfig") {
    const next: Record<string, unknown> = { ...src };
    if ("balances" in src) next.balances = filterNestedArrayByBranch(src.balances, allowedBranchIds);
    return next;
  }

  if (collection === "membership") {
    const next: Record<string, unknown> = { ...src };
    for (const key of MEMBERSHIP_NESTED_KEYS) {
      if (key in src) next[key] = filterNestedArrayByBranch(src[key], allowedBranchIds);
    }
    return next;
  }

  return payload;
}

export function applyCollectionBranchScope(
  collection: string,
  items: unknown[],
  allowedBranchIds: string[] | null
): unknown[] {
  if (allowedBranchIds === null) return items;

  if (isArrayCollection(collection)) {
    return filterPayloadsByBranch(items, allowedBranchIds);
  }

  if (isSingletonCollection(collection) && BRANCH_NESTED_SINGLETONS.has(collection)) {
    return items.map((p) => filterNestedSingletonPayload(collection, p, allowedBranchIds));
  }

  return items;
}

/** Public branding fields safe for any authenticated studio user (shell). */
export const BRANDING_KEYS = [
  "businessName",
  "businessLogo",
  "businessTagline",
  "businessPhone",
  "businessWhatsApp",
  "businessEmail",
  "businessAddress",
  "businessWebsite",
  "brandPrimary",
  /** GST on/off for pricing — not a secret; GSTIN stays SETTINGS-only. */
  "gstRegistrationStatus",
] as const;

export type BrandingPayload = Partial<Record<(typeof BRANDING_KEYS)[number], string>>;

export function extractBranding(appSettings: unknown): BrandingPayload {
  if (!appSettings || typeof appSettings !== "object") return {};
  const src = appSettings as Record<string, unknown>;
  const out: BrandingPayload = {};
  for (const key of BRANDING_KEYS) {
    const v = src[key];
    if (typeof v === "string") out[key] = v;
  }
  return out;
}

/** Staff directory DTO — no permissions, attendancePin, or password metadata. */
export type StaffDirectoryEntry = {
  id: string;
  name: string;
  role: string;
  branchId: string;
  organizationId?: string;
  isActive: boolean;
  avatar?: string;
};

export function toStaffDirectoryEntry(u: {
  id: string;
  name: string;
  role: string;
  branchId: string;
  organizationId?: string | null;
  isActive: boolean;
  avatar?: string | null;
}): StaffDirectoryEntry {
  return {
    id: u.id,
    name: u.name,
    role: u.role,
    branchId: u.branchId,
    organizationId: u.organizationId ?? undefined,
    isActive: u.isActive,
    avatar: u.avatar ?? undefined,
  };
}

export async function listOrgBranchIds(organizationId: string): Promise<string[]> {
  const rows = await prisma.branch.findMany({
    where: { organizationId },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/**
 * Resolve branch scope for list APIs.
 * Org-wide roles: all branches in org (`allowedBranchIds: null` means no branch filter within org).
 * Others: only their home `branchId` (must belong to org when org branches are known).
 */
export async function resolveBranchScope(auth: AuthUser): Promise<BranchScope | null> {
  let organizationId = auth.organizationId;
  if (!organizationId) {
    const row = await prisma.user.findUnique({
      where: { id: auth.id },
      select: { organizationId: true },
    });
    organizationId = row?.organizationId;
  }
  if (!organizationId) return null;

  if (canUseOrgWideBranchScope(auth.role)) {
    return { organizationId, allowedBranchIds: null };
  }

  const orgBranchIds = await listOrgBranchIds(organizationId);
  const home = auth.branchId;
  const allowed =
    home && orgBranchIds.includes(home) ? [home] : orgBranchIds.length ? [] : home ? [home] : [];

  return { organizationId, allowedBranchIds: allowed };
}

/** Optional query branchId must be within the caller's allowed set. */
export function intersectQueryBranchId(
  scope: BranchScope,
  queryBranchId: string | undefined
): string[] | null {
  if (!queryBranchId?.trim()) return scope.allowedBranchIds;
  const id = queryBranchId.trim();
  if (scope.allowedBranchIds === null) {
    return [id];
  }
  if (!scope.allowedBranchIds.includes(id)) {
    return [];
  }
  return [id];
}

/**
 * Customer/Vehicle tables are org-scoped. For branch-bound users, further restrict to
 * entities referenced by in-scope job cards / appointments / pickup requests.
 * Org-wide roles (`allowedBranchIds === null`) → no ID filter (null sets).
 */
export async function collectReferencedCustomerVehicleIds(
  organizationId: string,
  allowedBranchIds: string[] | null
): Promise<{ customerIds: Set<string> | null; vehicleIds: Set<string> | null }> {
  if (allowedBranchIds === null) {
    return { customerIds: null, vehicleIds: null };
  }
  if (allowedBranchIds.length === 0) {
    return { customerIds: new Set(), vehicleIds: new Set() };
  }

  const collections = ["jobCards", "appointments", "pickupDropRequests"] as const;
  const rows = await prisma.appJsonRow.findMany({
    where: { organizationId, collection: { in: [...collections] } },
    select: { payload: true },
  });

  const customerIds = new Set<string>();
  const vehicleIds = new Set<string>();
  for (const row of rows) {
    if (!isPayloadInBranchScope(row.payload, allowedBranchIds)) continue;
    if (!row.payload || typeof row.payload !== "object") continue;
    const p = row.payload as Record<string, unknown>;
    if (typeof p.customerId === "string" && p.customerId) customerIds.add(p.customerId);
    if (typeof p.vehicleId === "string" && p.vehicleId) vehicleIds.add(p.vehicleId);
  }
  return { customerIds, vehicleIds };
}
