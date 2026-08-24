-- Relational appointment table (mirror of appointments collection payload)
CREATE TABLE IF NOT EXISTS "Appointment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "bookingId" TEXT,
  "appointmentNumber" TEXT,
  "kind" TEXT,
  "branchId" TEXT,
  "customerId" TEXT,
  "customerName" TEXT,
  "customerPhone" TEXT,
  "vehicleId" TEXT,
  "vehicleRegNumber" TEXT,
  "vehicleMakeModel" TEXT,
  "serviceType" TEXT,
  "mechanicId" TEXT,
  "mechanicName" TEXT,
  "date" TEXT,
  "time" TEXT,
  "status" TEXT,
  "jobCardId" TEXT,
  "notes" TEXT,
  "whatsappSent" BOOLEAN,
  "reminderSent" BOOLEAN,
  "priceGrandTotal" DOUBLE PRECISION,
  "advancePaid" DOUBLE PRECISION,
  "customerAddress" TEXT,
  "vehiclePickupRequired" BOOLEAN,
  "vehiclePickupStatus" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Appointment_organizationId_fkey'
  ) THEN
    ALTER TABLE "Appointment"
      ADD CONSTRAINT "Appointment_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Appointment_organizationId_date_idx"
  ON "Appointment"("organizationId", "date");
CREATE INDEX IF NOT EXISTS "Appointment_organizationId_branchId_idx"
  ON "Appointment"("organizationId", "branchId");
CREATE INDEX IF NOT EXISTS "Appointment_organizationId_customerId_idx"
  ON "Appointment"("organizationId", "customerId");
CREATE INDEX IF NOT EXISTS "Appointment_organizationId_vehicleId_idx"
  ON "Appointment"("organizationId", "vehicleId");
