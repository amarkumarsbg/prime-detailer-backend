-- Extend SubscriptionBill for customer-side commercial breakdown snapshot.
ALTER TABLE "SubscriptionBill" ADD COLUMN IF NOT EXISTS "baseAmount" DOUBLE PRECISION;
ALTER TABLE "SubscriptionBill" ADD COLUMN IF NOT EXISTS "extraBranchCost" DOUBLE PRECISION;
ALTER TABLE "SubscriptionBill" ADD COLUMN IF NOT EXISTS "extraUserCost" DOUBLE PRECISION;
ALTER TABLE "SubscriptionBill" ADD COLUMN IF NOT EXISTS "onboardingFee" DOUBLE PRECISION;
ALTER TABLE "SubscriptionBill" ADD COLUMN IF NOT EXISTS "referralDiscount" DOUBLE PRECISION;
ALTER TABLE "SubscriptionBill" ADD COLUMN IF NOT EXISTS "gstPercent" DOUBLE PRECISION;
ALTER TABLE "SubscriptionBill" ADD COLUMN IF NOT EXISTS "gstAmount" DOUBLE PRECISION;
ALTER TABLE "SubscriptionBill" ADD COLUMN IF NOT EXISTS "totalAmount" DOUBLE PRECISION;

-- Backfill new fields from legacy amount where possible.
UPDATE "SubscriptionBill"
SET
  "baseAmount" = COALESCE("baseAmount", "amount", 0),
  "extraBranchCost" = COALESCE("extraBranchCost", 0),
  "extraUserCost" = COALESCE("extraUserCost", 0),
  "onboardingFee" = COALESCE("onboardingFee", 0),
  "referralDiscount" = COALESCE("referralDiscount", 0),
  "gstPercent" = COALESCE("gstPercent", 0),
  "gstAmount" = COALESCE("gstAmount", 0),
  "totalAmount" = COALESCE("totalAmount", "amount", 0)
WHERE
  "baseAmount" IS NULL
  OR "extraBranchCost" IS NULL
  OR "extraUserCost" IS NULL
  OR "onboardingFee" IS NULL
  OR "referralDiscount" IS NULL
  OR "gstPercent" IS NULL
  OR "gstAmount" IS NULL
  OR "totalAmount" IS NULL;
