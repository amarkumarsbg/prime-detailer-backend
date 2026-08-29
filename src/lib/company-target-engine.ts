/**
 * Company Target incentive engine — pure, stateless computation functions.
 * All monetary values are rounded to 2 decimal places.
 *
 * Business rules:
 *  - Revenue basis: invoice grandTotal for ISSUED / PARTIAL / PARTIALLY_PAID / PAID invoices only.
 *  - Tier selection: highest tier where revenue >= targetAmount.
 *  - Pool: revenue * rewardPercent / 100.
 *  - Eligible staff: active, non-SUPER_ADMIN, joiningDate <= periodEnd.
 *  - Share: pool / eligibleCount (zero-safe).
 */

export interface CompanyTargetTier {
  targetAmount: number;
  rewardPercent: number;
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

export interface CompanyTargetPeriodResult {
  periodLabel: string;
  periodType: string;
  periodMonth: number;
  periodYear: number;
  revenue: number;
  achievedTierIndex: number | null;
  targetAmount: number | null;
  rewardPercent: number | null;
  totalRewardPool: number;
  eligibleStaffCount: number;
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
 * Select the highest achieved tier where revenue >= targetAmount.
 * Returns null if no tier is achieved.
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
 * Orchestrate a single period's company target result.
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
  /** Optional: check not-eligible flag for this staff. */
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
  const achieved = selectAchievedTier(revenue, tiers);
  const pool = achieved ? calcRewardPool(revenue, achieved.tier.rewardPercent) : 0;
  const eligibleStaff = filterEligibleStaff(allStaff, periodEnd);
  const eligibleStaffCount = eligibleStaff.length;
  const sharePerStaff = calcSharePerStaff(pool, eligibleStaffCount);

  let notEligible = false;
  if (staffId) {
    const staffMember = allStaff.find((s) => s.id === staffId);
    notEligible = staffMember ? !isStaffEligible(staffMember, periodEnd) : true;
  }

  return {
    periodLabel,
    periodType,
    periodMonth,
    periodYear,
    revenue,
    achievedTierIndex: achieved ? achieved.index : null,
    targetAmount: achieved ? achieved.tier.targetAmount : null,
    rewardPercent: achieved ? achieved.tier.rewardPercent : null,
    totalRewardPool: pool,
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
