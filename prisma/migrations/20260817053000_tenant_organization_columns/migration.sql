-- Phase 5: hard org isolation columns on Customer, Vehicle, Party, AppJsonRow
-- Backfill existing rows to org-default (created by earlier org migration).

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Party" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "AppJsonRow" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "Customer" SET "organizationId" = 'org-default' WHERE "organizationId" IS NULL;
UPDATE "Vehicle" SET "organizationId" = 'org-default' WHERE "organizationId" IS NULL;
UPDATE "Party" SET "organizationId" = 'org-default' WHERE "organizationId" IS NULL;
UPDATE "AppJsonRow" SET "organizationId" = 'org-default' WHERE "organizationId" IS NULL;

ALTER TABLE "Customer" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Vehicle" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Party" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "AppJsonRow" ALTER COLUMN "organizationId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Customer_organizationId_fkey'
  ) THEN
    ALTER TABLE "Customer"
      ADD CONSTRAINT "Customer_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Vehicle_organizationId_fkey'
  ) THEN
    ALTER TABLE "Vehicle"
      ADD CONSTRAINT "Vehicle_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Party_organizationId_fkey'
  ) THEN
    ALTER TABLE "Party"
      ADD CONSTRAINT "Party_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AppJsonRow_organizationId_fkey'
  ) THEN
    ALTER TABLE "AppJsonRow"
      ADD CONSTRAINT "AppJsonRow_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Customer_organizationId_idx" ON "Customer"("organizationId");
CREATE INDEX IF NOT EXISTS "Vehicle_organizationId_idx" ON "Vehicle"("organizationId");
CREATE INDEX IF NOT EXISTS "Party_organizationId_idx" ON "Party"("organizationId");
CREATE INDEX IF NOT EXISTS "AppJsonRow_organizationId_collection_idx" ON "AppJsonRow"("organizationId", "collection");
