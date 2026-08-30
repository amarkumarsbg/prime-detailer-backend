/**
 * Rewards service — fetches data from DB and collections, delegates
 * all computation to company-target-engine.ts.
 */
import { prisma } from "../../lib/prisma.js";
import { SINGLETON_ENTITY_ID } from "../../constants/json-collections.js";
import {
  type PeriodType,
  getPeriodsForYear,
} from "../../lib/company-target-periods.js";
import {
  type CompanyTargetTier,
  type RevenueInvoice,
  type EligibleStaffCandidate,
  type CompanyTargetPeriodResult,
  computePeriodResult,
  normalizeRevenueType,
} from "../../lib/company-target-engine.js";

// ---------------------------------------------------------------------------
// Helpers to read AppJsonRow collections
// ---------------------------------------------------------------------------

async function readSettingsPayload(organizationId: string): Promise<Record<string, unknown>> {
  const row = await prisma.appJsonRow.findFirst({
    where: {
      collection: "staffRewardSettings",
      entityId: SINGLETON_ENTITY_ID,
      organizationId,
    },
    select: { payload: true },
  });
  if (!row || typeof row.payload !== "object" || !row.payload) return {};
  return row.payload as Record<string, unknown>;
}

async function readInvoices(organizationId: string): Promise<RevenueInvoice[]> {
  const rows = await prisma.appJsonRow.findMany({
    where: { collection: "invoices", organizationId },
    select: { payload: true },
  });
  const result: RevenueInvoice[] = [];
  for (const r of rows) {
    const p = r.payload as unknown as Record<string, unknown>;
    if (
      typeof p.id === "string" &&
      typeof p.status === "string" &&
      typeof p.grandTotal === "number" &&
      typeof p.createdAt === "string"
    ) {
      result.push({
        id: p.id,
        status: p.status,
        grandTotal: p.grandTotal,
        createdAt: p.createdAt,
      });
    }
  }
  return result;
}

async function readLedgerForStaff(
  organizationId: string,
  staffId: string
): Promise<Record<string, unknown>[]> {
  const rows = await prisma.appJsonRow.findMany({
    where: { collection: "staffRewardLedger", organizationId },
    select: { payload: true },
  });
  return (rows.map((r) => r.payload as Record<string, unknown>)).filter(
    (p) => p.staffId === staffId
  );
}

