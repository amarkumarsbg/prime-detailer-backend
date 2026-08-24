#!/usr/bin/env tsx
/**
 * Emergency / automation: set maxBranchesOverride for an organization.
 * Prefers PLATFORM_ADMIN_API_KEY; day-to-day use /saas-admin instead.
 *
 * Usage:
 *   npx tsx scripts/saas-set-branch-limit.ts --org org-default --max 3
 *   npx tsx scripts/saas-set-branch-limit.ts --org org-default --max null
 */
import "dotenv/config";

const args = process.argv.slice(2);
function flag(name: string): string | undefined {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  return args[i + 1];
}

const orgId = flag("--org") ?? "org-default";
const maxRaw = flag("--max");
const baseUrl = (flag("--base") ?? process.env.API_BASE_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");
const key = process.env.PLATFORM_ADMIN_API_KEY?.trim();

if (maxRaw === undefined) {
  console.error("Usage: tsx scripts/saas-set-branch-limit.ts --org <id> --max <number|null>");
  process.exit(1);
}

if (!key) {
  console.error("PLATFORM_ADMIN_API_KEY is required in the environment.");
  process.exit(1);
}

const maxBranchesOverride = maxRaw === "null" || maxRaw === "unlimited" ? null : Number(maxRaw);
if (maxBranchesOverride !== null && (!Number.isFinite(maxBranchesOverride) || maxBranchesOverride < 0)) {
  console.error("--max must be a non-negative integer or null");
  process.exit(1);
}

const res = await fetch(`${baseUrl}/api/platform/organizations/${encodeURIComponent(orgId)}/subscription`, {
  method: "PATCH",
  headers: {
    "Content-Type": "application/json",
    "X-Platform-Admin-Key": key,
  },
  body: JSON.stringify({ maxBranchesOverride }),
});

const body = await res.json();
if (!res.ok) {
  console.error("Failed:", res.status, body);
  process.exit(1);
}
console.log(JSON.stringify(body.data, null, 2));
