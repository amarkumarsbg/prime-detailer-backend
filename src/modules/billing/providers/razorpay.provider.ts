/**
 * Razorpay SaaS subscription checkout (Orders API + payment signature).
 * Uses fetch — no razorpay npm dependency.
 * Amounts are converted to paise (smallest currency unit) for INR.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { AppHttpError } from "../../../lib/app-http-error.js";
import type {
  BillingGatewayProvider,
  CreateGatewayOrderInput,
  CreateGatewayOrderResult,
  GatewayWebhookParseResult,
  RazorpayClientConfirmInput,
} from "../billing-gateway.types.js";

function requireRazorpayKeys(): { keyId: string; keySecret: string } {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim() ?? "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() ?? "";
  if (!keyId || !keySecret) {
    throw new AppHttpError(
      503,
      "Razorpay is not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).",
      "BILLING_MISCONFIGURED"
    );
  }
  return { keyId, keySecret };
}

function webhookSecret(): string {
  return (
    process.env.RAZORPAY_WEBHOOK_SECRET?.trim() ||
    process.env.BILLING_WEBHOOK_SECRET?.trim() ||
    ""
  );
}

/** Razorpay expects integer amount in the smallest currency unit. */
export function toRazorpayAmount(amount: number, currency: string): number {
  const c = currency.toUpperCase();
  if (c === "INR" || c === "USD" || c === "EUR") {
    return Math.round(amount * 100);
  }
  return Math.round(amount * 100);
}

function fromRazorpayAmount(amount: number, currency: string): number {
  const c = currency.toUpperCase();
  if (c === "INR" || c === "USD" || c === "EUR") {
    return amount / 100;
  }
  return amount / 100;
}

function basicAuthHeader(keyId: string, keySecret: string): string {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export const razorpayBillingProvider: BillingGatewayProvider = {
  id: "RAZORPAY",

  async createOrder(input: CreateGatewayOrderInput): Promise<CreateGatewayOrderResult> {
    const { keyId, keySecret } = requireRazorpayKeys();
    const amount = toRazorpayAmount(input.amount, input.currency);
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(keyId, keySecret),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        currency: input.currency.toUpperCase(),
        receipt: input.receipt.slice(0, 40),
        notes: {
          paymentId: input.paymentId,
          organizationId: input.organizationId,
          ...(input.notes ?? {}),
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new AppHttpError(
        502,
        `Razorpay order creation failed (${res.status}).`,
        "BILLING_PROVIDER_ERROR",
        { providerBody: text.slice(0, 400) }
      );
    }

    const data = (await res.json()) as { id: string; amount: number; currency: string };
    return {
      provider: "RAZORPAY",
      orderId: data.id,
      amount: fromRazorpayAmount(data.amount, data.currency),
      currency: data.currency,
      publicKey: keyId,
      confirmToken: null,
    };
  },

  async verifyClientConfirm(orderId: string, payload: RazorpayClientConfirmInput) {
    const { keySecret } = requireRazorpayKeys();
    if (payload.razorpay_order_id !== orderId) {
      return { ok: false as const, message: "Order id mismatch." };
    }
    const body = `${payload.razorpay_order_id}|${payload.razorpay_payment_id}`;
    const expected = createHmac("sha256", keySecret).update(body).digest("hex");
    if (!safeEqualHex(expected, payload.razorpay_signature)) {
      return { ok: false as const, message: "Invalid Razorpay signature." };
    }
    return { ok: true as const, txnReference: payload.razorpay_payment_id };
  },

  async parseWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>
  ): Promise<GatewayWebhookParseResult> {
    const secret = webhookSecret();
    if (!secret) {
      throw new AppHttpError(
        503,
        "Razorpay webhook secret not configured.",
        "BILLING_MISCONFIGURED"
      );
    }
    const sigHeader = headers["x-razorpay-signature"] ?? headers["X-Razorpay-Signature"];
    const sig = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    if (!sig || !safeEqualHex(expected, sig)) {
      throw new AppHttpError(401, "Invalid Razorpay webhook signature.", "BILLING_WEBHOOK_INVALID");
    }

    let event: Record<string, unknown>;
    try {
      event = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;
    } catch {
      throw new AppHttpError(400, "Invalid webhook JSON.", "VALIDATION");
    }

    const eventName = String(event.event ?? "");
    const payload = (event.payload ?? {}) as Record<string, unknown>;
    const paymentEntity = ((payload.payment as Record<string, unknown> | undefined)?.entity ??
      {}) as Record<string, unknown>;
    const notes = (paymentEntity.notes ?? {}) as Record<string, unknown>;
    const paymentId = String(notes.paymentId ?? "");
    const organizationId = notes.organizationId ? String(notes.organizationId) : undefined;
    const orderId = paymentEntity.order_id ? String(paymentEntity.order_id) : null;
    const txnReference = paymentEntity.id ? String(paymentEntity.id) : `rzp-${Date.now()}`;
    const amountPaise = typeof paymentEntity.amount === "number" ? paymentEntity.amount : null;
    const currency = String(paymentEntity.currency ?? "INR");

    if (!paymentId) {
      throw new AppHttpError(
        400,
        "Webhook payment notes.paymentId missing — order must be created by this API.",
        "VALIDATION"
      );
    }

    const failed =
      eventName.includes("failed") ||
      String(paymentEntity.status ?? "").toLowerCase() === "failed";

    return {
      paymentId,
      organizationId,
      outcome: failed ? "FAILED" : "PAID",
      txnReference,
      orderId,
      amount: amountPaise != null ? fromRazorpayAmount(amountPaise, currency) : null,
    };
  },
};
