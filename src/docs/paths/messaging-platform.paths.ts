import {
  bearerSecurity,
  commonErrorResponses,
  exportIntentParameters,
  jsonBody,
  okResponse,
  permNote,
  platformSecurity,
  ref,
  workshopAccessNote,
  type OpenApiPaths,
} from "../helpers.js";

const termMonthsSchema = {
  type: "integer",
  enum: [12, 24, 36, 60],
  description: "Subscription term in months.",
};

export const messagingPaths: OpenApiPaths = {
  "/api/messaging/sms/test": {
    post: {
      tags: ["Messaging"],
      summary: "Send test SMS",
      description: permNote(
        "SETTINGS",
        workshopAccessNote(
          "Uses org messaging settings when configured; otherwise platform TWILIO_* env. Fixed server test body."
        )
      ),
      security: bearerSecurity,
      requestBody: jsonBody({
        type: "object",
        required: ["phone"],
        properties: {
          phone: { type: "string", minLength: 8, maxLength: 32 },
        },
      }),
      responses: {
        "200": okResponse({ type: "object", additionalProperties: true }),
        "503": { $ref: "#/components/responses/ServiceUnavailable" },
        ...commonErrorResponses(),
      },
    },
  },
  "/api/messaging/whatsapp/test": {
    post: {
      tags: ["Messaging"],
      summary: "Send test WhatsApp",
      description: permNote(
        "SETTINGS",
        workshopAccessNote(
          "Uses org messaging settings when configured; otherwise platform TWILIO_* env. Fixed server test body."
        )
      ),
      security: bearerSecurity,
      requestBody: jsonBody({
        type: "object",
        required: ["phone"],
        properties: {
          phone: { type: "string", minLength: 8, maxLength: 32 },
        },
      }),
      responses: {
        "200": okResponse({ type: "object", additionalProperties: true }),
        "503": { $ref: "#/components/responses/ServiceUnavailable" },
        ...commonErrorResponses(),
      },
    },
  },
  "/api/messaging/whatsapp": {
    post: {
      tags: ["Messaging"],
      summary: "Send transactional WhatsApp",
      description: workshopAccessNote(
        "Tenant JWT. Provide exactly one of `message` or `contentSid`. Org-scoped Twilio credentials when set; else platform env."
      ),
      security: bearerSecurity,
      requestBody: jsonBody({
        type: "object",
        required: ["phone"],
        properties: {
          phone: { type: "string", minLength: 8, maxLength: 32 },
          message: { type: "string", maxLength: 16384 },
          contentSid: { type: "string" },
          contentVariables: {
            type: "object",
            additionalProperties: { type: "string" },
          },
        },
      }),
      responses: {
        "200": okResponse({ type: "object", additionalProperties: true }),
        "503": { $ref: "#/components/responses/ServiceUnavailable" },
        ...commonErrorResponses(),
      },
    },
  },
  "/api/messaging/email": {
    post: {
      tags: ["Messaging", "Billing"],
      summary: "Send transactional email (e.g. invoice)",
      description: workshopAccessNote(
        "Tenant JWT. Uses Resend. Org resendApiKey/mailFrom when set; else platform RESEND_API_KEY / MAIL_FROM. Attachments are base64 (do not paste secrets)."
      ),
      security: bearerSecurity,
      requestBody: jsonBody({
        type: "object",
        required: ["to", "subject", "html"],
        properties: {
          to: { type: "string", format: "email" },
          subject: { type: "string", maxLength: 200 },
          html: { type: "string" },
          text: { type: "string" },
          attachments: {
            type: "array",
            maxItems: 5,
            items: {
              type: "object",
              required: ["filename", "content"],
              properties: {
                filename: { type: "string" },
                content: { type: "string", description: "Base64 file content" },
              },
            },
          },
        },
      }),
      responses: {
        "200": okResponse({ type: "object", additionalProperties: true }),
        "413": { $ref: "#/components/responses/PayloadTooLarge" },
        "503": { $ref: "#/components/responses/ServiceUnavailable" },
        ...commonErrorResponses(),
      },
    },
  },
};

