import { z } from "zod";

/**
 * Structural validators for high-risk AppJsonRow collections.
 * Use `.passthrough()` so legacy/optional fields are not rejected.
 */

const nonEmptyString = z.string().min(1);

export const invoicePayloadSchema = z
  .object({
    id: nonEmptyString,
    invoiceNumber: nonEmptyString,
    jobCardId: z.string().optional(),
    customerId: nonEmptyString,
    customerName: z.string(),
    customerPhone: z.string(),
    status: z.string().min(1),
    subtotal: z.number(),
    taxRate: z.number(),
    taxAmount: z.number(),
    grandTotal: z.number(),
    lineItems: z.array(z.record(z.string(), z.unknown())),
    payments: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .passthrough();

export const jobCardPayloadSchema = z
  .object({
    id: nonEmptyString,
    jobNumber: nonEmptyString,
    branchId: nonEmptyString,
    customerId: nonEmptyString,
    customerName: z.string(),
    customerPhone: z.string(),
    vehicleId: nonEmptyString,
    vehicleRegNumber: z.string(),
    vehicleMakeModel: z.string(),
    status: z.string().min(1),
    services: z.array(z.record(z.string(), z.unknown())),
    estimatedAmount: z.number(),
  })
  .passthrough();

export const quotationPayloadSchema = z
  .object({
    id: nonEmptyString,
    quotationNumber: nonEmptyString,
    customerId: nonEmptyString,
    customerName: z.string(),
    customerPhone: z.string(),
    status: z.string().min(1),
    services: z.array(z.record(z.string(), z.unknown())),
    subtotal: z.number(),
    taxRate: z.number(),
    taxAmount: z.number(),
    grandTotal: z.number(),
  })
  .passthrough();

/** Singleton payroll document (`entityId = default`). */
export const payrollPayloadSchema = z
  .object({
    salaryStructures: z.array(z.unknown()).optional(),
    payrollRecords: z.array(z.unknown()).optional(),
    salaryAdvances: z.array(z.unknown()).optional(),
    salaryAdvanceRecoveries: z.array(z.unknown()).optional(),
  })
  .passthrough();

/** Singleton membership document (`entityId = default`). */

/** Singleton leave config (`entityId = default`): types + balances. */
export const leaveConfigPayloadSchema = z
  .object({
    leaveTypes: z.array(z.unknown()).optional(),
    balances: z.array(z.unknown()).optional(),
  })
  .passthrough();

/** Array leave request documents. */
export const leaveRequestPayloadSchema = z
  .object({
    id: nonEmptyString,
    staffId: nonEmptyString,
    leaveTypeId: nonEmptyString,
    fromDate: nonEmptyString,
    toDate: nonEmptyString,
    days: z.number(),
    status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]),
    branchId: nonEmptyString,
  })
  .passthrough();

