-- Platform referral codes for subscription discounts.
CREATE TABLE IF NOT EXISTS "PlatformReferralCode" (
  "id"             TEXT NOT NULL,
  "code"           TEXT NOT NULL,
  "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 1000,
  "isActive"       BOOLEAN NOT NULL DEFAULT TRUE,
  "createdBy"      TEXT NOT NULL,
  "notes"          TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformReferralCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformReferralCode_code_key" ON "PlatformReferralCode"("code");
