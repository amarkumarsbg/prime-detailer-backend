/**
 * cashBank singleton domain service.
 *
 * Protects bank accounts and transaction history from accidental overwrites.
 * When the incoming payload has an empty or missing `accounts` / `transactions`
 * array, the existing data is preserved — same principle as expenseMeta/vendorDirectory.
 */
import { SINGLETON_ENTITY_ID } from "../../constants/json-collections.js";
import {
  getCollectionItem,
  listCollectionItems,
  upsertCollectionItem,
} from "../collections/app-json-store.js";

type CashBankPayload = Record<string, unknown>;

function hasItems(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

export async function upsertCashBank(
  organizationId: string,
  payload: unknown
): Promise<void> {
  if (!payload || typeof payload !== "object") {
    await upsertCollectionItem("cashBank", SINGLETON_ENTITY_ID, payload, organizationId);
    return;
  }

  const incoming = payload as CashBankPayload;

  // Load existing to compare
  const existing = (await getCollectionItem(
    "cashBank",
    SINGLETON_ENTITY_ID,
    organizationId
  )) as CashBankPayload | null;

  // Preserve accounts if incoming has none
  const accounts = hasItems(incoming.accounts)
    ? incoming.accounts
    : (existing?.accounts ?? []);

  // Preserve transactions if incoming has none
  const transactions = hasItems(incoming.transactions)
    ? incoming.transactions
    : (existing?.transactions ?? []);

  const merged: CashBankPayload = { ...incoming, accounts, transactions };
  await upsertCollectionItem("cashBank", SINGLETON_ENTITY_ID, merged, organizationId);
}

export async function listCashBank(
  organizationId: string,
  allowedBranchIds?: string[] | null
) {
  return listCollectionItems("cashBank", { organizationId, allowedBranchIds });
}

export async function getCashBank(organizationId: string) {
  return getCollectionItem("cashBank", SINGLETON_ENTITY_ID, organizationId);
}
