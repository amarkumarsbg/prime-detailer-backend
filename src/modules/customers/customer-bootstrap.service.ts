/**
 * Customer-portal bootstrap: single call returning all data the portal needs.
 * `customerId`/`organizationId` are always taken from the verified JWT (`req.auth`),
 * never from request params — see `customer-bootstrap.controller.ts`.
 */
import { prisma } from "../../lib/prisma.js";
import { SINGLETON_ENTITY_ID } from "../../constants/json-collections.js";
import { toApiCustomer } from "./customer.service.js";

export interface CustomerRewardConfig {
  pointsPer100: number;
  pointValue: number;
  referralBonus: number;
  minRedeem: number;
}

const DEFAULT_REWARD_CONFIG: CustomerRewardConfig = {
  pointsPer100: 1,
  pointValue: 0.25,
  referralBonus: 100,
  minRedeem: 200,
};

async function readArrayCollectionForCustomer(
  collection: string,
  organizationId: string,
  customerId: string
): Promise<unknown[]> {
  const rows = await prisma.appJsonRow.findMany({
    where: { collection, organizationId },
    select: { payload: true },
  });
  return rows
    .map((r) => r.payload as Record<string, unknown>)
    .filter((p) => p.customerId === customerId);
}

async function readRewardConfig(organizationId: string): Promise<CustomerRewardConfig> {
  const row = await prisma.appJsonRow.findFirst({
    where: {
      collection: "customerRewardSettings",
      entityId: SINGLETON_ENTITY_ID,
      organizationId,
    },
    select: { payload: true },
  });
  const payload = (row?.payload as Partial<CustomerRewardConfig> | undefined) ?? {};
  return {
    pointsPer100: payload.pointsPer100 ?? DEFAULT_REWARD_CONFIG.pointsPer100,
    pointValue: payload.pointValue ?? DEFAULT_REWARD_CONFIG.pointValue,
    referralBonus: payload.referralBonus ?? DEFAULT_REWARD_CONFIG.referralBonus,
    minRedeem: payload.minRedeem ?? DEFAULT_REWARD_CONFIG.minRedeem,
  };
}

async function readMembershipsForCustomer(
  organizationId: string,
  customerId: string
): Promise<unknown[]> {
  const row = await prisma.appJsonRow.findFirst({
    where: {
      collection: "membership",
      entityId: SINGLETON_ENTITY_ID,
      organizationId,
    },
    select: { payload: true },
  });
  const payload = row?.payload as { subscriptions?: unknown[] } | undefined;
  const subscriptions = Array.isArray(payload?.subscriptions) ? payload!.subscriptions! : [];
  return subscriptions.filter(
    (s) => s && typeof s === "object" && (s as Record<string, unknown>).customerId === customerId
  );
}

export interface CustomerBootstrapPayload {
  customer: ReturnType<typeof toApiCustomer>;
  jobCards: unknown[];
  invoices: unknown[];
  vehicles: unknown[];
  memberships: unknown[];
  walletTransactions: unknown[];
  rewardConfig: CustomerRewardConfig;
}

export async function getCustomerBootstrapPayload(
  customerId: string,
  organizationId: string
): Promise<CustomerBootstrapPayload | null> {
  const customerRow = await prisma.customer.findFirst({
    where: { id: customerId, organizationId },
  });
  if (!customerRow) return null;

  const [jobCards, invoices, vehicles, memberships, walletTransactions, rewardConfig] =
    await Promise.all([
      readArrayCollectionForCustomer("jobCards", organizationId, customerId),
      readArrayCollectionForCustomer("invoices", organizationId, customerId),
      prisma.vehicle.findMany({ where: { customerId, organizationId } }),
      readMembershipsForCustomer(organizationId, customerId),
      readArrayCollectionForCustomer("walletTransactions", organizationId, customerId),
      readRewardConfig(organizationId),
    ]);

  return {
    customer: toApiCustomer(customerRow),
    jobCards,
    invoices,
    vehicles,
    memberships,
    walletTransactions,
    rewardConfig,
  };
}
