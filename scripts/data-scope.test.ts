import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyCollectionBranchScope,
  canUseOrgWideBranchScope,
  extractBranding,
  filterNestedSingletonPayload,
  filterPayloadsByBranch,
  intersectQueryBranchId,
  isPayloadInBranchScope,
  payloadBranchId,
  toStaffDirectoryEntry,
  type BranchScope,
} from "../src/lib/data-scope.ts";

describe("data-scope roles", () => {
  it("treats SUPER_ADMIN ADMIN MANAGER BRANCH_MANAGER as org-wide", () => {
    assert.equal(canUseOrgWideBranchScope("SUPER_ADMIN"), true);
    assert.equal(canUseOrgWideBranchScope("ADMIN"), true);
    assert.equal(canUseOrgWideBranchScope("MANAGER"), true);
    assert.equal(canUseOrgWideBranchScope("BRANCH_MANAGER"), true);
    assert.equal(canUseOrgWideBranchScope("RECEPTIONIST"), false);
    assert.equal(canUseOrgWideBranchScope("MECHANIC"), false);
  });
});

describe("data-scope payload branch filter", () => {
  it("reads branchId from payloads", () => {
    assert.equal(payloadBranchId({ branchId: "br-a" }), "br-a");
    assert.equal(payloadBranchId({}), undefined);
    assert.equal(payloadBranchId(null), undefined);
  });

  it("keeps all items when allowedBranchIds is null", () => {
    const items = [{ id: "1", branchId: "br-a" }, { id: "2", branchId: "br-b" }];
    assert.deepEqual(filterPayloadsByBranch(items, null), items);
  });

  it("keeps matching branch and items without branchId", () => {
    const items = [
      { id: "1", branchId: "br-a" },
      { id: "2", branchId: "br-b" },
      { id: "3" },
    ];
    assert.deepEqual(filterPayloadsByBranch(items, ["br-a"]), [
      { id: "1", branchId: "br-a" },
      { id: "3" },
    ]);
  });

  it("isPayloadInBranchScope rejects foreign branches", () => {
    assert.equal(isPayloadInBranchScope({ branchId: "br-b" }, ["br-a"]), false);
    assert.equal(isPayloadInBranchScope({ branchId: "br-a" }, ["br-a"]), true);
  });

  it("keeps stock transfers that involve an allowed branch", () => {
    assert.equal(
      isPayloadInBranchScope({ fromBranchId: "br-a", toBranchId: "br-b" }, ["br-a"]),
      true
    );
    assert.equal(
      isPayloadInBranchScope({ fromBranchId: "br-b", toBranchId: "br-c" }, ["br-a"]),
      false
    );
  });
});

describe("data-scope nested singletons", () => {
  it("filters payroll nested arrays by branch", () => {
    const payload = {
      salaryStructures: [{ id: "s1", branchId: "br-a" }, { id: "s2", branchId: "br-b" }],
      payrollRecords: [{ id: "p1", branchId: "br-a" }],
      salaryAdvances: [],
      salaryAdvanceRecoveries: [{ id: "r1", branchId: "br-b" }],
    };
    const filtered = filterNestedSingletonPayload("payroll", payload, ["br-a"]) as typeof payload;
    assert.equal(filtered.salaryStructures.length, 1);
    assert.equal(filtered.salaryStructures[0]!.id, "s1");
    assert.equal(filtered.payrollRecords.length, 1);
    assert.equal(filtered.salaryAdvanceRecoveries.length, 0);
  });

  it("filters cashBank nested arrays by branch", () => {
    const payload = {
      accounts: [{ id: "a1", branchId: "br-a" }, { id: "a2", branchId: "br-b" }],
      transactions: [{ id: "t1", branchId: "br-b" }],
    };
    const filtered = filterNestedSingletonPayload("cashBank", payload, ["br-a"]) as typeof payload;
    assert.equal(filtered.accounts.length, 1);
    assert.equal(filtered.transactions.length, 0);
  });

  it("applyCollectionBranchScope filters array collections", () => {
    const items = [{ id: "j1", branchId: "br-a" }, { id: "j2", branchId: "br-b" }];
    const out = applyCollectionBranchScope("jobCards", items, ["br-a"]);
    assert.equal(out.length, 1);
  });

  it("applyCollectionBranchScope leaves non-nested singletons alone", () => {
    const items = [{ businessName: "X", bankAccountNumber: "secret" }];
    const out = applyCollectionBranchScope("appSettings", items, ["br-a"]);
    assert.deepEqual(out, items);
  });
});

describe("data-scope branding + directory", () => {
  it("extractBranding keeps gstRegistrationStatus but drops bank and gstin", () => {
    const branding = extractBranding({
      businessName: "Studio",
      brandPrimary: "#111111",
      bankAccountNumber: "secret",
      gstin: "secret",
      companyPan: "secret",
      gstRegistrationStatus: "NOT_REGISTERED",
    });
    assert.equal(branding.businessName, "Studio");
    assert.equal(branding.brandPrimary, "#111111");
    assert.equal(branding.gstRegistrationStatus, "NOT_REGISTERED");
    assert.equal("bankAccountNumber" in branding, false);
    assert.equal("gstin" in branding, false);
  });

  it("toStaffDirectoryEntry strips sensitive fields", () => {
    const entry = toStaffDirectoryEntry({
      id: "u1",
      name: "Ada",
      role: "MECHANIC",
      branchId: "br-a",
      organizationId: "org-1",
      isActive: true,
      avatar: null,
    });
    assert.deepEqual(entry, {
      id: "u1",
      name: "Ada",
      role: "MECHANIC",
      branchId: "br-a",
      organizationId: "org-1",
      isActive: true,
      avatar: undefined,
    });
    assert.equal("permissions" in entry, false);
    assert.equal("attendancePin" in entry, false);
  });
});

describe("data-scope query branch intersect", () => {
  it("narrows org-wide scope to a single query branch", () => {
    const scope: BranchScope = { organizationId: "org-1", allowedBranchIds: null };
    assert.deepEqual(intersectQueryBranchId(scope, "br-a"), ["br-a"]);
  });

  it("rejects query branch outside allowed set", () => {
    const scope: BranchScope = { organizationId: "org-1", allowedBranchIds: ["br-a"] };
    assert.deepEqual(intersectQueryBranchId(scope, "br-b"), []);
  });
});