async function readStaff(organizationId: string): Promise<EligibleStaffCandidate[]> {
  const rows = await prisma.user.findMany({
    where: { organizationId, role: { not: "PLATFORM_OWNER" } },
    select: { id: true, role: true, isActive: true, joiningDate: true },
  });
  return rows.map((u) => ({
    id: u.id,
    role: u.role,
    isActive: u.isActive,
    joiningDate: u.joiningDate ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Settings helpers
// ---------------------------------------------------------------------------

function extractTiers(settings: Record<string, unknown>, periodType: PeriodType): CompanyTargetTier[] {
  const isValidTier = (t: unknown): t is CompanyTargetTier =>
    typeof t === "object" &&
    t !== null &&
    typeof (t as Record<string, unknown>).targetAmount === "number" &&
    typeof (t as Record<string, unknown>).rewardPercent === "number" &&
    typeof (t as Record<string, unknown>).role === "string" &&
    (t as Record<string, unknown>).role !== "";

  // Prefer frequency-specific tiers if present
  const freqTiers = settings.companyTargetFrequencyTiers;
  if (freqTiers && typeof freqTiers === "object" && !Array.isArray(freqTiers)) {
    const typed = freqTiers as Record<string, unknown>;
    if (Array.isArray(typed[periodType])) {
      return (typed[periodType] as unknown[]).filter(isValidTier);
    }
  }
  // Fall back to generic companyTargetTiers
  if (Array.isArray(settings.companyTargetTiers)) {
    return (settings.companyTargetTiers as unknown[]).filter(isValidTier);
  }
  return [];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CompanyTargetResultsInput {
  organizationId: string;
  year: number;
  /** If not provided, reads from staffRewardSettings. */
  periodType?: PeriodType;
  staffId?: string;
}

export async function getCompanyTargetResults(
  input: CompanyTargetResultsInput
): Promise<CompanyTargetPeriodResult[]> {
  const settings = await readSettingsPayload(input.organizationId);

  // Normalize revenue type (always INVOICES)
  const _revType = normalizeRevenueType(settings.companyTargetRevenueType as string | undefined);

  const periodType: PeriodType =
    (input.periodType ??
      (settings.companyTargetPeriod as PeriodType | undefined) ??
      "MONTHLY");

  const tiers = extractTiers(settings, periodType);
  const periods = getPeriodsForYear(input.year, periodType);

  const [invoices, staff] = await Promise.all([
    readInvoices(input.organizationId),
    readStaff(input.organizationId),
  ]);

  return periods.map((p) =>
    computePeriodResult({
      periodLabel: p.label,
      periodType,
      periodMonth: p.periodMonth,
      periodYear: p.periodYear,
      periodStart: p.start,
      periodEnd: p.end,
      allInvoices: invoices,
      tiers,
      allStaff: staff,
      staffId: input.staffId,
    })
  );
}

// ---------------------------------------------------------------------------
// Staff Incentive Summary
// ---------------------------------------------------------------------------

export interface IndividualLedgerRow {
  id: string;
  rewardType: string;
  amount: number;
  status: string;
  periodMonth: number;
  periodYear: number;
  [key: string]: unknown;
}

export interface StaffIncentiveSummary {
  individualRows: IndividualLedgerRow[];
  companyTargetRows: CompanyTargetPeriodResult[];
  totals: {
    totalIndividualNet: number;
    totalCompanyShare: number;
    finalCombined: number;
  };
}

export async function getStaffIncentiveSummary(opts: {
  organizationId: string;
  staffId: string;
  year: number;
}): Promise<StaffIncentiveSummary> {
  const { organizationId, staffId, year } = opts;

  const settings = await readSettingsPayload(organizationId);
  const periodType: PeriodType =
    (settings.companyTargetPeriod as PeriodType | undefined) ?? "MONTHLY";

  const [ledgerRows, companyTargetRows] = await Promise.all([
    readLedgerForStaff(organizationId, staffId),
    getCompanyTargetResults({ organizationId, year, periodType, staffId }),
  ]);

  // Filter ledger rows for the requested year
  const individualRows = ledgerRows.filter(
    (r) => typeof r.periodYear === "number" && r.periodYear === year
  ) as IndividualLedgerRow[];

  // Individual net = sum of APPROVED/PAID_IN_PAYROLL rows (positive for credits, negative for debits)
  const totalIndividualNet = Math.round(
    individualRows
      .filter((r) => r.status === "APPROVED" || r.status === "PAID_IN_PAYROLL")
      .reduce((sum, r) => sum + r.amount, 0) * 100
  ) / 100;

  // Company share = sum of sharePerStaff for eligible periods
  const totalCompanyShare = Math.round(
    companyTargetRows
      .filter((r) => !r.notEligible)
      .reduce((sum, r) => sum + r.sharePerStaff, 0) * 100
  ) / 100;

  const finalCombined = Math.round((totalIndividualNet + totalCompanyShare) * 100) / 100;

  return {
    individualRows,
    companyTargetRows,
    totals: {
      totalIndividualNet,
      totalCompanyShare,
      finalCombined,
    },
  };
}

// ---------------------------------------------------------------------------
// Settings read + normalize
// ---------------------------------------------------------------------------

export async function getRewardSettings(organizationId: string): Promise<Record<string, unknown>> {
  const settings = await readSettingsPayload(organizationId);
  return {
    ...settings,
    companyTargetRevenueType: "INVOICES",
  };
}
