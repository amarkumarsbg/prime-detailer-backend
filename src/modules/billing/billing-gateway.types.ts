/** Supported SaaS subscription billing providers (workshop invoice payments are separate). */
export type BillingGatewayProviderId = "MOCK" | "RAZORPAY";

export type CreateGatewayOrderInput = {
  paymentId: string;
  organizationId: string;
  amount: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
};

export type CreateGatewayOrderResult = {
  provider: BillingGatewayProviderId;
  orderId: string;
  amount: number;
  currency: string;
  /** Public key / publishable id for client SDKs (Razorpay key id). */
  publicKey?: string | null;
  /** Opaque token for mock confirm; not used by Razorpay. */
  confirmToken?: string | null;
};

export type GatewayWebhookParseResult = {
  paymentId: string;
  organizationId?: string;
  outcome: "PAID" | "FAILED";
  txnReference: string;
  orderId?: string | null;
  amount?: number | null;
};

export type RazorpayClientConfirmInput = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export interface BillingGatewayProvider {
  readonly id: BillingGatewayProviderId;
  createOrder(input: CreateGatewayOrderInput): Promise<CreateGatewayOrderResult>;
  /**
   * Verify provider-specific client confirmation (e.g. Razorpay checkout callback).
   * Mock uses confirmToken instead.
   */
  verifyClientConfirm?(
    orderId: string,
    payload: RazorpayClientConfirmInput
  ): Promise<{ ok: true; txnReference: string } | { ok: false; message: string }>;
  /**
   * Parse + authenticate an inbound webhook. Throws AppHttpError on bad signature.
   */
  parseWebhook?(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>
  ): Promise<GatewayWebhookParseResult>;
}
