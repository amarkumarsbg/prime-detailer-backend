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
    description: "Missing, invalid, or expired authentication",
    content: { "application/json": { schema: errorEnvelope } },
  },
  Forbidden: {
    description: "Authenticated but missing required permission/role",
    content: { "application/json": { schema: errorEnvelope } },
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
} as const;
