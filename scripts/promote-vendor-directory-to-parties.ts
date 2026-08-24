#!/usr/bin/env tsx
import "dotenv/config";
import { PartyKind } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";

type VendorDirectoryItem = {
  id?: string;
  name?: string;
  notes?: string;
  contactPerson?: string;
  isActive?: boolean;
};

type ExpenseMetaPayload = {
  vendorDirectory?: VendorDirectoryItem[];
};

const APPLY = process.argv.includes("--apply");

function partyIdFromVendorName(name: string): string {
  return `v:${encodeURIComponent(name.trim())}`;
}

async function main() {
  console.log(APPLY ? "[LIVE RUN]" : "[DRY RUN]");

  const rows = await prisma.appJsonRow.findMany({
    where: { collection: "expenseMeta", entityId: "default" },
    select: { organizationId: true, payload: true },
  });

  if (rows.length === 0) {
    console.log("No expenseMeta rows found.");
    return;
  }

  let seen = 0;
  let toCreate = 0;
  let toUpdate = 0;
  let skipped = 0;

  for (const row of rows) {
    const payload = (row.payload ?? {}) as ExpenseMetaPayload;
    const directory = Array.isArray(payload.vendorDirectory) ? payload.vendorDirectory : [];

    for (const vendor of directory) {
      const name = (vendor.name ?? "").trim();
      if (!name) {
        skipped += 1;
        continue;
      }

      seen += 1;
      const partyId = partyIdFromVendorName(name);

      const existing = await prisma.party.findUnique({
        where: { id: partyId },
        select: { id: true },
      });

      if (!existing) {
        toCreate += 1;
        if (APPLY) {
          await prisma.party.create({
            data: {
              id: partyId,
              kind: PartyKind.SUPPLIER,
              name,
              category: vendor.notes?.trim() || null,
              contactPersonName: vendor.contactPerson?.trim() || null,
              vendorKey: name,
              openingBalance: 0,
              organizationId: row.organizationId,
            },
          });
        }
      } else {
        toUpdate += 1;
        if (APPLY) {
          await prisma.party.update({
            where: { id: partyId },
            data: {
              kind: PartyKind.SUPPLIER,
              name,
              category: vendor.notes?.trim() || null,
              contactPersonName: vendor.contactPerson?.trim() || null,
              vendorKey: name,
              organizationId: row.organizationId,
            },
          });
        }
      }
    }
  }

  console.log({ seen, toCreate, toUpdate, skipped, apply: APPLY });

  if (!APPLY) {
    console.log("Run with --apply to persist changes.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
