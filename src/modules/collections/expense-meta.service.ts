/**
 * expenseMeta domain service.
 *
 * Protects the `vendorDirectory` field from accidental overwrites when the
 * frontend saves expense settings without loading the vendor list first.
 *
 * Also mirrors vendorDirectory entries to the `Party` table so vendors are
 * stored in a durable relational row that cannot be wiped by a snapshot.
 */
import { prisma } from "../../lib/prisma.js";
import { SINGLETON_ENTITY_ID } from "../../constants/json-collections.js";
import {
  getCollectionItem,
  listCollectionItems,
  upsertCollectionItem,
} from "../collections/app-json-store.js";

type VendorEntry = {
  id?: string;
  name?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  notes?: string;
  isActive?: boolean;
  branchId?: string;
};

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * Mirror vendorDirectory entries to the Party table (kind=SUPPLIER).
 * Uses `vendorKey` (normalised name) to upsert — safe to call repeatedly.
 */
async function mirrorVendorsToPartyTable(
  organizationId: string,
  vendors: VendorEntry[]
): Promise<void> {
  for (const v of vendors) {
    const name = asString(v.name);
    if (!name) continue;

    const vendorKey = name.toLowerCase().replace(/\s+/g, "_");

    const existingParty = await prisma.party.findFirst({
      where: { organizationId, vendorKey },
      select: { id: true },
    });

    if (existingParty) {
      await prisma.party.update({
        where: { id: existingParty.id },
        data: {
          name,
          contactPersonName: asString(v.contactPerson),
          email: asString(v.email),
          mobile: asString(v.phone),
        },
      });
    } else {
      await prisma.party.create({
        data: {
          id: v.id ?? `vk-${vendorKey}`,
          organizationId,
          kind: "SUPPLIER",
          name,
          contactPersonName: asString(v.contactPerson),
          email: asString(v.email),
          mobile: asString(v.phone),
          category: asString(v.notes),
          vendorKey,
          openingBalance: 0,
        },
      });
    }
  }
}

export async function upsertExpenseMeta(
  organizationId: string,
  payload: unknown
): Promise<void> {
  if (!payload || typeof payload !== "object") {
    await upsertCollectionItem("expenseMeta", SINGLETON_ENTITY_ID, payload, organizationId);
    return;
  }

  const incoming = payload as Record<string, unknown>;

  // Preserve vendorDirectory: if the incoming payload has an empty / missing
  // vendorDirectory, keep whatever is already stored so a settings save can
  // never silently delete vendors.
  const incomingVendors = incoming.vendorDirectory;
  const hasVendors =
    Array.isArray(incomingVendors) && incomingVendors.length > 0;

  let vendorDirectory: VendorEntry[] = hasVendors
    ? (incomingVendors as VendorEntry[])
    : [];

  if (!hasVendors) {
    // Fall back to existing stored vendors
    const existing = await getCollectionItem("expenseMeta", SINGLETON_ENTITY_ID, organizationId);
    if (existing && typeof existing === "object") {
      const existingVendors = (existing as Record<string, unknown>).vendorDirectory;
      if (Array.isArray(existingVendors) && existingVendors.length > 0) {
        vendorDirectory = existingVendors as VendorEntry[];
      }
    }
  }

  const merged = { ...incoming, vendorDirectory };
  await upsertCollectionItem("expenseMeta", SINGLETON_ENTITY_ID, merged, organizationId);

  // Mirror to Party table — runs in background, does not block response.
  if (vendorDirectory.length > 0) {
    mirrorVendorsToPartyTable(organizationId, vendorDirectory).catch(() => {});
  }
}

export async function listExpenseMeta(
  organizationId: string,
  allowedBranchIds?: string[] | null
) {
  return listCollectionItems("expenseMeta", { organizationId, allowedBranchIds });
}

export async function getExpenseMeta(organizationId: string) {
  return getCollectionItem("expenseMeta", SINGLETON_ENTITY_ID, organizationId);
}
