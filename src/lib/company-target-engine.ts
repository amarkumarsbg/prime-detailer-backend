/**
 * Company Target incentive engine — pure, stateless computation functions.
 * All monetary values are rounded to 2 decimal places.
 *
 * Business rules:
 *  - Revenue basis: invoice grandTotal for ISSUED / PARTIAL / PARTIALLY_PAID / PAID invoices only.
 *  - Each tier is tied to a specific staff role and is evaluated INDEPENDENTLY:
 *    every tier whose targetAmount is met by revenue contributes its own pool,
 *    split only among eligible staff of THAT tier's role. There is no single
 *    "highest tier wins" — a Mechanic tier, a Supervisor tier, a Manager tier,
 *    etc. can all be achieved simultaneously and each pays out independently.
 *  - Pool (per achieved tier): revenue * tier.rewardPercent / 100.
 *  - Eligible staff (per tier): active, non-SUPER_ADMIN, joiningDate <= periodEnd,
 *    joining day-of-month <= 5, AND role matches the tier's role.
 *  - Share (per tier): pool / eligibleCount for that role (zero-safe).
 */

export interface CompanyTargetTier {
  targetAmount: number;
  rewardPercent: number;
  /** Staff role this tier's pool is scoped to (e.g. "Mechanic", "Branch Manager"). */
  role: string;
}

/** Subset of Invoice fields needed for revenue computation. */
export interface RevenueInvoice {
  id: string;
  status: string;
  grandTotal: number;
  /** ISO date string used to filter by period. */
  createdAt: string;
}

/** Subset of User/Staff fields needed for eligibility. */
export interface EligibleStaffCandidate {
  id: string;
  role: string;
  isActive: boolean;
  joiningDate?: string | null;
}

/** Per-tier (= per-role) breakdown row for a period. */
export interface RoleTierBreakdown {
  role: string;
  tierIndex: number;
  targetAmount: number;
  rewardPercent: number;
  /** True when revenue >= targetAmount for this tier. */
  achieved: boolean;
  /** revenue * rewardPercent / 100 when achieved, else 0. */
  pool: number;
  /** Active, non-SUPER_ADMIN, eligible-by-date staff whose role matches this tier. */
  eligibleStaffCount: number;
  /** pool / eligibleStaffCount, 0-safe; 0 when the tier isn't achieved. */
  sharePerStaff: number;
}

export interface CompanyTargetPeriodResult {
  periodLabel: string;
  periodType: string;
  periodMonth: number;
  periodYear: number;
  revenue: number;
  /** Sum of every achieved tier's pool across all roles. */
  totalRewardPool: number;
  /** One row per configured tier — independent achievement per role. */
  roleBreakdown: RoleTierBreakdown[];
  /** Role of the requested staffId, when provided (null otherwise / unknown staff). */
  staffRole: string | null;
  /** Index into `roleBreakdown` for the tier matching the requested staff's role, if any. */
  achievedTierIndex: number | null;
  targetAmount: number | null;
  rewardPercent: number | null;
  /** Eligible-staff count for the requested staff's own role-tier (0 if no matching tier). */
  eligibleStaffCount: number;
  /** The requested staff's own share (0 if ineligible, tier not achieved, or no matching tier). */
  sharePerStaff: number;
  /** True when the requested staffId is not eligible for this period. */
  notEligible: boolean;
}

/**
 * Valid invoice statuses that count toward company-target revenue.
 * Accepts both "PARTIAL" (frontend shorthand) and "PARTIALLY_PAID" (stored value).
 */
const VALID_STATUSES = new Set(["issued", "partial", "partially_paid", "paid"]);

export function isValidRevenueInvoice(status: string): boolean {
  return VALID_STATUSES.has(status.toLowerCase());
}

/**
 * Filter invoices to only those with valid status and within the period.
 */
