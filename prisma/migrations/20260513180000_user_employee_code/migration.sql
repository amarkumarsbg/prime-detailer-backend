-- AlterTable
ALTER TABLE "User" ADD COLUMN "employeeCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeCode_key" ON "User"("employeeCode");
