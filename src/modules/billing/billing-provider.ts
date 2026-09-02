import { AppHttpError } from "../../lib/app-http-error.js";
import type { BillingGatewayProvider, BillingGatewayProviderId } from "./billing-gateway.types.js";
import { mockBillingProvider } from "./providers/mock.provider.js";
import { razorpayBillingProvider } from "./providers/razorpay.provider.js";

/**
 * Resolve active SaaS billing provider.
 *
 * BILLING_GATEWAY_PROVIDER:
 * - mock | razorpay | none|off|disabled
 * - unset: razorpay when RAZORPAY_KEY_ID+SECRET present, else mock
 */
export function resolveBillingGatewayProviderId(): BillingGatewayProviderId | null {
  const raw = process.env.BILLING_GATEWAY_PROVIDER?.trim().toLowerCase();
  if (raw === "none" || raw === "off" || raw === "disabled" || raw === "false") {
    return null;
  }
  if (raw === "razorpay") return "RAZORPAY";
  if (raw === "mock") return "MOCK";

  const hasRzp =
    Boolean(process.env.RAZORPAY_KEY_ID?.trim()) &&
    Boolean(process.env.RAZORPAY_KEY_SECRET?.trim());
  return hasRzp ? "RAZORPAY" : "MOCK";
}

export function getBillingGatewayProvider(): BillingGatewayProvider {
  const id = resolveBillingGatewayProviderId();
  if (!id) {
    throw new AppHttpError(
      503,
      "Online subscription billing is disabled.",
      "BILLING_DISABLED"
    );
  }
  if (id === "RAZORPAY") return razorpayBillingProvider;
  return mockBillingProvider;
}

export function getBillingGatewayStatus(): {
  enabled: boolean;
  provider: BillingGatewayProviderId | null;
} {
  const provider = resolveBillingGatewayProviderId();
  return { enabled: provider != null, provider };
}