export function filterRevenueInvoices(
  invoices: RevenueInvoice[],
  periodStart: Date,
  periodEnd: Date
): RevenueInvoice[] {
  const from = periodStart.getTime();
  const to = periodEnd.getTime();
  return invoices.filter((inv) => {
    if (!isValidRevenueInvoice(inv.status)) return false;
    const t = new Date(inv.createdAt).getTime();
    return t >= from && t <= to;
  });
}

/**
 * Sum grandTotal of filtered invoices.
 */
export function calcRevenue(invoices: RevenueInvoice[]): number {
  const raw = invoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
  return round2(raw);
}

/**
 * Normalize a role label for comparison (case/spacing/punctuation-insensitive).
 * e.g. "Branch Manager" / "branch-manager" / "BRANCH_MANAGER" all normalize to "BRANCH_MANAGER".
 */
export function normalizeRoleKey(role: string): string {
  return role.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

/**
 * Select the highest achieved tier where revenue >= targetAmount.
 * Generic utility retained for callers that need "single highest tier"
 * semantics; the main per-role engine (`computeRoleBreakdown` /
 * `computePeriodResult`) no longer uses "highest tier wins" — every tier is
 * evaluated independently per its own role.
 */
export function selectAchievedTier(
  revenue: number,
  tiers: CompanyTargetTier[]
): { tier: CompanyTargetTier; index: number } | null {
  if (!tiers || tiers.length === 0) return null;
  let best: { tier: CompanyTargetTier; index: number } | null = null;
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i]!;
    if (revenue >= tier.targetAmount) {
      if (best === null || tier.targetAmount > best.tier.targetAmount) {
        best = { tier, index: i };
      }
    }
  }
  return best;
}

/**
 * Calculate total reward pool: revenue * rewardPercent / 100.
 */
export function calcRewardPool(revenue: number, rewardPercent: number): number {
  return round2((revenue * rewardPercent) / 100);
}

/**
 * Filter staff to eligible candidates:
 *  - isActive = true
 *  - role !== 'SUPER_ADMIN'
 *  - joiningDate (if set) <= periodEnd date
 *  - joining day-of-month must be <= 5 (policy rule)
 *
 * Staff with no joiningDate are excluded (joining day cannot be verified).
 */
export function filterEligibleStaff(
  staff: EligibleStaffCandidate[],
  periodEnd: Date
): EligibleStaffCandidate[] {
  const periodEndStr = periodEnd.toISOString().slice(0, 10); // "YYYY-MM-DD"
  return staff.filter((s) => {
    if (!s.isActive) return false;
    if (s.role === "SUPER_ADMIN") return false;
    // joiningDate is required for eligibility; must be on or before period end
    if (!s.joiningDate) return false;
    const jd = s.joiningDate.slice(0, 10); // "YYYY-MM-DD"
    if (jd > periodEndStr) return false;
    // Joining day-of-month must be 5 or less
    const joiningDay = parseInt(jd.slice(8, 10), 10);
    if (joiningDay > 5) return false;
    return true;
  });
}

/**
 * Eligible staff (see `filterEligibleStaff`) further narrowed to a specific
 * tier's role (case/spacing-insensitive match via `normalizeRoleKey`).
 */
export function filterEligibleStaffForRole(
  staff: EligibleStaffCandidate[],
  periodEnd: Date,
  role: string
): EligibleStaffCandidate[] {
  const key = normalizeRoleKey(role);
  return filterEligibleStaff(staff, periodEnd).filter((s) => normalizeRoleKey(s.role) === key);
}

/**
 * Whether a specific staff member is eligible for the period.
 */
export function isStaffEligible(
  staff: EligibleStaffCandidate,
  periodEnd: Date
): boolean {
  return filterEligibleStaff([staff], periodEnd).length > 0;
}

/**
 * Safe division: pool / count. Returns 0 if count is 0.
 */
export function calcSharePerStaff(pool: number, eligibleCount: number): number {
  if (eligibleCount === 0) return 0;
  return round2(pool / eligibleCount);
}

