import { parseCollectionPayload } from "../src/validations/collection-payloads.js";

// Exact shape the frontend now sends
const payload = {
  companyTargetEnabled: true,
  companyTargetRevenueType: "INVOICES",
  companyTargetPeriod: "MONTHLY",
  companyTargetTiers: [
    { targetAmount: 5000, rewardPercent: 1, role: "MECHANIC" },
    { targetAmount: 10000, rewardPercent: 2, role: "SUPERVISOR" },
    { targetAmount: 30000, rewardPercent: 3, role: "MANAGER" },
    { targetAmount: 40000, rewardPercent: 4, role: "BRANCH_MANAGER" },
  ],
  companyTargetFrequencyTiers: {
    MONTHLY: [{ targetAmount: 5000, rewardPercent: 1, role: "MECHANIC" }],
  },
};

const result = parseCollectionPayload("staffRewardSettings", payload) as typeof payload;

console.log("companyTargetTiers:", JSON.stringify(result.companyTargetTiers, null, 2));
console.log("companyTargetFrequencyTiers:", JSON.stringify(result.companyTargetFrequencyTiers, null, 2));

const rolesA = result.companyTargetTiers.map((t: any) => t.role);
const expectedA = ["MECHANIC", "SUPERVISOR", "MANAGER", "BRANCH_MANAGER"];
const okA = JSON.stringify(rolesA) === JSON.stringify(expectedA);

const rolesB = result.companyTargetFrequencyTiers.MONTHLY.map((t: any) => t.role);
const okB = JSON.stringify(rolesB) === JSON.stringify(["MECHANIC"]);

console.log(okA && okB ? "PASS — role field round-trips intact for both companyTargetTiers and companyTargetFrequencyTiers" : "FAIL");
