/**
 * Dev/test SaaS billing provider — no external network.
 * Confirm with HMAC confirmToken from createOrder (or studio confirm endpoint).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { AppHttpError } from "../../../lib/app-http-error.js";
import type {
  BillingGatewayProvider,
  CreateGatewayOrderInput,
  CreateGatewayOrderResult,
  GatewayWebhookParseResult,
} from "../billing-gateway.types.js";

function webhookSecret(): string {
  const s =
    process.env.BILLING_WEBHOOK_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    "";
  if (!s) {
    throw new AppHttpError(
      503,
      "Billing mock provider requires BILLING_WEBHOOK_SECRET or JWT_SECRET.",
      "BILLING_MISCONFIGURED"
    );
  }
  return s;
}

export function mockConfirmToken(paymentId: string, orderId: string): string {
  return createHmac("sha256", webhookSecret())
    .update(`mock:${paymentId}:${orderId}`)
    .digest("hex");
}

export function verifyMockConfirmToken(
  paymentId: string,
  orderId: string,
  token: string
): boolean {
  const expected = mockConfirmToken(paymentId, orderId);
  const a = Buffer.from(expected);
  const b = Buffer.from(String(token || ""));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const mockBillingProvider: BillingGatewayProvider = {
  id: "MOCK",

  async createOrder(input: CreateGatewayOrderInput): Promise<CreateGatewayOrderResult> {
    const orderId = `mock_order_${input.paymentId}`;
    return {
      provider: "MOCK",
      orderId,
      amount: input.amount,
      currency: input.currency,
      publicKey: null,
      confirmToken: mockConfirmToken(input.paymentId, orderId),
    };
  },

  async parseWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>
  ): Promise<GatewayWebhookParseResult> {
    const sigHeader = headers["x-billing-signature"] ?? headers["X-Billing-Signature"];
    const sig = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
    const expected = createHmac("sha256", webhookSecret()).update(rawBody).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(String(sig || ""));
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new AppHttpError(401, "Invalid billing webhook signature.", "BILLING_WEBHOOK_INVALID");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody.toString("utf8"));
    } catch {
      throw new AppHttpError(400, "Invalid webhook JSON.", "VALIDATION");
    }
    const body = parsed as Record<string, unknown>;
    const paymentId = String(body.paymentId ?? "");
    const organizationId = body.organizationId ? String(body.organizationId) : undefined;
    const outcome = body.outcome === "FAILED" ? "FAILED" : "PAID";
    const txnReference = String(body.txnReference ?? `MOCK-${paymentId}`);
    const orderId = body.orderId ? String(body.orderId) : null;
    if (!paymentId) {
      throw new AppHttpError(400, "paymentId is required in webhook body.", "VALIDATION");
    }
    return {
      paymentId,
      organizationId,
      outcome,
      txnReference,
      orderId,
      amount: typeof body.amount === "number" ? body.amount : null,
    };
  },
};
