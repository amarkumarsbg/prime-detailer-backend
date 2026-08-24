import type {
  OpeningBalanceSide as PrismaOpeningSide,
  PartyKind as PrismaPartyKind,
  Prisma,
} from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { listCollectionItems, getCollectionItem } from "../../services/collection.service.js";
import { SINGLETON_ENTITY_ID } from "../../constants/json-collections.js";
import type { Expense, Invoice } from "../../types/finance-documents.js";
import type {
  OpeningBalanceSide,
  Party,
  PartyBankAccount,
  PartyCustomField,
  PartyKind,
  PartyLedgerBundle,
  PartyShippingAddress,
  PartyWithBalance,
} from "../../types/party.js";
import {
  buildPartyItemWise,
  buildPartyStatement,
  buildPartySummary,
  buildPartyTransactions,
  partyCurrentBalance,
} from "../../lib/party-ledger.js";

type ExpenseVendorProfile = {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  paymentTerms?: string;
  address?: string;
  gstNumber?: string;
  panNumber?: string;
};

type PartyRowWithRelations = Prisma.PartyGetPayload<{
  include: {
    shippingAddresses: true;
    bankAccounts: true;
    customFields: true;
  };
}>;

function nowIso() {
  return new Date().toISOString();
}

function customerPartyId(customerId: string) {
  return `c:${customerId}`;
}

function prismaKindToApi(k: PrismaPartyKind): PartyKind {
  return k === "CUSTOMER" ? "customer" : "supplier";
}

function apiKindToPrisma(k: PartyKind): PrismaPartyKind {
  return k === "customer" ? "CUSTOMER" : "SUPPLIER";
}

function prismaSideToApi(s: PrismaOpeningSide | null): OpeningBalanceSide | undefined {
  if (!s) return undefined;
  return s === "TO_COLLECT" ? "toCollect" : "toPay";
}

function apiSideToPrisma(s: OpeningBalanceSide | undefined): PrismaOpeningSide | null {
  if (!s) return null;
  return s === "toCollect" ? "TO_COLLECT" : "TO_PAY";
}