export const attendancePaths: OpenApiPaths = {
  "/api/attendance": {
    get: {
      tags: ["Attendance"],
      summary: "List attendance records",
      description: permNote("ATTENDANCE"),
      security: bearerSecurity,
      parameters: [
        {
          name: "branchId",
          in: "query",
          schema: { type: "string" },
        },
      ],
      responses: {
        "200": okResponse({
          type: "object",
          properties: {
            records: {
              type: "array",
              items: ref("AttendanceRecord"),
            },
          },
        }),
        ...commonErrorResponses(),
      },
    },
    delete: {
      tags: ["Attendance"],
      summary: "Reset all attendance records",
      description: permNote("ATTENDANCE", "Destructive admin reset."),
      security: bearerSecurity,
      responses: {
        "200": okResponse({
          type: "object",
          properties: {
            ok: { type: "boolean" },
            records: { type: "array", items: {} },
          },
        }),
        ...commonErrorResponses(),
      },
    },
  },
};

export const bootstrapPaths: OpenApiPaths = {
  "/api/bootstrap": {
    get: {
      tags: ["Bootstrap"],
      summary: "Shell bootstrap (thin)",
      description:
        "Requires JWT. Intentionally available when workshop access is locked so owners can renew. " +
        "Returns org-scoped branches, public branding (from appSettings), and subscription entitlement. " +
        "Does **not** return customers, vehicles, users, payroll, cash/bank, or other domain collections — load those via permission-scoped entity/collection APIs. " +
        "Organization context comes from the authenticated identity.",
      security: bearerSecurity,
      responses: {
        "200": okResponse({
          type: "object",
          properties: {
            branches: { type: "array", items: { type: "object", additionalProperties: true } },
            branding: {
              type: "object",
              description: "Public branding fields only (no bank/GST/PAN secrets)",
              additionalProperties: { type: "string" },
            },
            entitlement: { type: "object", additionalProperties: true, nullable: true },
          },
          required: ["branches", "branding"],
        }),
        ...commonErrorResponses(),
      },
    },
  },
};

