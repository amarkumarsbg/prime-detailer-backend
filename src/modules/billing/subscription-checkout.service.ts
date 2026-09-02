/**
 * SaaS subscription online checkout — creates a gateway order against a renewal
 * SubscriptionPayment, then completes via client confirm or webhook.
 *
 * Workshop invoice / cash-bank payments are intentionally separate.
 */
import { prisma } from "../../lib/prisma.js";
import { AppHttpError } from "../../lib/app-http-error.js";
import {
  getEntitlementForOrg,
  requestSubscriptionRenewal,
  verifySubscriptionPayment,
  type EntitlementPayload,
  type SubscriptionPaymentRow,
} from "../organization/organization-subscription.service.js";
import { getBillingGatewayProvider, getBillingGatewayStatus } from "./billing-provider.js";
import type {
  BillingGatewayProviderId,
  CreateGatewayOrderResult,
  RazorpayClientConfirmInput,
} from "./billing-gateway.types.js";
import { verifyMockConfirmToken } from "./providers/mock.provider.js";

export type CheckoutRenewOpts = {
  notes?: string;
  termMonths?: number;
  extraBranches?: number;
  extraUsers?: number;
  referralCode?: string | null;
  /** Reuse an existing PENDING payment instead of creating a new renew request. */
  paymentId?: string;
};

export type CheckoutPaymentView = SubscriptionPaymentRow & {
  gatewayProvider: string | null;
  gatewayOrderId: string | null;
};

export type SubscriptionCheckoutSession = {
  provider: BillingGatewayProviderId;
  payment: CheckoutPaymentView;
  order: CreateGatewayOrderResult;
  entitlement: EntitlementPayload;
};

function mapPaymentRow(p: {
  id: string;
  amount: number | null;
  currency: string;
  status: SubscriptionPaymentRow["status"];
  txnReference: string | null;
  method: string | null;
  notes: string | null;
  recordedBy: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
  gatewayProvider: string | null;
  gatewayOrderId: string | null;
}): CheckoutPaymentView {
  return {
    id: p.id,
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    txnReference: p.txnReference,
    method: p.method,
    notes: p.notes,
    recordedBy: p.recordedBy,
    verifiedAt: p.verifiedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    gatewayProvider: p.gatewayProvider,
    gatewayOrderId: p.gatewayOrderId,
  };
}

export async function createSubscriptionCheckout(
  organizationId: string,
  actorLabel: string,
  opts: CheckoutRenewOpts = {}
): Promise<SubscriptionCheckoutSession> {
  const provider = getBillingGatewayProvider();

  let paymentId = opts.paymentId?.trim();
  let payment;

  if (paymentId) {
    payment = await prisma.subscriptionPayment.findFirst({
      where: { id: paymentId, organizationId },
    });
    if (!payment) {
      throw new AppHttpError(404, "Payment not found", "PAYMENT_NOT_FOUND");
    }
    if (payment.status === "PAID") {
      throw new AppHttpError(409, "Payment is already paid.", "PAYMENT_ALREADY_PAID");
    }
    if (payment.status === "FAILED") {
      throw new AppHttpError(409, "Payment already failed; start a new renewal.", "PAYMENT_FAILED");
    }
  } else {
    const renew = await requestSubscriptionRenewal(organizationId, actorLabel, {
      notes: opts.notes ?? "Online checkout",
      method: `GATEWAY:${provider.id}`,
      termMonths: opts.termMonths,
      extraBranches: opts.extraBranches,
      extraUsers: opts.extraUsers,
      referralCode: opts.referralCode,
    });
    paymentId = renew.payment.id;
    payment = await prisma.subscriptionPayment.findUniqueOrThrow({
      where: { id: paymentId },
    });
  }

  const amount = payment.amount;
  if (amount == null || !(amount > 0)) {
    throw new AppHttpError(
      400,
      "Payment amount must be greater than zero for online checkout.",
      "VALIDATION"
    );
  }

  const order = await provider.createOrder({
    paymentId: payment.id,
    organizationId,
    amount,
    currency: payment.currency || "INR",
    receipt: payment.id,
    notes: { source: "saas-subscription" },
  });

  const updated = await prisma.subscriptionPayment.update({
    where: { id: payment.id },
    data: {
      status: "PROCESSING",
      method: `GATEWAY:${provider.id}`,
      gatewayProvider: provider.id,
      gatewayOrderId: order.orderId,
      recordedBy: actorLabel,
    },
  });

  await prisma.organizationSubscription.update({
    where: { organizationId },
    data: { paymentStatus: "PROCESSING" },
  });

  await prisma.platformAuditLog.create({
    data: {
      organizationId,
      actor: actorLabel,
      action: "subscription.checkout_created",
      before: { paymentId: payment.id, status: payment.status },
      after: {
        paymentId: payment.id,
        status: "PROCESSING",
        provider: provider.id,
        orderId: order.orderId,
        amount,
      },
    },
  });

  const entitlement = await getEntitlementForOrg(organizationId);
  if (!entitlement) {
    throw new AppHttpError(404, "Subscription not found", "SUBSCRIPTION_MISSING");
  }

  return {
    provider: provider.id,
    payment: mapPaymentRow(updated),
    order,
    entitlement,
  };
}

