import type { PlanCode } from "@prisma/client";

export type PlanLimits = {
  maxBranches: number | null;
  maxStaff?: number | null;
  maxCustomers?: number | null;
};

export type PlanTemplate = {
  planCode: PlanCode;
  planName: string;
  limits: PlanLimits;
};

export const PLAN_CATALOG: Record<PlanCode, PlanTemplate> = {
  STARTER: {
    planCode: "STARTER",
    planName: "Starter",
    limits: { maxBranches: 1, maxStaff: 3 },
  },
  GROWTH: {
    planCode: "GROWTH",
    planName: "Growth",
    limits: { maxBranches: 3, maxStaff: 10 },
  },
  BUSINESS: {
    planCode: "BUSINESS",
    planName: "Business",
    limits: { maxBranches: 10, maxStaff: 25 },
  },
  ENTERPRISE: {
    planCode: "ENTERPRISE",
    planName: "Enterprise",
    limits: { maxBranches: null, maxStaff: null },
  },
  CUSTOM: {
    planCode: "CUSTOM",
    planName: "Custom",
    limits: { maxBranches: 1, maxStaff: 3 },
  },
};

export function parsePlanLimits(raw: unknown): PlanLimits {
  if (!raw || typeof raw !== "object") {
    return { maxBranches: 1 };
  }
  const obj = raw as Record<string, unknown>;
  const maxBranches =
    obj.maxBranches === null
      ? null
      : typeof obj.maxBranches === "number" && Number.isFinite(obj.maxBranches)
        ? Math.max(0, Math.floor(obj.maxBranches))
        : 1;
  return {
    maxBranches,
    maxStaff:
      obj.maxStaff === null
        ? null
        : typeof obj.maxStaff === "number"
          ? Math.floor(obj.maxStaff)
          : undefined,
    maxCustomers:
      obj.maxCustomers === null
        ? null
        : typeof obj.maxCustomers === "number"
          ? Math.floor(obj.maxCustomers)
          : undefined,
  };
}

export function effectiveMaxBranches(
  limits: PlanLimits,
  maxBranchesOverride: number | null | undefined
): number | null {
  if (maxBranchesOverride !== null && maxBranchesOverride !== undefined) {
    return Math.max(0, Math.floor(maxBranchesOverride));
  }
  return limits.maxBranches;
}

export function isUnlimited(max: number | null): boolean {
  return max === null;
}

export function canCreateWithLimit(used: number, max: number | null): boolean {
  if (isUnlimited(max)) return true;
  return used < (max as number);
}