export const organizationPaths: OpenApiPaths = {
  "/api/organization/subscription": {
    get: {
      tags: ["Organization", "Subscriptions"],
      summary: "Studio subscription entitlement",
      description:
        "Requires tenant JWT. Returns entitlement for the caller's organization (from auth identity — do not send organizationId). " +
        "Includes trial fields (trialEndsAt, isTrial), usage (branches/users/customers), canCreateBranch / canCreateCustomer / canExportData. " +
        "This route intentionally remains available when workshop access is locked so tenants can renew.",
      security: bearerSecurity,
      responses: {
        "200": okResponse(ref("EntitlementPayload"), "Entitlement for caller organization"),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/organization/subscription/pricing": {
    post: {
      tags: ["Organization", "Subscriptions"],
      summary: "Get subscription pricing quote",
      description:
        "Returns a pricing quote for the given plan term and add-ons. Does not create a renewal. Requires tenant JWT. Available during export/workshop lock for renewals.",
      security: bearerSecurity,
      requestBody: jsonBody({
        type: "object",
        required: ["termMonths"],
        properties: {
          termMonths: termMonthsSchema,
          extraBranches: { type: "integer", minimum: 0, default: 0 },
          extraUsers: { type: "integer", minimum: 0, default: 0 },
          referralCode: { type: "string", nullable: true, maxLength: 32 },
        },
      }),
      responses: {
        "200": okResponse({
          type: "object",
          properties: { breakdown: { type: "object", additionalProperties: true } },
        }),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/organization/subscription/renew": {
    post: {
      tags: ["Organization", "Subscriptions"],
      summary: "Submit subscription renewal request",
      description:
        "Creates a PENDING SaaS subscription payment for the caller's organization. Platform verify-payment / mark-paid or online checkout completes it. Available when workshop is locked so tenants can renew.",
      security: bearerSecurity,
      requestBody: jsonBody(
        {
          type: "object",
          properties: {
            termMonths: { ...termMonthsSchema },
            extraBranches: { type: "integer", minimum: 0 },
            extraUsers: { type: "integer", minimum: 0 },
            referralCode: { type: "string", nullable: true, maxLength: 32 },
            method: { type: "string", maxLength: 64 },
            notes: { type: "string", maxLength: 500 },
          },
        },
        false
      ),
      responses: {
        "200": okResponse({
          type: "object",
          properties: {
            entitlement: ref("EntitlementPayload"),
            payment: ref("SubscriptionPayment"),
          },
        }),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/organization/subscription/billing-status": {
    get: {
      tags: ["Organization", "Subscriptions"],
      summary: "Online SaaS billing gateway status",
      description:
        "Returns whether online subscription checkout is enabled and which provider (MOCK | RAZORPAY). Workshop invoice payments are unrelated.",
      security: bearerSecurity,
      responses: {
        "200": okResponse({
          type: "object",
          properties: {
            enabled: { type: "boolean" },
            provider: { type: "string", nullable: true, enum: ["MOCK", "RAZORPAY"] },
          },
        }),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/organization/subscription/checkout": {
    post: {
      tags: ["Organization", "Subscriptions"],
      summary: "Start online SaaS subscription checkout",
      description:
        "Creates (or reuses) a renewal payment and a gateway order. Confirm via /checkout/confirm or /api/public/billing/webhook.",
      security: bearerSecurity,
      requestBody: jsonBody(
        {
          type: "object",
          properties: {
            termMonths: termMonthsSchema,
            extraBranches: { type: "integer", minimum: 0 },
            extraUsers: { type: "integer", minimum: 0 },
            referralCode: { type: "string", nullable: true, maxLength: 32 },
            notes: { type: "string", maxLength: 500 },
            paymentId: { type: "string" },
          },
        },
        false
      ),
      responses: {
        "201": okResponse({
          type: "object",
          properties: {
            provider: { type: "string", enum: ["MOCK", "RAZORPAY"] },
            payment: ref("SubscriptionPayment"),
            order: { type: "object", additionalProperties: true },
            entitlement: ref("EntitlementPayload"),
          },
        }),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/organization/subscription/checkout/confirm": {
    post: {
      tags: ["Organization", "Subscriptions"],
      summary: "Confirm online SaaS checkout",
      description:
        "Mock: send confirmToken from checkout. Razorpay: send razorpay_order_id, razorpay_payment_id, razorpay_signature. Idempotent if already PAID.",
      security: bearerSecurity,
      requestBody: jsonBody({
        type: "object",
        required: ["paymentId"],
        properties: {
          paymentId: { type: "string" },
          confirmToken: { type: "string" },
          outcome: { type: "string", enum: ["PAID", "FAILED"] },
          razorpay_order_id: { type: "string" },
          razorpay_payment_id: { type: "string" },
          razorpay_signature: { type: "string" },
        },
      }),
      responses: {
        "200": okResponse(ref("EntitlementPayload")),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/organization/subscription/bills": {
    get: {
      tags: ["Organization", "Subscriptions"],
      summary: "List subscription bills",
      description: "SaaS subscription bills for the caller's organization (not workshop invoices).",
      security: bearerSecurity,
      responses: {
        "200": okResponse({
          type: "object",
          properties: {
            bills: { type: "array", items: ref("SubscriptionBill") },
          },
        }),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/organization/subscription/bills/{billId}": {
    get: {
      tags: ["Organization", "Subscriptions"],
      summary: "Get a single subscription bill",
      security: bearerSecurity,
      parameters: [
        { name: "billId", in: "path", required: true, schema: { type: "string" } },
      ],
      responses: {
        "200": okResponse(ref("SubscriptionBill")),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/organization/subscription/renewals": {
    get: {
      tags: ["Organization", "Subscriptions"],
      summary: "List subscription renewal history",
      security: bearerSecurity,
      responses: {
        "200": okResponse({
          type: "object",
          properties: {
            renewals: { type: "array", items: { type: "object", additionalProperties: true } },
          },
        }),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/organization/export/check": {
    get: {
      tags: ["Exports", "Organization"],
      summary: "Check export access / lock status",
      description:
        "Requires tenant JWT. Returns canExportData / exportLocked based on subscription end date " +
        "(locked when ≤30 days remain or past expiry). Also returns storageKeyPrefix for this org.",
      security: bearerSecurity,
      responses: {
        "200": okResponse(ref("ExportCheckResponse")),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/organization/export/customers": {
    post: {
      tags: ["Exports", "Organization"],
      summary: "Export all customers (JSON)",
      description:
        "Requires tenant JWT. Enforces export lock — returns 403 EXPORT_LOCKED when locked. " +
        "Organization scope from auth identity.",
      security: bearerSecurity,
      responses: {
        "200": okResponse({
          type: "object",
          properties: {
            exportedAt: { type: "string", format: "date-time" },
            customers: { type: "array", items: ref("Customer") },
          },
        }),
        ...commonErrorResponses({
          "403": { $ref: "#/components/responses/ExportLocked" },
        }),
      },
    },
  },
  "/api/organization/export/collections/{collection}": {
    post: {
      tags: ["Exports", "Organization"],
      summary: "Export an AppJsonRow array collection",
      description:
        "Requires tenant JWT. Enforces export lock. `collection` must be a registered array collection (e.g. jobCards, invoices).",
      security: bearerSecurity,
      parameters: [
        {
          name: "collection",
          in: "path",
          required: true,
          schema: ref("CollectionName"),
        },
      ],
      responses: {
        "200": okResponse({
          type: "object",
          properties: {
            collection: { type: "string" },
            exportedAt: { type: "string", format: "date-time" },
            items: { type: "array", items: { type: "object", additionalProperties: true } },
          },
        }),
        ...commonErrorResponses({
          "403": { $ref: "#/components/responses/ExportLocked" },
        }),
      },
    },
  },
  "/api/organization/messaging-settings": {
    get: {
      tags: ["Messaging", "Settings", "Organization"],
      summary: "Get organization messaging settings",
      description:
        "Requires tenant JWT. Returns redacted org overrides plus resolved capability flags. " +
        "Secrets (auth tokens, API keys) are never returned — only `*Set` booleans. " +
        "When org fields are unset, platform TWILIO_* / RESEND_* / MAIL_FROM env credentials are used.",
      security: bearerSecurity,
      responses: {
        "200": okResponse({
          type: "object",
          properties: {
            settings: ref("MessagingSettingsPublic"),
            resolved: ref("MessagingSettingsResolved"),
          },
        }),
        ...commonErrorResponses(),
      },
    },
    patch: {
      tags: ["Messaging", "Settings", "Organization"],
      summary: "Update organization messaging settings",
      description:
        permNote(
          "SETTINGS",
          "Org-scoped overrides for Twilio/Resend. Empty string clears a field. Unset fields continue to fall back to platform env. Response never includes secret values."
        ),
      security: bearerSecurity,
      requestBody: jsonBody(
        {
          type: "object",
          properties: {
            twilioAccountSid: { type: "string", nullable: true, maxLength: 64 },
            twilioAuthToken: { type: "string", nullable: true, maxLength: 128 },
            twilioApiKeySid: { type: "string", nullable: true, maxLength: 64 },
            twilioApiKeySecret: { type: "string", nullable: true, maxLength: 128 },
            twilioFromNumber: { type: "string", nullable: true, maxLength: 32, example: "+15551234567" },
            twilioWhatsappFrom: {
              type: "string",
              nullable: true,
              maxLength: 48,
              example: "whatsapp:+14155238886",
            },
            twilioToNumberPrefix: { type: "string", nullable: true, maxLength: 8, example: "+91" },
            resendApiKey: { type: "string", nullable: true, maxLength: 128 },
            mailFrom: {
              type: "string",
              nullable: true,
              maxLength: 200,
              example: "Acme Detailing <noreply@example.com>",
            },
          },
        },
        false
      ),
      responses: {
        "200": okResponse({
          type: "object",
          properties: {
            settings: ref("MessagingSettingsPublic"),
            resolved: ref("MessagingSettingsResolved"),
          },
        }),
        ...commonErrorResponses(),
      },
    },
  },
};

export const platformPaths: OpenApiPaths = {
  "/api/platform/organizations/provision": {
    post: {
      tags: ["SaaS Admin", "Organizations"],
      summary: "Provision a new tenant organization",
      description:
        "Platform auth only (PLATFORM_OWNER JWT or X-Platform-Admin-Key). Transactionally creates Organization + HQ Branch + SUPER_ADMIN owner + STARTER subscription. " +
        "organizationId is **not** accepted from the client — server generates ids. " +
        "Default subscription: status ACTIVE, paymentStatus PENDING. With startTrial=true: status TRIAL + trialEndsAt. " +
        "Response never includes password, hash, JWT, or API keys.",
      security: platformSecurity,
      requestBody: jsonBody(ref("ProvisionOrganizationRequest")),
      responses: {
        "201": okResponse(ref("ProvisionOrganizationResponse"), "Tenant provisioned"),
        "409": { $ref: "#/components/responses/Conflict" },
        ...commonErrorResponses(),
      },
    },
  },
  "/api/platform/organizations": {
    get: {
      tags: ["SaaS Admin"],
      summary: "List all organizations (platform)",
      description:
        "Requires PLATFORM_OWNER JWT **or** `X-Platform-Admin-Key`. Studio SUPER_ADMIN is not sufficient.",
      security: platformSecurity,
      responses: {
        "200": okResponse({
          type: "object",
          properties: {
            organizations: {
              type: "array",
              items: ref("EntitlementPayload"),
            },
          },
        }),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/platform/organizations/{orgId}": {
    get: {
      tags: ["SaaS Admin", "Organizations"],
      summary: "Get organization entitlement (platform)",
      description: "PLATFORM_OWNER JWT or X-Platform-Admin-Key. Returns EntitlementPayload for the org.",
      security: platformSecurity,
      parameters: [
        { name: "orgId", in: "path", required: true, schema: { type: "string" } },
      ],
      responses: {
        "200": okResponse(ref("EntitlementPayload")),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/platform/organizations/{orgId}/subscription": {
    patch: {
      tags: ["SaaS Admin", "Subscriptions"],
      summary: "Patch organization subscription",
      description: "PLATFORM_OWNER JWT or X-Platform-Admin-Key. Updates plan/limits/CTAs/status/trialEndsAt.",
      security: platformSecurity,
      parameters: [
        { name: "orgId", in: "path", required: true, schema: { type: "string" } },
      ],
      requestBody: jsonBody({
        type: "object",
        properties: {
          planCode: ref("PlanCode"),
          planName: { type: "string" },
          status: ref("SubscriptionStatus"),
          limits: ref("PlanLimits"),
          maxBranchesOverride: { type: "integer", nullable: true },
          maxUsersOverride: { type: "integer", nullable: true },
          contactUsUrl: { type: "string", nullable: true },
          contactPhone: { type: "string", nullable: true },
          upgradeUrl: { type: "string", nullable: true },
          termMonths: termMonthsSchema,
          startsAt: { type: "string", format: "date-time", nullable: true },
          expiresAt: { type: "string", format: "date-time", nullable: true },
          trialEndsAt: { type: "string", format: "date-time", nullable: true },
          paymentStatus: ref("SubscriptionPaymentStatus"),
          lastPaymentTxnId: { type: "string", nullable: true },
        },
      }),
      responses: {
        "200": okResponse(ref("EntitlementPayload")),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/platform/organizations/{orgId}/subscription/verify-payment": {
    post: {
      tags: ["SaaS Admin"],
      summary: "Verify subscription payment (platform)",
      description:
        "Records the outcome of a payment attempt for a pending subscription bill. " +
        "Use `outcome: 'PAID'` to activate the subscription, or `'FAILED'` to mark it as failed. " +
        "Requires PLATFORM_OWNER JWT **or** `X-Platform-Admin-Key`.",
      security: platformSecurity,
      parameters: [
        { name: "orgId", in: "path", required: true, schema: { type: "string" }, description: "Organization ID." },
      ],
      requestBody: jsonBody({
        type: "object",
        required: ["paymentId", "outcome"],
        properties: {
          paymentId: { type: "string", minLength: 1, description: "The payment/bill ID to verify." },
          outcome: { type: "string", enum: ["PAID", "FAILED"], description: "Result of the payment." },
          txnReference: { type: "string", nullable: true, description: "External transaction reference (e.g. gateway txn ID)." },
          amount: { type: "number", minimum: 0, nullable: true, description: "Amount received." },
          notes: { type: "string", nullable: true, description: "Internal notes." },
        },
      }),
      responses: {
        "200": okResponse(ref("EntitlementPayload"), "Updated entitlement record."),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/platform/organizations/{orgId}/subscription/mark-paid": {
    post: {
      tags: ["SaaS Admin"],
      summary: "Manually mark subscription as paid (platform)",
      description:
        "Admin shortcut to mark an organization's subscription as paid without a formal payment verification flow. " +
        "Creates a renewal record and activates the entitlement. " +
        "Requires PLATFORM_OWNER JWT **or** `X-Platform-Admin-Key`.",
      security: platformSecurity,
      parameters: [
        { name: "orgId", in: "path", required: true, schema: { type: "string" }, description: "Organization ID." },
      ],
      requestBody: jsonBody(
        {
          type: "object",
          properties: {
            txnReference: { type: "string", nullable: true, description: "External transaction reference." },
            amount: { type: "number", minimum: 0, nullable: true, description: "Amount paid." },
            termMonths: { ...termMonthsSchema, description: "Term to activate. Defaults to 12." },
            notes: { type: "string", nullable: true, description: "Internal admin notes." },
          },
        },
        false
      ),
      responses: {
        "200": okResponse(ref("EntitlementPayload"), "Updated entitlement record."),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/platform/organizations/{orgId}/subscription/convert-trial": {
    post: {
      tags: ["SaaS Admin", "Subscriptions"],
      summary: "Convert TRIAL subscription to ACTIVE paid term",
      description:
        "Platform auth only. Converts TRIAL → ACTIVE, clears trialEndsAt, sets expiresAt/currentPeriodEnd from termMonths (from now). " +
        "paymentStatus stays PENDING unless markPaid=true. Optional planCode upgrade at convert time. " +
        "Rejects non-trial subscriptions.",
      security: platformSecurity,
      parameters: [
        { name: "orgId", in: "path", required: true, schema: { type: "string" } },
      ],
      requestBody: jsonBody(
        {
          type: "object",
          properties: {
            termMonths: termMonthsSchema,
            planCode: ref("PlanCode"),
            markPaid: {
              type: "boolean",
              description: "When true, sets paymentStatus PAID. Default false keeps PENDING.",
              example: false,
            },
          },
          example: { termMonths: 12, planCode: "GROWTH", markPaid: false },
        },
        false
      ),
      responses: {
        "200": okResponse(ref("EntitlementPayload")),
        ...commonErrorResponses(),
      },
    },
  },
};

/** Internal/cron job endpoints. */
export const jobsPaths: OpenApiPaths = {
  "/api/jobs/reminders/process": {
    post: {
      tags: ["Jobs"],
      summary: "Process service/payment reminder WhatsApp messages",
      description:
        "Daily cron endpoint. Scans all service reminders and pending invoices across all orgs " +
        "(or a single org when `organizationId` is provided) and sends WhatsApp notifications via Twilio. " +
        "\n\n**Auth:** `X-Internal-Job-Key: $INTERNAL_JOB_SECRET` header **or** a valid Bearer JWT " +
        "(org-scoped, for single-org use). This endpoint is not for studio users.",
      security: [{ InternalJobKey: [] }, { BearerAuth: [] }],
      requestBody: jsonBody(
        {
          type: "object",
          properties: {
            organizationId: {
              type: "string",
              description: "When provided with a job-secret, limits processing to a single organization. Ignored when using a JWT (already org-scoped).",
            },
          },
        },
        false
      ),
      responses: {
        "200": okResponse({
          type: "object",
          description: "Summary of processed reminders per organization.",
          additionalProperties: true,
        }),
        ...commonErrorResponses(),
      },
    },
  },
};

const orgIdParam = { name: "orgId", in: "path", required: true, schema: { type: "string" }, description: "Organization ID." };
const crossOrgPageParams = [
  { name: "page", in: "query", schema: { type: "integer", default: 1 } },
  { name: "limit", in: "query", schema: { type: "integer", default: 100, maximum: 200 } },
];
const crossOrgDateFilters = [
  { name: "since", in: "query", schema: { type: "string", format: "date-time" } },
  { name: "until", in: "query", schema: { type: "string", format: "date-time" } },
];

export const platformExtPaths: OpenApiPaths = {
  "/api/platform/renewals": {
    get: {
      tags: ["SaaS Admin"],
      summary: "List renewal history across all organizations",
      security: platformSecurity,
      parameters: [
        ...crossOrgPageParams,
        ...crossOrgDateFilters,
        { name: "orgId", in: "query", schema: { type: "string" } },
        { name: "paymentStatus", in: "query", schema: { type: "string", enum: ["PAID","PENDING","PROCESSING","FAILED"] } },
      ],
      responses: {
        "200": okResponse({ type: "object", required: ["renewals"], properties: { renewals: { type: "array", items: { type: "object", additionalProperties: true } }, total: { type: "integer" } } }),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/platform/bills": {
    get: {
      tags: ["SaaS Admin"],
      summary: "List subscription bills across all organizations",
      security: platformSecurity,
      parameters: [
        ...crossOrgPageParams,
        ...crossOrgDateFilters,
        { name: "orgId", in: "query", schema: { type: "string" } },
        { name: "search", in: "query", schema: { type: "string" } },
        { name: "paymentStatus", in: "query", schema: { type: "string", enum: ["PAID","PENDING","PROCESSING","FAILED"] } },
      ],
      responses: {
        "200": okResponse({ type: "object", required: ["bills"], properties: { bills: { type: "array", items: { type: "object", additionalProperties: true } }, total: { type: "integer" } } }),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/platform/payments": {
    get: {
      tags: ["SaaS Admin"],
      summary: "List subscription payments across all organizations",
      security: platformSecurity,
      parameters: [
        ...crossOrgPageParams,
        ...crossOrgDateFilters,
        { name: "orgId", in: "query", schema: { type: "string" } },
        { name: "status", in: "query", schema: { type: "string", enum: ["PAID","PENDING","PROCESSING","FAILED"] } },
      ],
      responses: {
        "200": okResponse({ type: "object", required: ["payments"], properties: { payments: { type: "array", items: { type: "object", additionalProperties: true } }, total: { type: "integer" } } }),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/platform/audit": {
    get: {
      tags: ["SaaS Admin"],
      summary: "List platform audit log entries",
      security: platformSecurity,
      parameters: [
        ...crossOrgPageParams,
        ...crossOrgDateFilters,
        { name: "orgId", in: "query", schema: { type: "string" } },
        { name: "action", in: "query", schema: { type: "string" }, description: "Partial match on action name." },
      ],
      responses: {
        "200": okResponse({ type: "object", required: ["logs"], properties: { logs: { type: "array", items: { type: "object", additionalProperties: true } }, total: { type: "integer" } } }),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/platform/referrals": {
    get: {
      tags: ["SaaS Admin"],
      summary: "List platform subscription referral codes",
      security: platformSecurity,
      parameters: [
        { name: "showInactive", in: "query", schema: { type: "boolean" } },
      ],
      responses: {
        "200": okResponse({ type: "object", required: ["referralCodes"], properties: { referralCodes: { type: "array", items: { type: "object", additionalProperties: true } } } }),
        ...commonErrorResponses(),
      },
    },
    post: {
      tags: ["SaaS Admin"],
      summary: "Create a platform subscription referral code",
      security: platformSecurity,
      requestBody: jsonBody({ type: "object", required: ["code"], properties: { code: { type: "string", minLength: 4, maxLength: 24, pattern: "^[A-Z0-9-]+$" }, discountAmount: { type: "number", minimum: 0, default: 1000 }, notes: { type: "string" } } }),
      responses: {
        "201": okResponse({ type: "object", additionalProperties: true }),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/platform/organizations/{orgId}/suspend": {
    post: {
      tags: ["SaaS Admin", "Organizations"],
      summary: "Suspend organization",
      description:
        "Platform auth. Sets subscription status CANCELLED and organization.isActive=false. Blocks workshop access (403 ORG_INACTIVE / SUBSCRIPTION_CANCELLED).",
      security: platformSecurity,
      parameters: [orgIdParam],
      requestBody: jsonBody({ type: "object", required: ["reason"], properties: { reason: { type: "string", minLength: 1, maxLength: 500 } } }),
      responses: {
        "200": okResponse({ type: "object", properties: { suspended: { type: "boolean" }, reason: { type: "string" } } }),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/platform/organizations/{orgId}/restore": {
    post: {
      tags: ["SaaS Admin", "Organizations"],
      summary: "Restore suspended organization",
      description:
        "Platform auth. Sets subscription status ACTIVE and organization.isActive=true.",
      security: platformSecurity,
      parameters: [orgIdParam],
      requestBody: jsonBody({ type: "object", properties: { reason: { type: "string", maxLength: 500 } } }, false),
      responses: {
        "200": okResponse({ type: "object", properties: { restored: { type: "boolean" } } }),
        ...commonErrorResponses(),
      },
    },
  },
};
