-- AlterEnum: allow SaaS trial subscriptions (appended to existing enum)
ALTER TYPE "SubscriptionStatus" ADD VALUE 'TRIAL';

-- AlterTable: dedicated trial end timestamp (cleared on convert-to-paid)
ALTER TABLE "OrganizationSubscription" ADD COLUMN "trialEndsAt" TIMESTAMP(3);
