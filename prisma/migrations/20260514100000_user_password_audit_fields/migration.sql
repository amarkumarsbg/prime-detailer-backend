-- AlterTable
ALTER TABLE "User" ADD COLUMN "passwordCreatedBy" TEXT;
ALTER TABLE "User" ADD COLUMN "passwordUpdatedAt" TIMESTAMP(3);
