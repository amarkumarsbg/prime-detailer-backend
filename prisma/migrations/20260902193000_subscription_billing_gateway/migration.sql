-- SaaS online billing gateway fields on subscription payments (workshop invoice payments unchanged)
ALTER TABLE "SubscriptionPayment" ADD COLUMN "gatewayProvider" TEXT;
ALTER TABLE "SubscriptionPayment" ADD COLUMN "gatewayOrderId" TEXT;

CREATE INDEX "SubscriptionPayment_gatewayOrderId_idx" ON "SubscriptionPayment"("gatewayOrderId");
