#!/usr/bin/env tsx
/**
 * Ensure YOUR SaaS vendor login exists (PLATFORM_OWNER).
 *
 * Free Render (no Shell): set PLATFORM_OWNER_* env, deploy — API boot creates the user.
 * Or run locally against production DB:
 *   DATABASE_URL="postgresql://…" npm run saas:ensure-platform-owner
 */
import "dotenv/config";
import { ensurePlatformOwner } from "../src/services/ensure-platform-owner.service.js";
import { prisma } from "../src/lib/prisma.js";

async function main() {
  const result = await ensurePlatformOwner({ syncPassword: true });
  console.log(`PLATFORM_OWNER ${result.action}: ${result.email}`);
  console.log("Login at /login → /saas-admin/organizations");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
