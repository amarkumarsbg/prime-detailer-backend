-- CreateEnum
CREATE TYPE "SubscriptionPaymentStatus" AS ENUM ('PAID', 'PENDING', 'PROCESSING', 'FAILED');

-- AlterTable OrganizationSubscription
ALTER TABLE "OrganizationSubscription" ADD COLUMN IF NOT EXISTS "termMonths" INTEGER NOT NULL DEFAULT 12;
ALTER TABLE "OrganizationSubscription" ADD COLUMN IF NOT EXISTS "startsAt" TIMESTAMP(3);
ALTER TABLE "OrganizationSubscription" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "OrganizationSubscription" ADD COLUMN IF NOT EXISTS "paymentStatus" "SubscriptionPaymentStatus" NOT NULL DEFAULT 'PAID';
ALTER TABLE "OrganizationSubscription" ADD COLUMN IF NOT EXISTS "lastPaymentTxnId" TEXT;

-- Backfill dates from legacy currentPeriodEnd or +12 months from now
UPDATE "OrganizationSubscription"
SET
  "startsAt" = COALESCE("startsAt", COALESCE("currentPeriodEnd", NOW()) - INTERVAL '12 months'),
  "expiresAt" = COALESCE("expiresAt", "currentPeriodEnd", NOW() + INTERVAL '12 months'),
  "currentPeriodEnd" = COALESCE("expiresAt", "currentPeriodEnd", NOW() + INTERVAL '12 months');

-- CreateTable SubscriptionPayment
CREATE TABLE IF NOT EXISTS "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "SubscriptionPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "txnReference" TEXT,
    "method" TEXT,
    "notes" TEXT,
    "recordedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable SubscriptionBill
CREATE TABLE IF NOT EXISTS "SubscriptionBill" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "paymentId" TEXT,
    "billNumber" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "termLabel" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubscriptionBill_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionBill_paymentId_key" ON "SubscriptionBill"("paymentId");
CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionBill_organizationId_billNumber_key" ON "SubscriptionBill"("organizationId", "billNumber");
CREATE INDEX IF NOT EXISTS "SubscriptionPayment_organizationId_createdAt_idx" ON "SubscriptionPayment"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "SubscriptionPayment_subscriptionId_createdAt_idx" ON "SubscriptionPayment"("subscriptionId", "createdAt");
CREATE INDEX IF NOT EXISTS "SubscriptionBill_organizationId_createdAt_idx" ON "SubscriptionBill"("organizationId", "createdAt");

ALTER TABLE "SubscriptionPayment" DROP CONSTRAINT IF EXISTS "SubscriptionPayment_organizationId_fkey";
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SubscriptionPayment" DROP CONSTRAINT IF EXISTS "SubscriptionPayment_subscriptionId_fkey";
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "OrganizationSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SubscriptionBill" DROP CONSTRAINT IF EXISTS "SubscriptionBill_organizationId_fkey";
ALTER TABLE "SubscriptionBill" ADD CONSTRAINT "SubscriptionBill_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SubscriptionBill" DROP CONSTRAINT IF EXISTS "SubscriptionBill_subscriptionId_fkey";
ALTER TABLE "SubscriptionBill" ADD CONSTRAINT "SubscriptionBill_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "OrganizationSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SubscriptionBill" DROP CONSTRAINT IF EXISTS "SubscriptionBill_paymentId_fkey";
ALTER TABLE "SubscriptionBill" ADD CONSTRAINT "SubscriptionBill_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "SubscriptionPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
