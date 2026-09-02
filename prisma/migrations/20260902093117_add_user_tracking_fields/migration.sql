-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "updatedByUserId" TEXT;

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "updatedByUserId" TEXT;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "updatedByUserId" TEXT;

-- AlterTable
ALTER TABLE "Party" ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "updatedByUserId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "updatedByUserId" TEXT;

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "updatedByUserId" TEXT;
