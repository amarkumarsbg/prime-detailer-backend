#!/usr/bin/env tsx
/**
 * Reset all data for one organisation — except vehicleCatalog and appSettings.
 *
 * Usage (run from the backend/ folder):
 *
 *   # Dry-run first (shows what would be deleted, touches nothing):
 *   DATABASE_URL="postgresql://…" npx tsx scripts/reset-org-data.ts --dry-run
 *
 *   # Live run:
 *   DATABASE_URL="postgresql://…" npx tsx scripts/reset-org-data.ts
 *
 * The script will list all organisations and ask you to pick one before it
 * deletes anything.
 */
import "dotenv/config";
import * as readline from "readline";
import { prisma } from "../src/lib/prisma.js";

const DRY_RUN = process.argv.includes("--dry-run");
const CONFIRMED = process.argv.includes("--confirm"); // skip interactive YES prompt

// Collections to KEEP (everything else is deleted)
const KEEP_COLLECTIONS = new Set(["vehicleCatalog", "appSettings"]);

async function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log(DRY_RUN ? "\n[DRY RUN — nothing will be deleted]\n" : "\n[LIVE RUN]\n");

  // List all orgs so user can confirm the right one
  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  if (orgs.length === 0) {
    console.error("No organisations found in this database.");
    process.exit(1);
  }

  console.log("Organisations in this database:");
  orgs.forEach((o, i) => console.log(`  ${i + 1}. ${o.name}  (${o.id})`));

  const answer = await ask("\nEnter the number of the org to reset: ");
  const idx = parseInt(answer, 10) - 1;

  if (isNaN(idx) || idx < 0 || idx >= orgs.length) {
    console.error("Invalid selection. Aborting.");
    process.exit(1);
  }

  const org = orgs[idx];
  console.log(`\nSelected: ${org.name} (${org.id})`);

  if (!DRY_RUN) {
    if (!CONFIRMED) {
      const confirm = await ask(
        `\nType YES to permanently delete all data for "${org.name}" (except vehicleCatalog & appSettings): `
      );
      if (confirm !== "YES") {
        console.log("Aborted.");
        process.exit(0);
      }
    } else {
      console.log("\n--confirm flag set. Skipping prompt and proceeding with delete.");
    }
  }

  // ── AppJsonRow ────────────────────────────────────────────────────────────
  const allRows = await prisma.appJsonRow.findMany({
    where: { organizationId: org.id },
    select: { collection: true, entityId: true },
  });

  const toDelete = allRows.filter((r) => !KEEP_COLLECTIONS.has(r.collection));
  const byCollection: Record<string, number> = {};
  for (const r of toDelete) {
    byCollection[r.collection] = (byCollection[r.collection] ?? 0) + 1;
  }

  console.log("\nAppJsonRow rows that will be deleted:");
  for (const [col, count] of Object.entries(byCollection).sort()) {
    console.log(`  ${col}: ${count} row(s)`);
  }
  console.log(`  TOTAL: ${toDelete.length} row(s)`);
  console.log("\nAppJsonRow rows that will be KEPT:", [...KEEP_COLLECTIONS].join(", "));

  // ── Relational tables ─────────────────────────────────────────────────────
  const customerIds = (
    await prisma.customer.findMany({
      where: { organizationId: org.id },
      select: { id: true },
    })
  ).map((c) => c.id);

  const partyIds = (
    await prisma.party.findMany({
      where: { organizationId: org.id },
      select: { id: true },
    })
  ).map((p) => p.id);

  console.log(`\nRelational rows that will be deleted:`);
  console.log(`  Customer: ${customerIds.length}`);
  console.log(`  Vehicle (via customers): counted below`);
  console.log(`  Party + children: ${partyIds.length}`);

  const vehicleCount = await prisma.vehicle.count({
    where: { customerId: { in: customerIds } },
  });
  console.log(`  Vehicle: ${vehicleCount}`);

  const orgBranches = await prisma.branch.findMany({
    where: { organizationId: org.id },
    select: { id: true },
  });
  const branchIds = orgBranches.map((b) => b.id);
  const attendanceCount = await prisma.attendance.count({
    where: { branchId: { in: branchIds } },
  });
  console.log(`  Attendance: ${attendanceCount}`);

  const allUsers = await prisma.user.findMany({
    where: { organizationId: org.id },
    select: { id: true, name: true, role: true, branchId: true },
  });
  const KEEP_ROLES = new Set(["PLATFORM_OWNER", "SUPER_ADMIN"]);
  const keepUsers = allUsers.filter((u) => KEEP_ROLES.has(u.role));
  const deleteUsers = allUsers.filter((u) => !KEEP_ROLES.has(u.role));
  console.log(`  Staff users (to delete): ${deleteUsers.length}`);
  console.log(`  Users kept: ${keepUsers.map((u) => `${u.name} (${u.role})`).join(", ")}`);
  console.log(`  Extra branches (to delete): ${branchIds.length - 1} (primary branch kept)`);

  if (DRY_RUN) {
    console.log("\n[DRY RUN complete — no changes made]");
    await prisma.$disconnect();
    return;
  }

  // ── Execute deletes ───────────────────────────────────────────────────────
  console.log("\nDeleting…");

  const KEEP_ROLES = new Set(["PLATFORM_OWNER", "SUPER_ADMIN"]);
  const allUsers = await prisma.user.findMany({
    where: { organizationId: org.id },
    select: { id: true, name: true, role: true, branchId: true },
  });
  const keepUsers = allUsers.filter((u) => KEEP_ROLES.has(u.role));
  const deleteUserIds = allUsers.filter((u) => !KEEP_ROLES.has(u.role)).map((u) => u.id);
  const orgBranches2 = await prisma.branch.findMany({
    where: { organizationId: org.id },
    select: { id: true, name: true },
  });
  const superAdmin = keepUsers.find((u) => u.role === "SUPER_ADMIN");
  const primaryBranchId = superAdmin?.branchId ?? orgBranches2[0]?.id;

  // AppJsonRow
  const deletedRows = await prisma.appJsonRow.deleteMany({
    where: {
      organizationId: org.id,
      collection: { notIn: [...KEEP_COLLECTIONS] },
    },
  });
  console.log(`  AppJsonRow deleted: ${deletedRows.count}`);

  // Party children (cascade won't fire via Prisma deleteMany, do it manually)
  if (partyIds.length > 0) {
    await prisma.partyCustomField.deleteMany({ where: { partyId: { in: partyIds } } });
    await prisma.partyBankAccount.deleteMany({ where: { partyId: { in: partyIds } } });
    await prisma.partyShippingAddress.deleteMany({ where: { partyId: { in: partyIds } } });
    await prisma.partyHidden.deleteMany({ where: { partyId: { in: partyIds } } });
    const deletedParties = await prisma.party.deleteMany({ where: { organizationId: org.id } });
    console.log(`  Party deleted: ${deletedParties.count}`);
  }

  // Vehicles then Customers
  if (customerIds.length > 0) {
    const deletedVehicles = await prisma.vehicle.deleteMany({
      where: { customerId: { in: customerIds } },
    });
    console.log(`  Vehicle deleted: ${deletedVehicles.count}`);
    const deletedCustomers = await prisma.customer.deleteMany({
      where: { organizationId: org.id },
    });
    console.log(`  Customer deleted: ${deletedCustomers.count}`);
  }

  // Attendance
  const deletedAtt = await prisma.attendance.deleteMany({
    where: { branchId: { in: branchIds } },
  });
  console.log(`  Attendance deleted: ${deletedAtt.count}`);

  // Staff users
  if (deleteUserIds.length > 0) {
    const du = await prisma.user.deleteMany({ where: { id: { in: deleteUserIds } } });
    console.log(`  Staff users deleted: ${du.count}`);
  }

  // Move kept users to primary branch, then delete extra branches
  for (const u of keepUsers) {
    if (u.branchId !== primaryBranchId && primaryBranchId) {
      await prisma.user.update({ where: { id: u.id }, data: { branchId: primaryBranchId } });
    }
  }
  const extraBranches = orgBranches2.filter((b) => b.id !== primaryBranchId).map((b) => b.id);
  if (extraBranches.length > 0) {
    const db2 = await prisma.branch.deleteMany({ where: { id: { in: extraBranches } } });
    console.log(`  Extra branches deleted: ${db2.count}`);
  }
  const primaryBranch = orgBranches2.find((b) => b.id === primaryBranchId);
  console.log(`  Branch kept: ${primaryBranch?.name ?? primaryBranchId}`);

  console.log(`\nDone. Data for "${org.name}" has been reset.`);
  console.log("Users, Branches, and Organisation record are untouched.");
  console.log("Have the user refresh their browser to clear cached state.");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