async function loadPaymentForComplete(opts: {
  paymentId?: string;
  organizationId?: string;
  orderId?: string | null;
}) {
  if (opts.paymentId) {
    const payment = await prisma.subscriptionPayment.findFirst({
      where: {
        id: opts.paymentId,
        ...(opts.organizationId ? { organizationId: opts.organizationId } : {}),
      },
    });
    if (!payment) {
      throw new AppHttpError(404, "Payment not found", "PAYMENT_NOT_FOUND");
    }
    return payment;
  }
  if (opts.orderId) {
    const payment = await prisma.subscriptionPayment.findFirst({
      where: {
        gatewayOrderId: opts.orderId,
        ...(opts.organizationId ? { organizationId: opts.organizationId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    if (!payment) {
      throw new AppHttpError(404, "Payment not found for gateway order", "PAYMENT_NOT_FOUND");
    }
    return payment;
  }
  throw new AppHttpError(400, "paymentId or orderId is required.", "VALIDATION");
}

/**
 * Complete a gateway payment (idempotent if already PAID).
 */
export async function completeSubscriptionGatewayPayment(opts: {
  paymentId?: string;
  organizationId?: string;
  orderId?: string | null;
  outcome: "PAID" | "FAILED";
  txnReference: string;
  amount?: number | null;
  actorLabel: string;
}): Promise<EntitlementPayload> {
  const payment = await loadPaymentForComplete(opts);

  if (payment.status === "PAID" && opts.outcome === "PAID") {
    const entitlement = await getEntitlementForOrg(payment.organizationId);
    if (!entitlement) {
      throw new AppHttpError(404, "Subscription not found", "SUBSCRIPTION_MISSING");
    }
    return entitlement;
  }

  return verifySubscriptionPayment(
    payment.organizationId,
    {
      paymentId: payment.id,
      outcome: opts.outcome,
      txnReference: opts.txnReference,
      amount: opts.amount,
      notes: `Gateway ${opts.outcome} via ${payment.gatewayProvider ?? "UNKNOWN"}`,
    },
    opts.actorLabel
  );
}

export type ConfirmCheckoutInput = {
  paymentId: string;
  /** Mock provider: HMAC token from checkout session. */
  confirmToken?: string;
  /** Razorpay checkout callback fields. */
  razorpay?: RazorpayClientConfirmInput;
  outcome?: "PAID" | "FAILED";
};

export async function confirmSubscriptionCheckout(
  organizationId: string,
  input: ConfirmCheckoutInput,
  actorLabel: string
): Promise<EntitlementPayload> {
  const payment = await prisma.subscriptionPayment.findFirst({
    where: { id: input.paymentId, organizationId },
  });
  if (!payment) {
    throw new AppHttpError(404, "Payment not found", "PAYMENT_NOT_FOUND");
  }
  if (payment.status === "PAID") {
    const entitlement = await getEntitlementForOrg(organizationId);
    if (!entitlement) {
      throw new AppHttpError(404, "Subscription not found", "SUBSCRIPTION_MISSING");
    }
    return entitlement;
  }

  const providerId = (payment.gatewayProvider ?? getBillingGatewayProvider().id) as BillingGatewayProviderId;
  const outcome = input.outcome === "FAILED" ? "FAILED" : "PAID";

  if (outcome === "FAILED") {
    return completeSubscriptionGatewayPayment({
      paymentId: payment.id,
      organizationId,
      outcome: "FAILED",
      txnReference: payment.txnReference ?? `FAILED-${payment.id}`,
      actorLabel,
    });
  }

  if (providerId === "MOCK") {
    const orderId = payment.gatewayOrderId ?? `mock_order_${payment.id}`;
    if (!input.confirmToken || !verifyMockConfirmToken(payment.id, orderId, input.confirmToken)) {
      throw new AppHttpError(401, "Invalid mock confirm token.", "BILLING_CONFIRM_INVALID");
    }
    return completeSubscriptionGatewayPayment({
      paymentId: payment.id,
      organizationId,
      outcome: "PAID",
      txnReference: `MOCK-${payment.id}`,
      amount: payment.amount,
      actorLabel,
    });
  }

  if (providerId === "RAZORPAY") {
    const provider = getBillingGatewayProvider();
    if (!payment.gatewayOrderId || !input.razorpay || !provider.verifyClientConfirm) {
      throw new AppHttpError(
        400,
        "Razorpay confirmation requires razorpay_order_id, razorpay_payment_id, razorpay_signature.",
        "VALIDATION"
      );
    }
    const verified = await provider.verifyClientConfirm(payment.gatewayOrderId, input.razorpay);
    if (!verified.ok) {
      throw new AppHttpError(401, verified.message, "BILLING_CONFIRM_INVALID");
    }
    return completeSubscriptionGatewayPayment({
      paymentId: payment.id,
      organizationId,
      outcome: "PAID",
      txnReference: verified.txnReference,
      amount: payment.amount,
      actorLabel,
    });
  }

  throw new AppHttpError(400, `Unsupported gateway provider: ${providerId}`, "VALIDATION");
}

export async function handleBillingWebhook(
  rawBody: Buffer,
  headers: Record<string, string | string[] | undefined>
): Promise<{ ok: true; entitlement: EntitlementPayload; paymentId: string }> {
  const status = getBillingGatewayStatus();
  if (!status.enabled || !status.provider) {
    throw new AppHttpError(503, "Online subscription billing is disabled.", "BILLING_DISABLED");
  }

  // Prefer provider matching X-Billing-Provider header; else active provider.
  const headerProvider = headers["x-billing-provider"] ?? headers["X-Billing-Provider"];
  const headerVal = Array.isArray(headerProvider) ? headerProvider[0] : headerProvider;
  const provider =
    String(headerVal || "").toUpperCase() === "MOCK"
      ? (await import("./providers/mock.provider.js")).mockBillingProvider
      : String(headerVal || "").toUpperCase() === "RAZORPAY"
        ? (await import("./providers/razorpay.provider.js")).razorpayBillingProvider
        : getBillingGatewayProvider();

  if (!provider.parseWebhook) {
    throw new AppHttpError(501, "Provider does not support webhooks.", "BILLING_WEBHOOK_UNSUPPORTED");
  }

  const parsed = await provider.parseWebhook(rawBody, headers);
  const entitlement = await completeSubscriptionGatewayPayment({
    paymentId: parsed.paymentId,
    organizationId: parsed.organizationId,
    orderId: parsed.orderId,
    outcome: parsed.outcome,
    txnReference: parsed.txnReference,
    amount: parsed.amount,
    actorLabel: `billing-webhook:${provider.id}`,
  });

  return { ok: true, entitlement, paymentId: parsed.paymentId };
}

export { getBillingGatewayStatus };
