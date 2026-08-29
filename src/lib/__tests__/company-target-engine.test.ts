/**
 * Unit tests for company-target-engine.ts
 *
 * Run with: npx tsx --test src/lib/__tests__/company-target-engine.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isValidRevenueInvoice,
  filterRevenueInvoices,
  calcRevenue,
  selectAchievedTier,
  calcRewardPool,
  filterEligibleStaff,
  isStaffEligible,
  calcSharePerStaff,
  computePeriodResult,
  round2,
  type RevenueInvoice,
  type EligibleStaffCandidate,
  type CompanyTargetTier,
} from "../company-target-engine.js";
import { getPeriodsForYear, getPeriodForMonth } from "../company-target-periods.js";

// ---------------------------------------------------------------------------
// isValidRevenueInvoice
// ---------------------------------------------------------------------------
describe("isValidRevenueInvoice", () => {
  it("accepts ISSUED (various cases)", () => {
    assert.ok(isValidRevenueInvoice("ISSUED"));
    assert.ok(isValidRevenueInvoice("issued"));
    assert.ok(isValidRevenueInvoice("Issued"));
  });

  it("accepts PARTIAL and PARTIALLY_PAID", () => {
    assert.ok(isValidRevenueInvoice("PARTIAL"));
    assert.ok(isValidRevenueInvoice("partial"));
    assert.ok(isValidRevenueInvoice("PARTIALLY_PAID"));
    assert.ok(isValidRevenueInvoice("partially_paid"));
  });

  it("accepts PAID", () => {
    assert.ok(isValidRevenueInvoice("PAID"));
    assert.ok(isValidRevenueInvoice("paid"));
  });

  it("rejects DRAFT", () => {
    assert.ok(!isValidRevenueInvoice("DRAFT"));
  });

  it("rejects CANCELLED", () => {
    assert.ok(!isValidRevenueInvoice("CANCELLED"));
  });

  it("rejects VOID", () => {
    assert.ok(!isValidRevenueInvoice("VOID"));
  });

  it("rejects DELETED", () => {
    assert.ok(!isValidRevenueInvoice("DELETED"));
  });

  it("rejects empty string", () => {
    assert.ok(!isValidRevenueInvoice(""));
  });
});

// ---------------------------------------------------------------------------
// filterRevenueInvoices — date range
// ---------------------------------------------------------------------------
describe("filterRevenueInvoices", () => {
  const jan2026Start = new Date(Date.UTC(2026, 0, 1, 0, 0, 0, 0));
  const jan2026End = new Date(Date.UTC(2026, 0, 31, 23, 59, 59, 999));

  const invoices: RevenueInvoice[] = [
    { id: "i1", status: "ISSUED", grandTotal: 1000, createdAt: "2026-01-15T10:00:00Z" },
    { id: "i2", status: "PAID", grandTotal: 2000, createdAt: "2026-01-31T23:59:59Z" },
    { id: "i3", status: "DRAFT", grandTotal: 500, createdAt: "2026-01-10T00:00:00Z" },
    { id: "i4", status: "CANCELLED", grandTotal: 300, createdAt: "2026-01-20T00:00:00Z" },
    { id: "i5", status: "ISSUED", grandTotal: 800, createdAt: "2026-02-01T00:00:00Z" }, // outside range
    { id: "i6", status: "PARTIALLY_PAID", grandTotal: 1500, createdAt: "2026-01-05T00:00:00Z" },
  ];

  it("returns only valid-status invoices within period", () => {
    const filtered = filterRevenueInvoices(invoices, jan2026Start, jan2026End);
    const ids = filtered.map((i) => i.id).sort();
    assert.deepEqual(ids, ["i1", "i2", "i6"]);
  });

  it("excludes invoices outside period", () => {
    const filtered = filterRevenueInvoices(invoices, jan2026Start, jan2026End);
    assert.ok(!filtered.find((i) => i.id === "i5"));
  });

  it("excludes DRAFT and CANCELLED even if in period", () => {
    const filtered = filterRevenueInvoices(invoices, jan2026Start, jan2026End);
    assert.ok(!filtered.find((i) => i.id === "i3"));
    assert.ok(!filtered.find((i) => i.id === "i4"));
  });
});

// ---------------------------------------------------------------------------
// calcRevenue
// ---------------------------------------------------------------------------
describe("calcRevenue", () => {
  it("sums grandTotal and rounds to 2 dp", () => {
    const invoices: RevenueInvoice[] = [
      { id: "a", status: "ISSUED", grandTotal: 1000.005, createdAt: "2026-01-01T00:00:00Z" },
      { id: "b", status: "PAID", grandTotal: 2000.001, createdAt: "2026-01-01T00:00:00Z" },
    ];
    assert.equal(calcRevenue(invoices), 3000.01);
  });

  it("returns 0 for empty list", () => {
    assert.equal(calcRevenue([]), 0);
  });
});

// ---------------------------------------------------------------------------
// selectAchievedTier
// ---------------------------------------------------------------------------
describe("selectAchievedTier", () => {
  const tiers: CompanyTargetTier[] = [
    { targetAmount: 50000, rewardPercent: 5 },
    { targetAmount: 75000, rewardPercent: 7 },
    { targetAmount: 90000, rewardPercent: 8 },
  ];

  it("returns highest achieved tier when revenue >= targetAmount", () => {
    const result = selectAchievedTier(90000, tiers);
    assert.ok(result !== null);
    assert.equal(result.tier.targetAmount, 90000);
    assert.equal(result.tier.rewardPercent, 8);
    assert.equal(result.index, 2);
  });

  it("selects tier 1 when revenue is between tier[0] and tier[1]", () => {
    const result = selectAchievedTier(60000, tiers);
    assert.ok(result !== null);
    assert.equal(result.tier.targetAmount, 50000);
    assert.equal(result.index, 0);
  });

  it("returns null when revenue is below all tiers", () => {
    const result = selectAchievedTier(10000, tiers);
    assert.equal(result, null);
  });

  it("returns null for empty tiers", () => {
    assert.equal(selectAchievedTier(100000, []), null);
  });

  it("handles exact match on lowest tier boundary", () => {
    const result = selectAchievedTier(50000, tiers);
    assert.ok(result !== null);
    assert.equal(result.tier.targetAmount, 50000);
  });
});

// ---------------------------------------------------------------------------
// calcRewardPool
// ---------------------------------------------------------------------------
describe("calcRewardPool", () => {
  it("Scenario A: 55000 * 5% = 2750", () => {
    assert.equal(calcRewardPool(55000, 5), 2750);
  });

  it("Scenario B: 90000 * 8% = 7200", () => {
    assert.equal(calcRewardPool(90000, 8), 7200);
  });

  it("rounds to 2 dp", () => {
    assert.equal(calcRewardPool(100, 3.333), 3.33);
  });
});

// ---------------------------------------------------------------------------
// filterEligibleStaff
// ---------------------------------------------------------------------------
describe("filterEligibleStaff", () => {
  const periodEnd = new Date(Date.UTC(2026, 0, 31, 23, 59, 59, 999)); // Jan 31 2026

  const staff: EligibleStaffCandidate[] = [
    { id: "s1", role: "MECHANIC", isActive: true, joiningDate: "2025-06-01" },   // day 1 ✓
    { id: "s2", role: "SUPER_ADMIN", isActive: true, joiningDate: "2024-01-03" }, // SUPER_ADMIN ✗
    { id: "s3", role: "ADMIN", isActive: false, joiningDate: "2024-01-04" },      // inactive ✗
    { id: "s4", role: "MANAGER", isActive: true, joiningDate: "2026-02-01" },     // joined after period end ✗
    { id: "s5", role: "RECEPTIONIST", isActive: true, joiningDate: null },        // no joining date ✗
    { id: "s6", role: "MECHANIC", isActive: true, joiningDate: "2026-01-05" },    // day 5 on period end ✓
    { id: "s7", role: "MECHANIC", isActive: true, joiningDate: "2025-03-06" },    // day 6 ✗ (joining day > 5)
    { id: "s8", role: "MECHANIC", isActive: true, joiningDate: "2025-07-10" },    // day 10 ✗
    { id: "s9", role: "ADMIN", isActive: true, joiningDate: "2024-12-02" },       // day 2 ✓
    { id: "s10", role: "MECHANIC", isActive: true, joiningDate: "2025-08-31" },   // day 31 ✗
  ];

  it("excludes SUPER_ADMIN", () => {
    const eligible = filterEligibleStaff(staff, periodEnd);
    assert.ok(!eligible.find((s) => s.id === "s2"));
  });

  it("excludes inactive staff", () => {
    const eligible = filterEligibleStaff(staff, periodEnd);
    assert.ok(!eligible.find((s) => s.id === "s3"));
  });

  it("excludes staff who joined after period end", () => {
    const eligible = filterEligibleStaff(staff, periodEnd);
    assert.ok(!eligible.find((s) => s.id === "s4"));
  });

  it("excludes staff with no joining date", () => {
    const eligible = filterEligibleStaff(staff, periodEnd);
    assert.ok(!eligible.find((s) => s.id === "s5"));
  });

  it("excludes staff with joining day > 5 (day 6)", () => {
    const eligible = filterEligibleStaff(staff, periodEnd);
    assert.ok(!eligible.find((s) => s.id === "s7"));
  });

  it("excludes staff with joining day 10", () => {
    const eligible = filterEligibleStaff(staff, periodEnd);
    assert.ok(!eligible.find((s) => s.id === "s8"));
  });

  it("excludes staff with joining day 31", () => {
    const eligible = filterEligibleStaff(staff, periodEnd);
    assert.ok(!eligible.find((s) => s.id === "s10"));
  });

  it("includes staff with joining day 1", () => {
    const eligible = filterEligibleStaff(staff, periodEnd);
    assert.ok(eligible.find((s) => s.id === "s1"));
  });

  it("includes staff with joining day exactly 5 on period-end date", () => {
    const eligible = filterEligibleStaff(staff, periodEnd);
    assert.ok(eligible.find((s) => s.id === "s6"));
  });

  it("includes active non-SUPER_ADMIN staff with joining day 2", () => {
    const eligible = filterEligibleStaff(staff, periodEnd);
    assert.ok(eligible.find((s) => s.id === "s9"));
  });

  it("returns only s1, s6, s9 as eligible", () => {
    const eligible = filterEligibleStaff(staff, periodEnd);
    const ids = eligible.map((s) => s.id).sort();
    assert.deepEqual(ids, ["s1", "s6", "s9"]);
  });
});

// ---------------------------------------------------------------------------
// calcSharePerStaff
// ---------------------------------------------------------------------------
describe("calcSharePerStaff", () => {
  it("Scenario A: pool 2750 / 1 = 2750", () => {
    assert.equal(calcSharePerStaff(2750, 1), 2750);
  });

  it("Scenario B: pool 7200 / 2 = 3600", () => {
    assert.equal(calcSharePerStaff(7200, 2), 3600);
  });

  it("returns 0 when eligibleCount is 0 (no division by zero)", () => {
    assert.equal(calcSharePerStaff(5000, 0), 0);
  });

  it("rounds to 2 dp", () => {
    assert.equal(calcSharePerStaff(100, 3), 33.33);
  });
});

// ---------------------------------------------------------------------------
// round2
// ---------------------------------------------------------------------------
describe("round2", () => {
  it("rounds 1.555 to 1.56", () => {
    // 1.555 * 100 = 155.50000000000003 in IEEE 754 → rounds to 156 → 1.56
    assert.equal(round2(1.555), 1.56);
  });

  it("preserves exact 2dp values", () => {
    assert.equal(round2(123.45), 123.45);
  });
});

// ---------------------------------------------------------------------------
// computePeriodResult — deterministic acceptance scenarios
// ---------------------------------------------------------------------------
describe("computePeriodResult — acceptance scenarios", () => {
  const tiers: CompanyTargetTier[] = [
    { targetAmount: 50000, rewardPercent: 5 },
    { targetAmount: 90000, rewardPercent: 8 },
  ];

  const periodStart = new Date(Date.UTC(2026, 0, 1));
  const periodEnd = new Date(Date.UTC(2026, 0, 31, 23, 59, 59, 999));

  // day 1 — eligible
  const staff: EligibleStaffCandidate[] = [
    { id: "s1", role: "MECHANIC", isActive: true, joiningDate: "2025-01-01" },
  ];

  it("Scenario A: revenue 55000, tier 50000 @ 5%, 1 eligible staff → share 2750", () => {
    const invoices: RevenueInvoice[] = [
      { id: "i1", status: "ISSUED", grandTotal: 55000, createdAt: "2026-01-15T10:00:00Z" },
    ];
    const result = computePeriodResult({
      periodLabel: "Jan 2026",
      periodType: "MONTHLY",
      periodMonth: 1,
      periodYear: 2026,
      periodStart,
      periodEnd,
      allInvoices: invoices,
      tiers,
      allStaff: staff,
    });
    assert.equal(result.revenue, 55000);
    assert.equal(result.targetAmount, 50000);
    assert.equal(result.rewardPercent, 5);
    assert.equal(result.totalRewardPool, 2750);
    assert.equal(result.eligibleStaffCount, 1);
    assert.equal(result.sharePerStaff, 2750);
  });

  it("Scenario B: revenue 90000, tier 90000 @ 8%, 2 eligible staff → share 3600 each", () => {
    // Both joined on day 1 and day 3 (both <= 5)
    const staff2: EligibleStaffCandidate[] = [
      { id: "s1", role: "MECHANIC", isActive: true, joiningDate: "2025-01-01" },
      { id: "s2", role: "ADMIN", isActive: true, joiningDate: "2024-06-03" },
    ];
    const invoices: RevenueInvoice[] = [
      { id: "i1", status: "PAID", grandTotal: 90000, createdAt: "2026-01-20T10:00:00Z" },
    ];
    const result = computePeriodResult({
      periodLabel: "Jan 2026",
      periodType: "MONTHLY",
      periodMonth: 1,
      periodYear: 2026,
      periodStart,
      periodEnd,
      allInvoices: invoices,
      tiers,
      allStaff: staff2,
    });
    assert.equal(result.revenue, 90000);
    assert.equal(result.targetAmount, 90000);
    assert.equal(result.rewardPercent, 8);
    assert.equal(result.totalRewardPool, 7200);
    assert.equal(result.eligibleStaffCount, 2);
    assert.equal(result.sharePerStaff, 3600);
  });

  it("staff with joining day > 5 is excluded from eligible count", () => {
    // joined on day 10 — ineligible even though active and before period end
    const staffDay10: EligibleStaffCandidate[] = [
      { id: "d10", role: "MECHANIC", isActive: true, joiningDate: "2025-03-10" },
    ];
    const invoices: RevenueInvoice[] = [
      { id: "i1", status: "ISSUED", grandTotal: 55000, createdAt: "2026-01-10T00:00:00Z" },
    ];
    const result = computePeriodResult({
      periodLabel: "Jan 2026",
      periodType: "MONTHLY",
      periodMonth: 1,
      periodYear: 2026,
      periodStart,
      periodEnd,
      allInvoices: invoices,
      tiers,
      allStaff: staffDay10,
    });
    assert.equal(result.eligibleStaffCount, 0);
    assert.equal(result.sharePerStaff, 0);
  });

  it("final combined total: individualNet + companyShare", () => {
    // This is a structural check — the engine correctly returns sharePerStaff
    // which the service adds to individualNet for finalCombined.
    const invoices: RevenueInvoice[] = [
      { id: "i1", status: "ISSUED", grandTotal: 55000, createdAt: "2026-01-15T00:00:00Z" },
    ];
    const result = computePeriodResult({
      periodLabel: "Jan 2026",
      periodType: "MONTHLY",
      periodMonth: 1,
      periodYear: 2026,
      periodStart,
      periodEnd,
      allInvoices: invoices,
      tiers,
      allStaff: staff,
    });
    // Simulate: individualNet=1000 + companyShare=2750 = 3750
    const simulatedIndividualNet = 1000;
    assert.equal(
      Math.round((simulatedIndividualNet + result.sharePerStaff) * 100) / 100,
      3750
    );
  });

  it("zero eligible staff → sharePerStaff 0, no divide-by-zero", () => {
    const invoices: RevenueInvoice[] = [
      { id: "i1", status: "ISSUED", grandTotal: 55000, createdAt: "2026-01-10T00:00:00Z" },
    ];
    const result = computePeriodResult({
      periodLabel: "Jan 2026",
      periodType: "MONTHLY",
      periodMonth: 1,
      periodYear: 2026,
      periodStart,
      periodEnd,
      allInvoices: invoices,
      tiers,
      allStaff: [],
    });
    assert.equal(result.eligibleStaffCount, 0);
    assert.equal(result.sharePerStaff, 0);
  });

  it("notEligible=true when staffId joined after period end", () => {
    const lateStaff: EligibleStaffCandidate[] = [
      { id: "late1", role: "MECHANIC", isActive: true, joiningDate: "2026-02-01" },
    ];
    const invoices: RevenueInvoice[] = [
      { id: "i1", status: "ISSUED", grandTotal: 55000, createdAt: "2026-01-10T00:00:00Z" },
    ];
    const result = computePeriodResult({
      periodLabel: "Jan 2026",
      periodType: "MONTHLY",
      periodMonth: 1,
      periodYear: 2026,
      periodStart,
      periodEnd,
      allInvoices: invoices,
      tiers,
      allStaff: lateStaff,
      staffId: "late1",
    });
    assert.equal(result.notEligible, true);
  });

  it("notEligible=true when staffId has joining day > 5", () => {
    const day10Staff: EligibleStaffCandidate[] = [
      { id: "d10", role: "MECHANIC", isActive: true, joiningDate: "2025-06-10" },
    ];
    const invoices: RevenueInvoice[] = [
      { id: "i1", status: "ISSUED", grandTotal: 55000, createdAt: "2026-01-10T00:00:00Z" },
    ];
    const result = computePeriodResult({
      periodLabel: "Jan 2026",
      periodType: "MONTHLY",
      periodMonth: 1,
      periodYear: 2026,
      periodStart,
      periodEnd,
      allInvoices: invoices,
      tiers,
      allStaff: day10Staff,
      staffId: "d10",
    });
    assert.equal(result.notEligible, true);
    assert.equal(result.sharePerStaff, 0);
  });

  it("notEligible=false when staffId joined on day 1 before period end", () => {
    const invoices: RevenueInvoice[] = [
      { id: "i1", status: "ISSUED", grandTotal: 55000, createdAt: "2026-01-10T00:00:00Z" },
    ];
    const result = computePeriodResult({
      periodLabel: "Jan 2026",
      periodType: "MONTHLY",
      periodMonth: 1,
      periodYear: 2026,
      periodStart,
      periodEnd,
      allInvoices: invoices,
      tiers,
      allStaff: staff,
      staffId: "s1",
    });
    assert.equal(result.notEligible, false);
  });

  it("returns achievedTierIndex=null when no tier achieved", () => {
    const invoices: RevenueInvoice[] = [
      { id: "i1", status: "ISSUED", grandTotal: 10000, createdAt: "2026-01-10T00:00:00Z" },
    ];
    const result = computePeriodResult({
      periodLabel: "Jan 2026",
      periodType: "MONTHLY",
      periodMonth: 1,
      periodYear: 2026,
      periodStart,
      periodEnd,
      allInvoices: invoices,
      tiers,
      allStaff: staff,
    });
    assert.equal(result.achievedTierIndex, null);
    assert.equal(result.totalRewardPool, 0);
    assert.equal(result.sharePerStaff, 0);
  });
});

// ---------------------------------------------------------------------------
// Period boundaries
// ---------------------------------------------------------------------------
describe("getPeriodsForYear — period boundaries", () => {
  it("MONTHLY returns 12 periods", () => {
    const periods = getPeriodsForYear(2026, "MONTHLY");
    assert.equal(periods.length, 12);
  });

  it("MONTHLY Jan 2026 starts at 2026-01-01T00:00:00Z", () => {
    const periods = getPeriodsForYear(2026, "MONTHLY");
    assert.equal(periods[0]!.start.toISOString(), "2026-01-01T00:00:00.000Z");
  });

  it("MONTHLY Jan 2026 ends at 2026-01-31T23:59:59.999Z", () => {
    const periods = getPeriodsForYear(2026, "MONTHLY");
    assert.equal(periods[0]!.end.toISOString(), "2026-01-31T23:59:59.999Z");
  });

  it("QUARTERLY returns 4 periods", () => {
    const periods = getPeriodsForYear(2026, "QUARTERLY");
    assert.equal(periods.length, 4);
  });

  it("QUARTERLY Q1 starts Jan 1, ends Mar 31", () => {
    const periods = getPeriodsForYear(2026, "QUARTERLY");
    assert.equal(periods[0]!.start.toISOString(), "2026-01-01T00:00:00.000Z");
    assert.equal(periods[0]!.end.toISOString(), "2026-03-31T23:59:59.999Z");
  });

  it("QUARTERLY Q4 starts Oct 1, ends Dec 31", () => {
    const periods = getPeriodsForYear(2026, "QUARTERLY");
    assert.equal(periods[3]!.start.toISOString(), "2026-10-01T00:00:00.000Z");
    assert.equal(periods[3]!.end.toISOString(), "2026-12-31T23:59:59.999Z");
  });

  it("HALF_YEARLY returns 2 periods", () => {
    const periods = getPeriodsForYear(2026, "HALF_YEARLY");
    assert.equal(periods.length, 2);
  });

  it("HALF_YEARLY H1 starts Jan 1, ends Jun 30", () => {
    const periods = getPeriodsForYear(2026, "HALF_YEARLY");
    assert.equal(periods[0]!.start.toISOString(), "2026-01-01T00:00:00.000Z");
    assert.equal(periods[0]!.end.toISOString(), "2026-06-30T23:59:59.999Z");
  });

  it("HALF_YEARLY H2 starts Jul 1, ends Dec 31", () => {
    const periods = getPeriodsForYear(2026, "HALF_YEARLY");
    assert.equal(periods[1]!.start.toISOString(), "2026-07-01T00:00:00.000Z");
    assert.equal(periods[1]!.end.toISOString(), "2026-12-31T23:59:59.999Z");
  });

  it("YEARLY returns 1 period covering full year", () => {
    const periods = getPeriodsForYear(2026, "YEARLY");
    assert.equal(periods.length, 1);
    assert.equal(periods[0]!.start.toISOString(), "2026-01-01T00:00:00.000Z");
    assert.equal(periods[0]!.end.toISOString(), "2026-12-31T23:59:59.999Z");
  });

  it("Feb 2026 ends on Feb 28 (non-leap year)", () => {
    const periods = getPeriodsForYear(2026, "MONTHLY");
    assert.equal(periods[1]!.end.toISOString(), "2026-02-28T23:59:59.999Z");
  });

  it("Feb 2028 ends on Feb 29 (leap year)", () => {
    const periods = getPeriodsForYear(2028, "MONTHLY");
    assert.equal(periods[1]!.end.toISOString(), "2028-02-29T23:59:59.999Z");
  });
});
