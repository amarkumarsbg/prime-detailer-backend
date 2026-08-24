-- CreateEnum
CREATE TYPE "PartyKind" AS ENUM ('CUSTOMER', 'SUPPLIER');

-- CreateEnum
CREATE TYPE "OpeningBalanceSide" AS ENUM ('TO_COLLECT', 'TO_PAY');

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,
    "kind" "PartyKind" NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "gstin" TEXT,
    "pan" TEXT,
    "billingAddress" TEXT,
    "shippingAddress" TEXT,
    "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "openingBalanceSide" "OpeningBalanceSide",
    "creditPeriodDays" INTEGER,
    "creditLimit" DOUBLE PRECISION,
    "contactPersonName" TEXT,
    "dateOfBirth" TEXT,
    "customerId" TEXT,
    "vendorKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyShippingAddress" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "state" TEXT,
    "pincode" TEXT,
    "city" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PartyShippingAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyBankAccount" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "ifsc" TEXT,
    "accountHolderName" TEXT,
    "bankName" TEXT,
    "branchName" TEXT,
    "upiId" TEXT,

    CONSTRAINT "PartyBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyCustomField" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "PartyCustomField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyHidden" (
    "partyId" TEXT NOT NULL,

    CONSTRAINT "PartyHidden_pkey" PRIMARY KEY ("partyId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Party_customerId_key" ON "Party"("customerId");

-- CreateIndex
CREATE INDEX "Party_kind_idx" ON "Party"("kind");

-- CreateIndex
CREATE INDEX "Party_vendorKey_idx" ON "Party"("vendorKey");

-- CreateIndex
CREATE INDEX "PartyShippingAddress_partyId_idx" ON "PartyShippingAddress"("partyId");

-- CreateIndex
CREATE INDEX "PartyBankAccount_partyId_idx" ON "PartyBankAccount"("partyId");

-- CreateIndex
CREATE INDEX "PartyCustomField_partyId_idx" ON "PartyCustomField"("partyId");

-- AddForeignKey
ALTER TABLE "PartyShippingAddress" ADD CONSTRAINT "PartyShippingAddress_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyBankAccount" ADD CONSTRAINT "PartyBankAccount_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyCustomField" ADD CONSTRAINT "PartyCustomField_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;
