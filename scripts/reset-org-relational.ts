#!/usr/bin/env tsx
/**
 * Delete all staff users (non-admin), extra branches, parties, customers,
 * vehicles, and attendance for org-default.
 *
 * KEEPS:
 *   - PLATFORM_OWNER and SUPER_ADMIN users (login access)
 *   - The branch that the SUPER_ADMIN is assigned to (primary branch)
 *
 * Usage:
 *   DATABASE_URL="..." npx tsx scripts/reset-org-relational.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";

const ORG_ID = "org-default";
const KEEP_ROLES = new Set(["PLATFORM_OWNER", "SUPER_ADMIN"]);

async function main() {
  // ── Parties ───────────────────────────────────────────────────────────────
  const partyIds = (
    await prisma.party.findMany({ where: { organizationId: ORG_ID }, select: { id: true } })
  ).map((p) => p.id);

  if (partyIds.length > 0) {
    await prisma.partyCustomField.deleteMany({ where: { partyId: { in: partyIds } } });
    await prisma.partyBankAccount.deleteMany({ where: { partyId: { in: partyIds } } });
    await prisma.partyShippingAddress.deleteMany({ where: { partyId: { in: partyIds } } });
    await prisma.partyHidden.deleteMany({ where: { partyId: { in: partyIds } } });
    const dp = await prisma.party.deleteMany({ where: { organizationId: ORG_ID } });
    console.log("Parties deleted:", dp.count);
  } else {
    console.log("Parties: 0 (already clean)");
  }

  // ── Vehicles + Customers ──────────────────────────────────────────────────
  const customerIds = (
    await prisma.customer.findMany({ where: { organizationId: ORG_ID }, select: { id: true } })
  ).map((c) => c.id);

  if (customerIds.length > 0) {
    const dv = await prisma.vehicle.deleteMany({ where: { customerId: { in: customerIds } } });
    console.log("Vehicles deleted:", dv.count);
    const dc = await prisma.customer.deleteMany({ where: { organizationId: ORG_ID } });
    console.log("Customers deleted:", dc.count);
  } else {
    console.log("Customers/Vehicles: 0 (already clean)");
  }

  // ── Attendance ────────────────────────────────────────────────────────────
  const branchIds = (
    await prisma.branch.findMany({ where: { organizationId: ORG_ID }, select: { id: true } })
  ).map((b) => b.id);

  const da = await prisma.attendance.deleteMany({ where: { branchId: { in: branchIds } } });
  console.log("Attendance deleted:", da.count);

  // ── Staff users (keep PLATFORM_OWNER + SUPER_ADMIN) ───────────────────────
  const allUsers = await prisma.user.findMany({
    where: { organizationId: ORG_ID },
    select: { id: true, name: true, role: true, branchId: true },
  });

  const keepUsers = allUsers.filter((u) => KEEP_ROLES.has(u.role));
  const deleteUsers = allUsers.filter((u) => !KEEP_ROLES.has(u.role));

  if (deleteUsers.length > 0) {
    const du = await prisma.user.deleteMany({
      where: { id: { in: deleteUsers.map((u) => u.id) } },
    });
    console.log("Staff users deleted:", du.count);
  } else {
    console.log("Staff users: 0 (already clean)");
  }

  console.log(
    "Users kept:",
    keepUsers.map((u) => `${u.name} (${u.role})`).join(", ")
  );

  // ── Extra branches (keep the SUPER_ADMIN's branch) ────────────────────────
  const superAdmin = keepUsers.find((u) => u.role === "SUPER_ADMIN");
  const primaryBranchId = superAdmin?.branchId;

  // Move any kept users off branches that will be deleted
  for (const u of keepUsers) {
    if (u.branchId !== primaryBranchId && primaryBranchId) {
      await prisma.user.update({ where: { id: u.id }, data: { branchId: primaryBranchId } });
    }
  }

  const branchesToDelete = branchIds.filter((id) => id !== primaryBranchId);
  if (branchesToDelete.length > 0) {
    const db2 = await prisma.branch.deleteMany({ where: { id: { in: branchesToDelete } } });
    console.log("Extra branches deleted:", db2.count);
  } else {
    console.log("Extra branches: 0");
  }

  const primaryBranch = await prisma.branch.findUnique({
    where: { id: primaryBranchId ?? "" },
    select: { name: true },
  });
  console.log("Branch kept:", primaryBranch?.name ?? primaryBranchId);

  console.log("\nDone. Refresh the browser.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});

