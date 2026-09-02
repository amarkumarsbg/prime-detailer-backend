/**
 * Small OpenAPI path helpers — keep path modules concise and consistent.
 */

export type OpenApiPathItem = Record<string, unknown>;
export type OpenApiPaths = Record<string, OpenApiPathItem>;

export const bearerSecurity = [{ BearerAuth: [] }];
export const platformSecurity = [{ BearerAuth: [] }, { PlatformAdminKey: [] }];

export function ref(name: string) {
  return { $ref: `#/components/schemas/${name}` };
}

export function responseRef(name: string) {
  return { $ref: `#/components/responses/${name}` };
}

export function jsonContent(schema: Record<string, unknown>) {
  return { content: { "application/json": { schema } } };
}

export function jsonBody(schema: Record<string, unknown>, required = true) {
  return {
    required,
    content: { "application/json": { schema } },
  };
}

export function envelopeData(schema: Record<string, unknown>) {
  return {
    type: "object",
    required: ["data", "error"],
    properties: {
      data: schema,
      error: { nullable: true, allOf: [ref("ApiError")] },
    },
  };
}

export function okResponse(dataSchema: Record<string, unknown>, description = "Success") {
  return {
    description,
    ...jsonContent(envelopeData(dataSchema)),
  };
}

export function commonErrorResponses(extra?: Record<string, unknown>) {
  return {
    "400": responseRef("BadRequest"),
    "401": responseRef("Unauthorized"),
    "403": responseRef("Forbidden"),
    "404": responseRef("NotFound"),
    "500": responseRef("InternalError"),
    ...extra,
  };
}

export function permNote(permission: string, extras?: string): string {
  const base = `Requires JWT Bearer auth and permission \`${permission}\` (SUPER_ADMIN bypasses permission checks).`;
  return extras ? `${base} ${extras}` : base;
}

/** Shared copy for routes behind `requireWorkshopAccess`. */
export function workshopAccessNote(extras?: string): string {
  const base =
    "Workshop access required: organization must be active and subscription status must be ACTIVE, PAST_DUE, or TRIAL (with trialEndsAt still in the future). " +
    "Denied responses use 403 with codes such as ORG_INACTIVE, SUBSCRIPTION_EXPIRED, SUBSCRIPTION_CANCELLED, or SUBSCRIPTION_TRIAL_ENDED. " +
    "Organization context comes from the authenticated identity — do not send organizationId as a trusted security parameter.";
  return extras ? `${base} ${extras}` : base;
}

/** Query/header flags that trigger export-lock enforcement on list endpoints. */
export const exportIntentParameters = [
  {
    name: "export",
    in: "query",
    required: false,
    schema: { type: "string", enum: ["1", "true"] },
    description: "When set, enforces export lock (403 EXPORT_LOCKED if locked).",
  },
  {
    name: "download",
    in: "query",
    required: false,
    schema: { type: "string", enum: ["1", "true"] },
    description: "Alias for export intent.",
  },
  {
    name: "format",
    in: "query",
    required: false,
    schema: { type: "string", enum: ["csv", "xlsx", "json-export"] },
    description: "Treated as export intent when csv/xlsx/json-export.",
  },
  {
    name: "X-Export-Intent",
    in: "header",
    required: false,
    schema: { type: "string", enum: ["1", "true"] },
    description: "Header form of export intent.",
  },
] as const;