/** Singleton staff reward settings (`entityId = default`). */
export const staffRewardSettingsPayloadSchema = z
  .object({
    rewardMode: z.enum(["PERCENT_OF_JOB", "FIXED_PER_JOB"]).optional(),
    defaultPercent: z.number().optional(),
    defaultFixedAmount: z.number().optional(),
    tiersEnabled: z.boolean().optional(),
    tiers: z.array(z.unknown()).optional(),
    timeBonusEnabled: z.boolean().optional(),
    lateDeductionEnabled: z.boolean().optional(),
    supervisorSharePercent: z.number().optional(),
    applicatorSharePercent: z.number().optional(),
    companyTargetEnabled: z.boolean().optional(),
    companyTargetRevenueType: z.enum(["SERVICES", "COUNTER_SALE", "BOTH"]).optional(),
    companyTargetPeriod: z.enum(["MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY"]).optional(),
    companyTargetTiers: z
      .array(
        z.object({
          targetAmount: z.number(),
          rewardPercent: z.number(),
        })
      )
      .optional(),
    companyTargetFrequencyTiers: z
      .record(
        z.enum(["MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY"]),
        z.array(
          z.object({
            targetAmount: z.number(),
            rewardPercent: z.number(),
          })
        )
      )
      .optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough();

/** Array staff reward ledger documents. */
export const staffRewardLedgerPayloadSchema = z
  .object({
    id: nonEmptyString,
    staffId: nonEmptyString,
    staffName: z.string(),
    branchId: nonEmptyString,
    rewardType: z.enum([
      "JOB_INCENTIVE",
      "TIME_BONUS",
      "LATE_DEDUCTION",
      "MANUAL_CREDIT",
      "MANUAL_DEBIT",
      "TIER_BONUS",
    ]),
    amount: z.number(),
    status: z.enum(["PENDING", "APPROVED", "PAID_IN_PAYROLL", "CANCELLED"]),
    periodMonth: z.number(),
    periodYear: z.number(),
    idempotencyKey: nonEmptyString,
    createdAt: nonEmptyString,
  })
  .passthrough();

/** Array staff target documents. */
export const staffTargetPayloadSchema = z
  .object({
    id: nonEmptyString,
    staffId: nonEmptyString,
    staffName: z.string(),
    branchId: nonEmptyString,
    periodMonth: z.number(),
    periodYear: z.number(),
    metric: z.enum(["JOBS_COMPLETED", "REVENUE", "INCENTIVE"]),
    targetValue: z.number(),
  })
  .passthrough();

export const membershipPayloadSchema = z
  .object({
    packages: z.array(z.unknown()).optional(),
    subscriptions: z.array(z.unknown()).optional(),
  })
  .passthrough();

const COLLECTION_PAYLOAD_SCHEMAS: Record<string, z.ZodType<object>> = {
  invoices: invoicePayloadSchema,
  jobCards: jobCardPayloadSchema,
  quotations: quotationPayloadSchema,
  payroll: payrollPayloadSchema,
  membership: membershipPayloadSchema,
  leaveConfig: leaveConfigPayloadSchema,
  leaveRequests: leaveRequestPayloadSchema,
  staffRewardSettings: staffRewardSettingsPayloadSchema,
  staffRewardLedger: staffRewardLedgerPayloadSchema,
  staffTargets: staffTargetPayloadSchema,
};

export function parseCollectionPayload(collection: string, payload: unknown): object {
  const schema = COLLECTION_PAYLOAD_SCHEMAS[collection];
  if (!schema) {
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
      throw new z.ZodError([
        {
          code: "custom",
          path: [],
          message: "Body must be a JSON object",
        },
      ]);
    }
    return payload as object;
  }
  return schema.parse(payload) as object;
}

/** For array snapshots: validate each item when a schema exists. */
export function parseCollectionSnapshotItems(
  collection: string,
  items: unknown[]
): { id: string }[] {
  const schema = COLLECTION_PAYLOAD_SCHEMAS[collection];
  const out: { id: string }[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it || typeof it !== "object" || Array.isArray(it)) {
      throw new z.ZodError([
        {
          code: "custom",
          path: [i],
          message: "Each item must be an object with string id",
        },
      ]);
    }
    const id = (it as { id?: unknown }).id;
    if (typeof id !== "string" || !id) {
      throw new z.ZodError([
        {
          code: "custom",
          path: [i, "id"],
          message: "Each item must have string id",
        },
      ]);
    }
    if (schema) {
      out.push(schema.parse(it) as { id: string });
    } else {
      out.push(it as { id: string });
    }
  }
  return out;
}

export function assertPayloadEntityIdMatch(
  collection: string,
  entityId: string,
  payload: object
): void {
  if (
    collection === "payroll" ||
    collection === "membership" ||
    collection === "leaveConfig" ||
    collection === "staffRewardSettings"
  )
    return;
  if (!("id" in payload)) return;
  const id = (payload as { id?: unknown }).id;
  if (typeof id === "string" && id !== entityId) {
    throw new z.ZodError([
      {
        code: "custom",
        path: ["id"],
        message: `payload.id must match URL entityId (${entityId})`,
      },
    ]);
  }
}
