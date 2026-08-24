-- AlterTable: HR profile fields on User (staff). joiningDate is separate from birthday/anniversary.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "designation" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "department" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "joiningDate" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notes" TEXT;
