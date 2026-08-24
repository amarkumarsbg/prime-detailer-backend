-- Add per-user payroll/attendance configuration
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "isAttendanceTracked" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "baseSalary" DOUBLE PRECISION;
