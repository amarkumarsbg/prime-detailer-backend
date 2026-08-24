-- Add missing avatar column for legacy databases created before Customer.avatar existed.
ALTER TABLE "Customer"
ADD COLUMN IF NOT EXISTS "avatar" TEXT;