/**
 * Round to 2 decimal places (monetary precision).
 */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Evaluate every configured tier independently against revenue: a tier is
 * "achieved" when revenue >= its targetAmount, in which case its pool is
 * split only among eligible staff whose role matches that tier's role.
 * Tiers for different roles do not affect each other (no "highest wins").
 */
export function computeRoleBreakdown(
  revenue: number,
  tiers: CompanyTargetTier[],
  allStaff: EligibleStaffCandidate[],
  periodEnd: Date
): RoleTierBreakdown[] {
  return tiers.map((tier, index) => {
    const achieved = revenue >= tier.targetAmount;
    const pool = achieved ? calcRewardPool(revenue, tier.rewardPercent) : 0;
    const eligibleStaffCount = filterEligibleStaffForRole(allStaff, periodEnd, tier.role).length;
    const sharePerStaff = achieved ? calcSharePerStaff(pool, eligibleStaffCount) : 0;
    return {
      role: tier.role,
      tierIndex: index,
      targetAmount: tier.targetAmount,
      rewardPercent: tier.rewardPercent,
      achieved,
      pool,
      eligibleStaffCount,
      sharePerStaff,
    };
  });
}

/**
 * Orchestrate a single period's company target result: computes the
 * independent per-role tier breakdown, plus (when `staffId` is given) the
 * specific numbers relevant to that one staff member's own role-tier.
 */
export function computePeriodResult(opts: {
  periodLabel: string;
  periodType: string;
  periodMonth: number;
  periodYear: number;
  periodStart: Date;
  periodEnd: Date;
  allInvoices: RevenueInvoice[];
  tiers: CompanyTargetTier[];
  allStaff: EligibleStaffCandidate[];
  /** Optional: compute staff-specific fields (own tier match, share, eligibility). */
  staffId?: string;
}): CompanyTargetPeriodResult {
  const {
    periodLabel,
    periodType,
    periodMonth,
    periodYear,
    periodStart,
    periodEnd,
    allInvoices,
    tiers,
    allStaff,
    staffId,
  } = opts;

  const validInvoices = filterRevenueInvoices(allInvoices, periodStart, periodEnd);
  const revenue = calcRevenue(validInvoices);
  const roleBreakdown = computeRoleBreakdown(revenue, tiers, allStaff, periodEnd);
  const totalRewardPool = round2(roleBreakdown.reduce((sum, r) => sum + r.pool, 0));

  let staffRole: string | null = null;
  let achievedTierIndex: number | null = null;
  let targetAmount: number | null = null;
  let rewardPercent: number | null = null;
  let eligibleStaffCount = 0;
  let sharePerStaff = 0;
  let notEligible = false;

  if (staffId) {
    const staffMember = allStaff.find((s) => s.id === staffId);
    if (!staffMember) {
      notEligible = true;
    } else {
      staffRole = staffMember.role;
      const eligible = isStaffEligible(staffMember, periodEnd);
      notEligible = !eligible;

      const roleKey = normalizeRoleKey(staffMember.role);
      const matchingTier = roleBreakdown.find((r) => normalizeRoleKey(r.role) === roleKey);
      if (matchingTier) {
        achievedTierIndex = matchingTier.tierIndex;
        targetAmount = matchingTier.targetAmount;
        rewardPercent = matchingTier.rewardPercent;
        eligibleStaffCount = matchingTier.eligibleStaffCount;
        sharePerStaff = eligible ? matchingTier.sharePerStaff : 0;
      }
    }
  }

  return {
    periodLabel,
    periodType,
    periodMonth,
    periodYear,
    revenue,
    totalRewardPool,
    roleBreakdown,
    staffRole,
    achievedTierIndex,
    targetAmount,
    rewardPercent,
    eligibleStaffCount,
    sharePerStaff,
    notEligible,
  };
}

/**
 * Normalize legacy companyTargetRevenueType values to "INVOICES".
 * Legacy values: SERVICES, COUNTER_SALE, BOTH → all → INVOICES
 */
export function normalizeRevenueType(value: string | undefined | null): "INVOICES" {
  return "INVOICES";
}
