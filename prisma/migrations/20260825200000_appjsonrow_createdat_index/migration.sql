-- Performance: add createdAt to AppJsonRow for DB-level ordering and pagination.
-- This replaces the previous pattern of loading ALL rows into Node, sorting in JS.

-- Step 1: Add nullable column first (fast DDL, no table rewrite for nullable)
ALTER TABLE "AppJsonRow" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ;

-- Step 2: Backfill from payload.createdAt where the value is a valid ISO timestamp,
--         otherwise fall back to updatedAt (which is always present).
UPDATE "AppJsonRow"
SET "createdAt" = CASE
  WHEN
    (payload->>'createdAt') IS NOT NULL
    AND (payload->>'createdAt') ~ '^\d{4}-\d{2}-\d{2}'
  THEN
    (payload->>'createdAt')::TIMESTAMPTZ
  ELSE
    "updatedAt"
END
WHERE "createdAt" IS NULL;

-- Step 3: Make NOT NULL and set default for future inserts
ALTER TABLE "AppJsonRow" ALTER COLUMN "createdAt" SET DEFAULT NOW();
ALTER TABLE "AppJsonRow" ALTER COLUMN "createdAt" SET NOT NULL;

-- Step 4: Composite index for efficient list + pagination queries.
-- The existing @@index([organizationId, collection]) is kept; this adds createdAt for ORDER BY.
CREATE INDEX IF NOT EXISTS "AppJsonRow_org_col_created_idx"
  ON "AppJsonRow" ("organizationId", "collection", "createdAt" DESC);
