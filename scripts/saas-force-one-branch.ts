#!/usr/bin/env tsx
/**
 * Force an organization down to a single branch for Starter-plan testing.
 *
 * Usage:
 *   npx tsx scripts/saas-force-one-branch.ts --dry-run
 *   CONFIRM=YES npx tsx scripts/saas-force-one-branch.ts --keep br-main
 */
import "dotenv/config";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";

const args = process.argv.slice(2);
function flag(name: string): string | undefined {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  return args[i + 1];
}
const dryRun = args.includes("--dry-run");
const orgId = flag("--org") ?? "org-default";
const keepIdArg = flag("--keep");

function remapBranchIdsInValue(value: unknown, fromIds: Set<string>, toId: string): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => remapBranchIdsInValue(v, fromIds, toId));
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === "branchId" && typeof v === "string" && fromIds.has(v)) {
        next[k] = toId;
      } else {
        next[k] = remapBranchIdsInValue(v, fromIds, toId);
      }
    }
    return next;
  }
  return value;
}

async function main() {
  if (!dryRun && process.env.CONFIRM !== "YES") {
    console.error(
      "Refusing without CONFIRM=YES.\n" +
        "Dry run: npx tsx scripts/saas-force-one-branch.ts --dry-run\n" +
        "Apply:   CONFIRM=YES npx tsx scripts/saas-force-one-branch.ts --keep br-main"
    );
    process.exit(1);
  }

  const branches = await prisma.branch.findMany({
    where: { organizationId: orgId },
    orderBy: { id: "asc" },
  });
  if (branches.length === 0) throw new Error(`No branches for ${orgId}`);

  const keep =
    (keepIdArg ? branches.find((b) => b.id === keepIdArg) : null) ??
    branches.find((b) => b.id === "br-main") ??
    branches[0]!;

  if (keepIdArg && keep.id !== keepIdArg) {
    throw new Error(`Keep branch ${keepIdArg} not found`);
  }

  const remove = branches.filter((b) => b.id !== keep.id);
  const removeIds = new Set(remove.map((b) => b.id));

  console.log(
    JSON.stringify(
      {
        mode: dryRun ? "dry-run" : "apply",
        orgId,
        keep: { id: keep.id, name: keep.name },
        remove: remove.map((b) => ({ id: b.id, name: b.name })),
      },
      null,
      2
    )
  );

  if (dryRun) return;

  await prisma.$transaction(async (tx) => {
    if (removeIds.size > 0) {
      await tx.user.updateMany({
        where: { branchId: { in: [...removeIds] } },
        data: { branchId: keep.id },
      });
      await tx.attendance.updateMany({
        where: { branchId: { in: [...removeIds] } },
        data: { branchId: keep.id },
      });

      const rows = await tx.appJsonRow.findMany();
      for (const row of rows) {
        const remapped = remapBranchIdsInValue(row.payload, removeIds, keep.id);
        if (JSON.stringify(remapped) !== JSON.stringify(row.payload)) {
          await tx.appJsonRow.update({
            where: {
              collection_entityId: { collection: row.collection, entityId: row.entityId },
            },
            data: { payload: remapped as Prisma.InputJsonValue },
          });
        }
      }

      await tx.branch.deleteMany({
        where: { organizationId: orgId, id: { in: [...removeIds] } },
      });
    }

    await tx.organizationSubscription.update({
      where: { organizationId: orgId },
      data: {
        planCode: "STARTER",
        planName: "Starter",
        status: "ACTIVE",
        limits: { maxBranches: 1 },
        maxBranchesOverride: null,
      },
    });
  });

  console.log("Done. Branches:", await prisma.branch.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true },
  }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
