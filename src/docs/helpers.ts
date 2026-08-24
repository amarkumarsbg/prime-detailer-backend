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