function mapDbParty(row: PartyRowWithRelations): Party {
  return {
    id: row.id,
    kind: prismaKindToApi(row.kind),
    name: row.name,
    category: row.category ?? undefined,
    mobile: row.mobile ?? undefined,
    email: row.email ?? undefined,
    gstin: row.gstin ?? undefined,
    pan: row.pan ?? undefined,
    billingAddress: row.billingAddress ?? undefined,
    shippingAddress: row.shippingAddress ?? undefined,
    openingBalance: row.openingBalance,
    openingBalanceSide: prismaSideToApi(row.openingBalanceSide),
    creditPeriodDays: row.creditPeriodDays ?? undefined,
    creditLimit: row.creditLimit ?? undefined,
    contactPersonName: row.contactPersonName ?? undefined,
    dateOfBirth: row.dateOfBirth ?? undefined,
    customerId: row.customerId ?? undefined,
    vendorKey: row.vendorKey ?? undefined,
    bankAccounts: row.bankAccounts.map(
      (b): PartyBankAccount => ({
        id: b.id,
        accountNumber: b.accountNumber,
        ifsc: b.ifsc ?? undefined,
        accountHolderName: b.accountHolderName ?? undefined,
        bankName: b.bankName ?? undefined,
        branchName: b.branchName ?? undefined,
        upiId: b.upiId ?? undefined,
      })
    ),
    shippingAddresses: row.shippingAddresses.map(
      (a): PartyShippingAddress => ({
        id: a.id,
        name: a.name,
        street: a.street,
        state: a.state ?? undefined,
        pincode: a.pincode ?? undefined,
        city: a.city ?? undefined,
        isDefault: a.isDefault,
      })
    ),
    customFields: row.customFields.map(
      (f): PartyCustomField => ({
        key: f.key,
        value: f.value,
      })
    ),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mergeParty(base: Party, patch?: Party): Party {
  if (!patch) return base;
  return {
    ...base,
    ...patch,
    id: base.id,
    kind: patch.kind ?? base.kind,
    name: patch.name || base.name,
    customFields: patch.customFields?.length ? patch.customFields : base.customFields,
    bankAccounts: patch.bankAccounts ?? base.bankAccounts,
    shippingAddresses: patch.shippingAddresses ?? base.shippingAddresses,
    customerId: patch.customerId ?? base.customerId,
    vendorKey: patch.vendorKey ?? base.vendorKey,
    createdAt: base.createdAt,
    updatedAt: patch.updatedAt ?? base.updatedAt,
  };
}

async function loadVendorDirectory(organizationId: string): Promise<ExpenseVendorProfile[]> {
  const meta = await getCollectionItem("expenseMeta", SINGLETON_ENTITY_ID, organizationId);
  if (!meta || typeof meta !== "object") return [];
  const vd = (meta as { vendorDirectory?: ExpenseVendorProfile[] }).vendorDirectory;
  return Array.isArray(vd) ? vd : [];
}

export async function loadFinanceDocuments(
  organizationId: string
): Promise<{ invoices: Invoice[]; expenses: Expense[] }> {
  const [invoicesRaw, expensesRaw] = await Promise.all([
    listCollectionItems("invoices", { organizationId }),
    listCollectionItems("expenses", { organizationId }),
  ]);
  return {
    invoices: invoicesRaw as Invoice[],
    expenses: expensesRaw as Expense[],
  };
}

async function loadHiddenIds(): Promise<Set<string>> {
  const rows = await prisma.partyHidden.findMany();
  return new Set(rows.map((r) => r.partyId));
}

async function loadDbPartiesById(organizationId: string): Promise<Map<string, Party>> {
  const rows = await prisma.party.findMany({
    where: { organizationId },
    include: { shippingAddresses: true, bankAccounts: true, customFields: true },
  });
  const map = new Map<string, Party>();
  for (const row of rows) {
    const party = mapDbParty(row);
    map.set(party.id, party);
    if (party.customerId) {
      map.set(customerPartyId(party.customerId), party);
    }
  }
  return map;
}

function partyFromCustomer(
  c: {
    id: string;
    name: string;
    phone: string;
    email: string;
    address: string;
    createdAt: Date;
  },
  db?: Party
): Party {
  const id = customerPartyId(c.id);
  const base: Party = {
    id,
    kind: "customer",
    name: c.name,
    mobile: c.phone || undefined,
    email: c.email || undefined,
    billingAddress: c.address || undefined,
    shippingAddress: c.address || undefined,
    openingBalance: 0,
    customFields: [],
    customerId: c.id,
    createdAt: c.createdAt.toISOString(),
    updatedAt: nowIso(),
  };
  return mergeParty(base, db);
}

function partyFromVendor(name: string, profile: ExpenseVendorProfile | undefined, db?: Party): Party {
  const id = profile?.id ? `v:${profile.id}` : `v:${encodeURIComponent(name)}`;
  const base: Party = {
    id,
    kind: "supplier",
    name,
    mobile: profile?.phone,
    email: profile?.email,
    gstin: profile?.gstNumber,
    pan: profile?.panNumber,
    billingAddress: profile?.address,
    shippingAddress: profile?.address,
    openingBalance: 0,
    creditPeriodDays: profile?.paymentTerms
      ? parseInt(profile.paymentTerms.replace(/\D/g, ""), 10) || undefined
      : undefined,
    customFields: [],
    vendorKey: name,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  return mergeParty(base, db);
}

export async function listParties(organizationId: string): Promise<Party[]> {
  const [customers, dbById, hidden, vendorDirectory, expensesRaw] = await Promise.all([
    prisma.customer.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
    loadDbPartiesById(organizationId),
    loadHiddenIds(),
    loadVendorDirectory(organizationId),
    listCollectionItems("expenses", { organizationId }),
  ]);

  const expenses = expensesRaw as Expense[];
  const byId = new Map<string, Party>();

  for (const c of customers) {
    const id = customerPartyId(c.id);
    byId.set(id, partyFromCustomer(c, dbById.get(id)));
  }

  const vendorKeys = new Set<string>();
  for (const v of vendorDirectory) {
    const name = v.name?.trim();
    if (name) vendorKeys.add(name);
  }
  for (const e of expenses) {
    const n = e.vendorName?.trim();
    if (n) vendorKeys.add(n);
  }

  for (const name of vendorKeys) {
    const profile = vendorDirectory.find((v) => v.name.trim() === name);
    const id = profile?.id ? `v:${profile.id}` : `v:${encodeURIComponent(name)}`;
    if (byId.has(id)) continue;
    byId.set(id, partyFromVendor(name, profile, dbById.get(id)));
  }

  for (const [id, party] of dbById) {
    if (byId.has(id)) continue;
    if (party.customerId && byId.has(customerPartyId(party.customerId))) continue;
    byId.set(id, party);
  }

  return [...byId.values()]
    .filter((p) => !hidden.has(p.id))
    .sort((a, b) => {
      const byDate = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (byDate !== 0) return byDate;
      return a.name.localeCompare(b.name);
    });
}

export async function listPartiesWithBalance(organizationId: string): Promise<PartyWithBalance[]> {
  const [parties, docs] = await Promise.all([
    listParties(organizationId),
    loadFinanceDocuments(organizationId),
  ]);
  return parties.map((p) => ({
    ...p,
    balance: partyCurrentBalance(p, docs.invoices, docs.expenses),
  }));
}

export async function getPartyById(id: string, organizationId: string): Promise<Party | null> {
  const parties = await listParties(organizationId);
  return parties.find((p) => p.id === id) ?? null;
}

export async function getPartyLedger(
  partyId: string,
  period: string,
  organizationId: string
): Promise<PartyLedgerBundle | null> {
  const party = await getPartyById(partyId, organizationId);
  if (!party) return null;
  const { invoices, expenses } = await loadFinanceDocuments(organizationId);
  return {
    balance: partyCurrentBalance(party, invoices, expenses),
    summary: buildPartySummary(party, invoices, expenses, period),
    transactions: buildPartyTransactions(party, invoices, expenses, period),
    statement: buildPartyStatement(party, invoices, expenses, period),
    itemWise: buildPartyItemWise(party, invoices, expenses, period),
  };
}

export type UpsertPartyInput = Partial<Party> & { name: string; kind: PartyKind };

function resolvePartyId(id: string | null, input: UpsertPartyInput): string {
  if (id) return id;
  if (input.kind === "customer" && input.customerId) return customerPartyId(input.customerId);
  if (input.kind === "supplier" && input.vendorKey) return `v:${encodeURIComponent(input.vendorKey)}`;
  return `p:${Date.now()}`;
}

export async function upsertParty(
  id: string | null,
  organizationId: string,
  input: UpsertPartyInput
): Promise<Party> {
  const partyId = resolvePartyId(id, input);
  const existing = await getPartyById(partyId, organizationId);

  const data: Prisma.PartyUpsertArgs["create"] = {
    id: partyId,
    organizationId,
    kind: apiKindToPrisma(input.kind),
    name: input.name.trim(),
    category: input.category?.trim() || null,
    mobile: input.mobile?.trim() || null,
    email: input.email?.trim() || null,
    gstin: input.gstin?.trim() || null,
    pan: input.pan?.trim() || null,
    billingAddress: input.billingAddress?.trim() || null,
    shippingAddress: input.shippingAddress?.trim() || null,
    openingBalance: input.openingBalance ?? existing?.openingBalance ?? 0,
    openingBalanceSide: apiSideToPrisma(input.openingBalanceSide ?? existing?.openingBalanceSide),
    creditPeriodDays: input.creditPeriodDays ?? existing?.creditPeriodDays ?? null,
    creditLimit: input.creditLimit ?? existing?.creditLimit ?? null,
    contactPersonName: input.contactPersonName?.trim() || null,
    dateOfBirth: input.dateOfBirth?.trim() || null,
    customerId: input.customerId ?? existing?.customerId ?? null,
    vendorKey: input.vendorKey?.trim() || existing?.vendorKey || null,
  };

  const shipping = input.shippingAddresses ?? existing?.shippingAddresses ?? [];
  const banks = input.bankAccounts ?? existing?.bankAccounts ?? [];
  const customFields = input.customFields ?? existing?.customFields ?? [];

  await prisma.$transaction(async (tx) => {
    await tx.party.upsert({
      where: { id: partyId },
      create: data,
      update: {
        kind: data.kind,
        name: data.name,
        category: data.category,
        mobile: data.mobile,
        email: data.email,
        gstin: data.gstin,
        pan: data.pan,
        billingAddress: data.billingAddress,
        shippingAddress: data.shippingAddress,
        openingBalance: data.openingBalance,
        openingBalanceSide: data.openingBalanceSide,
        creditPeriodDays: data.creditPeriodDays,
        creditLimit: data.creditLimit,
        contactPersonName: data.contactPersonName,
        dateOfBirth: data.dateOfBirth,
        customerId: data.customerId,
        vendorKey: data.vendorKey,
      },
    });
    await tx.partyShippingAddress.deleteMany({ where: { partyId } });
    await tx.partyBankAccount.deleteMany({ where: { partyId } });
    await tx.partyCustomField.deleteMany({ where: { partyId } });
    if (shipping.length > 0) {
      await tx.partyShippingAddress.createMany({
        data: shipping.map((a) => ({
          partyId,
          name: a.name,
          street: a.street,
          state: a.state ?? null,
          pincode: a.pincode ?? null,
          city: a.city ?? null,
          isDefault: a.isDefault ?? false,
        })),
      });
    }
    if (banks.length > 0) {
      await tx.partyBankAccount.createMany({
        data: banks.map((b) => ({
          partyId,
          accountNumber: b.accountNumber,
          ifsc: b.ifsc ?? null,
          accountHolderName: b.accountHolderName ?? null,
          bankName: b.bankName ?? null,
          branchName: b.branchName ?? null,
          upiId: b.upiId ?? null,
        })),
      });
    }
    if (customFields.length > 0) {
      await tx.partyCustomField.createMany({
        data: customFields.map((f) => ({
          partyId,
          key: f.key,
          value: f.value,
        })),
      });
    }
  });

  const party = await getPartyById(partyId, organizationId);
  if (!party) throw new Error("Party upsert failed");
  return party;
}

export async function hideParty(id: string, organizationId: string): Promise<boolean> {
  const party = await getPartyById(id, organizationId);
  if (!party) return false;
  await prisma.partyHidden.upsert({
    where: { partyId: id },
    create: { partyId: id },
    update: {},
  });
  return true;
}
