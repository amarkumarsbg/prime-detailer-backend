import type { PlanCode } from "@prisma/client";
import type { PlanLimits } from "./plan-catalog.js";

export type SubscriptionPricingInput = {
  termMonths: number;
  extraBranches: number;
  extraUsers: number;
  referralCode?: string | null;
};

export type SubscriptionPricingBreakdown = {
  planCode: PlanCode;
  planName: string;
  termMonths: number;
  termLabel: string;
  extraBranches: number;
  extraUsers: number;
  baseAmount: number;
  extraBranchCost: number;
  extraUserCost: number;
  onboardingFee: number;
  onboardingApplied: boolean;
  referralCode: string | null;
  referralDiscount: number;
  referralApplied: boolean;
  referralEligible: boolean;
  referralValidationMessage: string | null;
  gstPercent: number;
  gstAmount: number;
  subTotalBeforeTax: number;
  finalAmount: number;
  includedBranches: number | null;
  includedUsers: number | null;
  finalAllowedBranches: number | null;
  finalAllowedUsers: number | null;
  currency: string;
  isFirstSubscription: boolean;
};

const TERM_LABELS: Record<number, string> = {
  12: "1 year",
  24: "2 years",
  36: "3 years",
  60: "5 years",
};

const DEFAULT_TERM_PRICE: Record<number, number> = {
  12: Number(process.env.SUBSCRIPTION_BASE_PRICE_12 ?? 9999),
  24: Number(process.env.SUBSCRIPTION_BASE_PRICE_24 ?? 18999),
  36: Number(process.env.SUBSCRIPTION_BASE_PRICE_36 ?? 26999),
  60: Number(process.env.SUBSCRIPTION_BASE_PRICE_60 ?? 41999),
};

const PLAN_TERM_MULTIPLIER: Record<PlanCode, number> = {
  STARTER: Number(process.env.SUBSCRIPTION_PRICE_MULTIPLIER_STARTER ?? 1),
  GROWTH: Number(process.env.SUBSCRIPTION_PRICE_MULTIPLIER_GROWTH ?? 1.8),
  BUSINESS: Number(process.env.SUBSCRIPTION_PRICE_MULTIPLIER_BUSINESS ?? 3),
  ENTERPRISE: Number(process.env.SUBSCRIPTION_PRICE_MULTIPLIER_ENTERPRISE ?? 5),
  CUSTOM: Number(process.env.SUBSCRIPTION_PRICE_MULTIPLIER_CUSTOM ?? 1),
};

const EXTRA_BRANCH_PRICE = Number(process.env.SUBSCRIPTION_EXTRA_BRANCH_PRICE ?? 2500);
const EXTRA_USER_PRICE = Number(process.env.SUBSCRIPTION_EXTRA_USER_PRICE ?? 750);
const ONBOARDING_FEE = Number(process.env.SUBSCRIPTION_ONBOARDING_FEE ?? 1500);
const REFERRAL_DISCOUNT = Number(process.env.SUBSCRIPTION_REFERRAL_DISCOUNT ?? 1000);
const GST_PERCENT = Number(process.env.SUBSCRIPTION_GST_PERCENT ?? 18);
const CURRENCY = process.env.SUBSCRIPTION_CURRENCY?.trim() || "INR";

const REFERRAL_CODE_REGEX = /^[A-Z0-9-]{4,24}$/;

function clampNonNegativeInt(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function safeNumber(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function validateReferralCode(raw: string | null | undefined): {
  code: string | null;
  message: string | null;
} {
  const code = raw?.trim().toUpperCase() ?? "";
  if (!code) return { code: null, message: null };
  if (!REFERRAL_CODE_REGEX.test(code)) {
    return { code: null, message: "Invalid referral code format." };
  }
  return { code, message: null };
}

function addCapacity(base: number | null | undefined, extra: number): number | null {
  if (base === null) return null;
  const normalized = typeof base === "number" && Number.isFinite(base) ? Math.max(0, Math.floor(base)) : 0;
  return normalized + extra;
}

export function calculateSubscriptionPricing(input: {
  planCode: PlanCode;
  planName: string;
  limits: PlanLimits;
  isFirstSubscription: boolean;
  payload: SubscriptionPricingInput;
}): SubscriptionPricingBreakdown {
  const termMonths = input.payload.termMonths;
  const termLabel = TERM_LABELS[termMonths] ?? `${termMonths} months`;
  const extraBranches = clampNonNegativeInt(input.payload.extraBranches);
  const extraUsers = clampNonNegativeInt(input.payload.extraUsers);
  const { code: referralCode, message: referralValidationMessage } = validateReferralCode(
    input.payload.referralCode
  );
  if (!TERM_LABELS[termMonths]) {
    throw new Error("Unsupported term. Allowed: 12, 24, 36, 60 months.");
  }

  const baseTerm = safeNumber(DEFAULT_TERM_PRICE[termMonths] ?? DEFAULT_TERM_PRICE[12], DEFAULT_TERM_PRICE[12]);
  const multiplier = safeNumber(PLAN_TERM_MULTIPLIER[input.planCode], 1);
  const baseAmount = round2(baseTerm * multiplier);
  const extraBranchCost = round2(extraBranches * safeNumber(EXTRA_BRANCH_PRICE, 0));
  const extraUserCost = round2(extraUsers * safeNumber(EXTRA_USER_PRICE, 0));
  const onboardingApplied = input.isFirstSubscription;
  const onboardingFee = onboardingApplied ? round2(safeNumber(ONBOARDING_FEE, 0)) : 0;

  const referralEligible = input.isFirstSubscription && Boolean(referralCode) && !referralValidationMessage;
  const referralApplied = referralEligible;
  const referralDiscount = referralApplied ? round2(safeNumber(REFERRAL_DISCOUNT, 0)) : 0;

  const subtotal = round2(baseAmount + extraBranchCost + extraUserCost + onboardingFee - referralDiscount);
  const taxable = Math.max(0, subtotal);
  const gstPercent = safeNumber(GST_PERCENT, 0);
  const gstAmount = round2((taxable * gstPercent) / 100);
  const finalAmount = round2(taxable + gstAmount);

  const includedBranches = input.limits.maxBranches ?? null;
  const includedUsers = input.limits.maxStaff ?? null;

  return {
    planCode: input.planCode,
    planName: input.planName,
    termMonths,
    termLabel,
    extraBranches,
    extraUsers,
    baseAmount,
    extraBranchCost,
    extraUserCost,
    onboardingFee,
    onboardingApplied,
    referralCode,
    referralDiscount,
    referralApplied,
    referralEligible,
    referralValidationMessage,
    gstPercent,
    gstAmount,
    subTotalBeforeTax: taxable,
    finalAmount,
    includedBranches,
    includedUsers,
    finalAllowedBranches: addCapacity(includedBranches, extraBranches),
    finalAllowedUsers: addCapacity(includedUsers, extraUsers),
    currency: CURRENCY,
    isFirstSubscription: input.isFirstSubscription,
  };
}
