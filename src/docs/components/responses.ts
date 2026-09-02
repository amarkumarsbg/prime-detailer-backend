import { ref } from "../helpers.js";

const errorEnvelope = {
  type: "object",
  required: ["data", "error"],
  properties: {
    data: { nullable: true, example: null },
    error: ref("ApiError"),
  },
};

export const responseComponents = {
  BadRequest: {
    description: "Validation failed or malformed request",
    content: { "application/json": { schema: errorEnvelope } },
  },
  Unauthorized: {
    description: "Missing, invalid, or expired authentication (code often UNAUTHORIZED).",
    content: {
      "application/json": {
        schema: errorEnvelope,
        example: {
          data: null,
          error: { message: "Authentication required.", code: "UNAUTHORIZED" },
        },
      },
    },
  },
  Forbidden: {
    description:
      "Authenticated but missing required permission/role, or workshop/export access denied. " +
      "Codes may include FORBIDDEN, ORG_INACTIVE, SUBSCRIPTION_EXPIRED, SUBSCRIPTION_TRIAL_ENDED, EXPORT_LOCKED.",
    content: {
      "application/json": {
        schema: errorEnvelope,
        example: {
          data: null,
          error: { message: "Insufficient permissions.", code: "FORBIDDEN" },
        },
      },
    },
  },
  NotFound: {
    description: "Resource not found",
    content: { "application/json": { schema: errorEnvelope } },
  },
  Conflict: {
    description: "Conflict (e.g. duplicate phone/email)",
    content: { "application/json": { schema: errorEnvelope } },
  },
  PayloadTooLarge: {
    description: "Request body exceeds server limit",
    content: { "application/json": { schema: errorEnvelope } },
  },
  ServiceUnavailable: {
    description: "Required integration not configured (email/SMS)",
    content: { "application/json": { schema: errorEnvelope } },
  },
  InternalError: {
    description: "Unexpected server error",
    content: { "application/json": { schema: errorEnvelope } },
  },
  ExportLocked: {
    description:
      "Data export is locked (subscription within 30 days of expiry, or past expiry). Code: EXPORT_LOCKED.",
    content: {
      "application/json": {
        schema: errorEnvelope,
        example: {
          data: null,
          error: {
            message: "Data export is locked until you renew your subscription.",
            code: "EXPORT_LOCKED",
          },
        },
      },
    },
  },
  WorkshopAccessDenied: {
    description:
      "Workshop access denied. Common codes: ORG_INACTIVE, SUBSCRIPTION_EXPIRED, SUBSCRIPTION_CANCELLED, SUBSCRIPTION_TRIAL_ENDED, SUBSCRIPTION_MISSING.",
    content: {
      "application/json": {
        schema: errorEnvelope,
        example: {
          data: null,
          error: {
            message: "Organization is inactive.",
            code: "ORG_INACTIVE",
          },
        },
      },
    },
  },
} as const;
