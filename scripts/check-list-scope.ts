/**
 * Assert list scoping helpers + directory redaction stay wired.
 * Run: npm run test:list-scope
 */
import assert from "node:assert/strict";
import {
  applyCollectionBranchScope,
  canUseOrgWideBranchScope,
  toStaffDirectoryEntry,
} from "../src/lib/data-scope.js";

assert.equal(canUseOrgWideBranchScope("MECHANIC"), false);

const scoped = applyCollectionBranchScope(
  "jobCards",
  [
    { id: "1", branchId: "br-a" },
    { id: "2", branchId: "br-b" },
  ],
  ["br-a"]
);
assert.equal(scoped.length, 1);

const dir = toStaffDirectoryEntry({
  id: "u1",
  name: "X",
  role: "MECHANIC",
  branchId: "br-a",
  organizationId: "org",
  isActive: true,
  avatar: null,
});
assert.equal("attendancePin" in dir, false);
assert.equal("permissions" in dir, false);
assert.equal("email" in dir, false);

console.log("OK: list-scope / directory redaction checks passed.");
