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
  filterEligibleStaffForRole,
  isStaffEligible,
  calcSharePerStaff,
  computeRoleBreakdown,
  computePeriodResult,
  normalizeRoleKey,
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
// selectAchievedTier (generic utility — no longer used for "highest wins";
// each tier is evaluated independently by role in computeRoleBreakdown)
// ---------------------------------------------------------------------------
describe("selectAchievedTier", () => {
  const tiers: CompanyTargetTier[] = [
    { targetAmount: 50000, rewardPercent: 5, role: "MECHANIC" },
    { targetAmount: 75000, rewardPercent: 7, role: "SUPERVISOR" },
    { targetAmount: 90000, rewardPercent: 8, role: "MANAGER" },
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
// normalizeRoleKey
// ---------------------------------------------------------------------------
describe("normalizeRoleKey", () => {
  it("uppercases and normalizes spaces/hyphens to underscores", () => {
    assert.equal(normalizeRoleKey("Branch Manager"), "BRANCH_MANAGER");
    assert.equal(normalizeRoleKey("branch-manager"), "BRANCH_MANAGER");
    assert.equal(normalizeRoleKey("BRANCH_MANAGER"), "BRANCH_MANAGER");
  });

  it("normalizes simple single-word roles", () => {
    assert.equal(normalizeRoleKey("Mechanic"), "MECHANIC");
    assert.equal(normalizeRoleKey("supervisor"), "SUPERVISOR");
  });

  it("trims surrounding whitespace", () => {
    assert.equal(normalizeRoleKey("  Manager  "), "MANAGER");
  });
});

// ---------------------------------------------------------------------------
// filterEligibleStaffForRole
// ---------------------------------------------------------------------------
describe("filterEligibleStaffForRole", () => {
  const periodEnd = new Date(Date.UTC(2026, 0, 31, 23, 59, 59, 999));

  const staff: EligibleStaffCandidate[] = [
    { id: "rahul", role: "MECHANIC", isActive: true, joiningDate: "2025-01-01" },
    { id: "sneha", role: "SUPERVISOR", isActive: true, joiningDate: "2025-01-02" },
    { id: "manager1", role: "MANAGER", isActive: true, joiningDate: "2025-01-03" },
    { id: "vikram", role: "BRANCH_MANAGER", isActive: true, joiningDate: "2025-01-04" },
    { id: "other-mechanic", role: "MECHANIC", isActive: true, joiningDate: "2025-01-05" },
  ];

  it("only returns staff matching the given role (case/spacing-insensitive)", () => {
    const mechanics = filterEligibleStaffForRole(staff, periodEnd, "Mechanic");
    assert.deepEqual(mechanics.map((s) => s.id).sort(), ["other-mechanic", "rahul"]);
  });

  it("matches 'Branch Manager' label to stored 'BRANCH_MANAGER' role", () => {
    const bms = filterEligibleStaffForRole(staff, periodEnd, "Branch Manager");
    assert.deepEqual(bms.map((s) => s.id), ["vikram"]);
  });

  it("matches Supervisor role", () => {
    const supervisors = filterEligibleStaffForRole(staff, periodEnd, "Supervisor");
    assert.deepEqual(supervisors.map((s) => s.id), ["sneha"]);
  });

  it("returns empty array when no staff match the role", () => {
    const receptionists = filterEligibleStaffForRole(staff, periodEnd, "Receptionist");
    assert.deepEqual(receptionists, []);
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
// computeRoleBreakdown — independent per-role tiers (canonical ticket scenario)
//
// Rahul/Mechanic → Tier 1 (5,000 @ 1%), Sneha/Supervisor → Tier 2 (10,000 @ 2%),
// (Manager) → Tier 3 (30,000 @ 3%), Vikram/Branch Manager → Tier 4 (40,000 @ 4%).
// Each role's tier is independent: whichever tiers are achieved by revenue each
// contribute their own pool, split only among staff of that tier's role. There
// is no single "highest tier wins" winner.
// ---------------------------------------------------------------------------
describe("computeRoleBreakdown — independent per-role tiers", () => {
  const ticketTiers: CompanyTargetTier[] = [
    { targetAmount: 5000, rewardPercent: 1, role: "Mechanic" },
    { targetAmount: 10000, rewardPercent: 2, role: "Supervisor" },
    { targetAmount: 30000, rewardPercent: 3, role: "Manager" },
    { targetAmount: 40000, rewardPercent: 4, role: "Branch Manager" },
  ];

  const periodEnd = new Date(Date.UTC(2026, 0, 31, 23, 59, 59, 999));

  const ticketStaff: EligibleStaffCandidate[] = [
    { id: "rahul", role: "MECHANIC", isActive: true, joiningDate: "2025-01-01" },
    { id: "sneha", role: "SUPERVISOR", isActive: true, joiningDate: "2025-01-02" },
    { id: "manager1", role: "MANAGER", isActive: true, joiningDate: "2025-01-03" },
    { id: "vikram", role: "BRANCH_MANAGER", isActive: true, joiningDate: "2025-01-04" },
  ];

  it("when revenue clears all 4 targets, all 4 tiers are achieved simultaneously — no single winner", () => {
    const revenue = 45000; // >= 5000, 10000, 30000, and 40000
    const breakdown = computeRoleBreakdown(revenue, ticketTiers, ticketStaff, periodEnd);

    assert.equal(breakdown.length, 4);
    assert.ok(breakdown.every((r) => r.achieved === true));
  });

  it("Rahul (Mechanic, Tier 1): pool = revenue*1%, share = pool / mechanic count", () => {
    const revenue = 45000;
    const breakdown = computeRoleBreakdown(revenue, ticketTiers, ticketStaff, periodEnd);
    const mechanicRow = breakdown.find((r) => r.role === "Mechanic")!;

    assert.equal(mechanicRow.achieved, true);
    assert.equal(mechanicRow.pool, round2((45000 * 1) / 100)); // 450
    assert.equal(mechanicRow.eligibleStaffCount, 1);
    assert.equal(mechanicRow.sharePerStaff, 450);
  });

  it("Sneha (Supervisor, Tier 2): pool = revenue*2%, share = pool / supervisor count", () => {
    const revenue = 45000;
    const breakdown = computeRoleBreakdown(revenue, ticketTiers, ticketStaff, periodEnd);
    const supervisorRow = breakdown.find((r) => r.role === "Supervisor")!;

    assert.equal(supervisorRow.achieved, true);
    assert.equal(supervisorRow.pool, round2((45000 * 2) / 100)); // 900
    assert.equal(supervisorRow.eligibleStaffCount, 1);
    assert.equal(supervisorRow.sharePerStaff, 900);
  });

  it("Manager (Tier 3): pool = revenue*3%, share = pool / manager count", () => {
    const revenue = 45000;
    const breakdown = computeRoleBreakdown(revenue, ticketTiers, ticketStaff, periodEnd);
    const managerRow = breakdown.find((r) => r.role === "Manager")!;

    assert.equal(managerRow.achieved, true);
    assert.equal(managerRow.pool, round2((45000 * 3) / 100)); // 1350
    assert.equal(managerRow.eligibleStaffCount, 1);
    assert.equal(managerRow.sharePerStaff, 1350);
  });

  it("Vikram (Branch Manager, Tier 4): pool = revenue*4%, share = pool / BM count", () => {
    const revenue = 45000;
    const breakdown = computeRoleBreakdown(revenue, ticketTiers, ticketStaff, periodEnd);
    const bmRow = breakdown.find((r) => r.role === "Branch Manager")!;

    assert.equal(bmRow.achieved, true);
    assert.equal(bmRow.pool, round2((45000 * 4) / 100)); // 1800
    assert.equal(bmRow.eligibleStaffCount, 1);
    assert.equal(bmRow.sharePerStaff, 1800);
  });

  it("mid-range revenue achieves only the lower tiers — higher tiers are NOT achieved (independent, not highest-wins)", () => {
    const revenue = 15000; // clears Tier 1 (5000) and Tier 2 (10000), not Tier 3 (30000) or Tier 4 (40000)
    const breakdown = computeRoleBreakdown(revenue, ticketTiers, ticketStaff, periodEnd);

    const mechanicRow = breakdown.find((r) => r.role === "Mechanic")!;
    const supervisorRow = breakdown.find((r) => r.role === "Supervisor")!;
    const managerRow = breakdown.find((r) => r.role === "Manager")!;
    const bmRow = breakdown.find((r) => r.role === "Branch Manager")!;

    assert.equal(mechanicRow.achieved, true);
    assert.equal(supervisorRow.achieved, true);
    assert.equal(managerRow.achieved, false);
    assert.equal(bmRow.achieved, false);

    // Not-achieved tiers pay out nothing, regardless of eligible staff existing.
    assert.equal(managerRow.pool, 0);
    assert.equal(managerRow.sharePerStaff, 0);
    assert.equal(bmRow.pool, 0);
    assert.equal(bmRow.sharePerStaff, 0);

    // Achieved tiers still pay their own independent pool.
    assert.equal(mechanicRow.sharePerStaff, round2((15000 * 1) / 100));
    assert.equal(supervisorRow.sharePerStaff, round2((15000 * 2) / 100));
  });

  it("multiple staff in the same role split that role's pool", () => {
    const staffWithTwoMechanics: EligibleStaffCandidate[] = [
      ...ticketStaff,
      { id: "rahul2", role: "MECHANIC", isActive: true, joiningDate: "2025-01-05" },
    ];
    const revenue = 45000;
    const breakdown = computeRoleBreakdown(revenue, ticketTiers, staffWithTwoMechanics, periodEnd);
    const mechanicRow = breakdown.find((r) => r.role === "Mechanic")!;

    assert.equal(mechanicRow.eligibleStaffCount, 2);
    assert.equal(mechanicRow.sharePerStaff, round2(450 / 2)); // 225 each
  });

  it("zero eligible staff for an achieved tier's role → sharePerStaff 0, no divide-by-zero", () => {
    const staffWithoutManager = ticketStaff.filter((s) => s.id !== "manager1");
    const revenue = 45000;
    const breakdown = computeRoleBreakdown(revenue, ticketTiers, staffWithoutManager, periodEnd);
    const managerRow = breakdown.find((r) => r.role === "Manager")!;

    assert.equal(managerRow.achieved, true);
    assert.equal(managerRow.eligibleStaffCount, 0);
    assert.equal(managerRow.sharePerStaff, 0);
  });

  it("other roles are unaffected by another role's tier not being achieved", () => {
    const revenue = 5000; // only Tier 1 (Mechanic) is achieved
    const breakdown = computeRoleBreakdown(revenue, ticketTiers, ticketStaff, periodEnd);

    const mechanicRow = breakdown.find((r) => r.role === "Mechanic")!;
    assert.equal(mechanicRow.achieved, true);
    assert.equal(mechanicRow.sharePerStaff, round2((5000 * 1) / 100));

    for (const role of ["Supervisor", "Manager", "Branch Manager"]) {
      const row = breakdown.find((r) => r.role === role)!;
      assert.equal(row.achieved, false);
      assert.equal(row.sharePerStaff, 0);
    }
  });
});

// ---------------------------------------------------------------------------
// computePeriodResult — staff-specific fields, per-role model
// ---------------------------------------------------------------------------
describe("computePeriodResult — staff-specific fields (per-role model)", () => {
  const ticketTiers: CompanyTargetTier[] = [
    { targetAmount: 5000, rewardPercent: 1, role: "Mechanic" },
    { targetAmount: 10000, rewardPercent: 2, role: "Supervisor" },
    { targetAmount: 30000, rewardPercent: 3, role: "Manager" },
    { targetAmount: 40000, rewardPercent: 4, role: "Branch Manager" },
  ];

  const periodStart = new Date(Date.UTC(2026, 0, 1));
  const periodEnd = new Date(Date.UTC(2026, 0, 31, 23, 59, 59, 999));

  const ticketStaff: EligibleStaffCandidate[] = [
    { id: "rahul", role: "MECHANIC", isActive: true, joiningDate: "2025-01-01" },
    { id: "sneha", role: "SUPERVISOR", isActive: true, joiningDate: "2025-01-02" },
    { id: "manager1", role: "MANAGER", isActive: true, joiningDate: "2025-01-03" },
    { id: "vikram", role: "BRANCH_MANAGER", isActive: true, joiningDate: "2025-01-04" },
  ];

  const invoices45k: RevenueInvoice[] = [
    { id: "i1", status: "ISSUED", grandTotal: 45000, createdAt: "2026-01-15T00:00:00Z" },
  ];

  it("Sneha (Supervisor) gets her own tier's share, independent of other roles' tiers", () => {
    const result = computePeriodResult({
      periodLabel: "Jan 2026",
      periodType: "MONTHLY",
      periodMonth: 1,
      periodYear: 2026,
      periodStart,
      periodEnd,
      allInvoices: invoices45k,
      tiers: ticketTiers,
      allStaff: ticketStaff,
      staffId: "sneha",
    });

    assert.equal(result.revenue, 45000);
    assert.equal(result.staffRole, "SUPERVISOR");
    assert.equal(result.targetAmount, 10000);
    assert.equal(result.rewardPercent, 2);
    assert.equal(result.eligibleStaffCount, 1);
    assert.equal(result.sharePerStaff, 900); // 45000 * 2%
    assert.equal(result.notEligible, false);
    // totalRewardPool is the sum across ALL achieved tiers/roles, not just Sneha's.
    assert.equal(result.totalRewardPool, round2(450 + 900 + 1350 + 1800));
  });

  it("Vikram (Branch Manager) gets his own tier's share", () => {
    const result = computePeriodResult({
      periodLabel: "Jan 2026",
      periodType: "MONTHLY",
      periodMonth: 1,
      periodYear: 2026,
      periodStart,
      periodEnd,
      allInvoices: invoices45k,
      tiers: ticketTiers,
      allStaff: ticketStaff,
      staffId: "vikram",
    });

    assert.equal(result.staffRole, "BRANCH_MANAGER");
    assert.equal(result.targetAmount, 40000);
    assert.equal(result.rewardPercent, 4);
    assert.equal(result.sharePerStaff, 1800); // 45000 * 4%
  });

  it("a role whose tier is NOT achieved gets sharePerStaff 0 even though other tiers were achieved", () => {
    const lowRevenue: RevenueInvoice[] = [
      { id: "i1", status: "ISSUED", grandTotal: 15000, createdAt: "2026-01-15T00:00:00Z" },
    ];
    const result = computePeriodResult({
      periodLabel: "Jan 2026",
      periodType: "MONTHLY",
      periodMonth: 1,
      periodYear: 2026,
      periodStart,
      periodEnd,
      allInvoices: lowRevenue,
      tiers: ticketTiers,
      allStaff: ticketStaff,
      staffId: "vikram", // Branch Manager tier (40000) not achieved at revenue=15000
    });

    assert.equal(result.achievedTierIndex, 3);
    assert.equal(result.sharePerStaff, 0);
  });

  it("staffId with a role that has no configured tier gets null tier fields and 0 share", () => {
    const staffWithReceptionist: EligibleStaffCandidate[] = [
      ...ticketStaff,
      { id: "recep1", role: "RECEPTIONIST", isActive: true, joiningDate: "2025-01-05" },
    ];
    const result = computePeriodResult({
      periodLabel: "Jan 2026",
      periodType: "MONTHLY",
      periodMonth: 1,
      periodYear: 2026,
      periodStart,
      periodEnd,
      allInvoices: invoices45k,
      tiers: ticketTiers,
      allStaff: staffWithReceptionist,
      staffId: "recep1",
    });

    assert.equal(result.staffRole, "RECEPTIONIST");
    assert.equal(result.achievedTierIndex, null);
    assert.equal(result.targetAmount, null);
    assert.equal(result.rewardPercent, null);
    assert.equal(result.sharePerStaff, 0);
  });

  it("notEligible=true when staffId joined after period end", () => {
    const lateStaff: EligibleStaffCandidate[] = [
      ...ticketStaff,
      { id: "late1", role: "MECHANIC", isActive: true, joiningDate: "2026-02-01" },
    ];
    const result = computePeriodResult({
      periodLabel: "Jan 2026",
      periodType: "MONTHLY",
      periodMonth: 1,
      periodYear: 2026,
      periodStart,
      periodEnd,
      allInvoices: invoices45k,
      tiers: ticketTiers,
      allStaff: lateStaff,
      staffId: "late1",
    });
    assert.equal(result.notEligible, true);
    assert.equal(result.sharePerStaff, 0);
  });

  it("notEligible=true when staffId has joining day > 5", () => {
    const day10Staff: EligibleStaffCandidate[] = [
      ...ticketStaff,
      { id: "d10", role: "MECHANIC", isActive: true, joiningDate: "2025-06-10" },
    ];
    const result = computePeriodResult({
      periodLabel: "Jan 2026",
      periodType: "MONTHLY",
      periodMonth: 1,
      periodYear: 2026,
      periodStart,
      periodEnd,
      allInvoices: invoices45k,
      tiers: ticketTiers,
      allStaff: day10Staff,
      staffId: "d10",
    });
    assert.equal(result.notEligible, true);
    assert.equal(result.sharePerStaff, 0);
  });

  it("notEligible=false and correct share when staffId joined on day 1 before period end", () => {
    const result = computePeriodResult({
      periodLabel: "Jan 2026",
      periodType: "MONTHLY",
      periodMonth: 1,
      periodYear: 2026,
      periodStart,
      periodEnd,
      allInvoices: invoices45k,
      tiers: ticketTiers,
      allStaff: ticketStaff,
      staffId: "rahul",
    });
    assert.equal(result.notEligible, false);
    assert.equal(result.sharePerStaff, 450);
  });

  it("unknown staffId returns notEligible=true", () => {
    const result = computePeriodResult({
      periodLabel: "Jan 2026",
      periodType: "MONTHLY",
      periodMonth: 1,
      periodYear: 2026,
      periodStart,
      periodEnd,
      allInvoices: invoices45k,
      tiers: ticketTiers,
      allStaff: ticketStaff,
      staffId: "does-not-exist",
    });
    assert.equal(result.notEligible, true);
    assert.equal(result.sharePerStaff, 0);
  });

  it("final combined total: individualNet + staff's own company share", () => {
    const result = computePeriodResult({
      periodLabel: "Jan 2026",
      periodType: "MONTHLY",
      periodMonth: 1,
      periodYear: 2026,
      periodStart,
      periodEnd,
      allInvoices: invoices45k,
      tiers: ticketTiers,
      allStaff: ticketStaff,
      staffId: "sneha",
    });
    const simulatedIndividualNet = 1000;
    assert.equal(
      Math.round((simulatedIndividualNet + result.sharePerStaff) * 100) / 100,
      1900 // 1000 + 900
    );
  });

  it("no staffId provided → staff-specific fields default to null/0, roleBreakdown still populated", () => {
    const result = computePeriodResult({
      periodLabel: "Jan 2026",
      periodType: "MONTHLY",
      periodMonth: 1,
      periodYear: 2026,
      periodStart,
      periodEnd,
      allInvoices: invoices45k,
      tiers: ticketTiers,
      allStaff: ticketStaff,
    });
    assert.equal(result.staffRole, null);
    assert.equal(result.achievedTierIndex, null);
    assert.equal(result.sharePerStaff, 0);
    assert.equal(result.notEligible, false);
    assert.equal(result.roleBreakdown.length, 4);
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
