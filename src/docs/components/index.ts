import { schemaComponents } from "./schemas.js";
import { responseComponents } from "./responses.js";

export const openApiComponents = {
  securitySchemes: {
    BearerAuth: {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      description:
        "JWT from staff login (`POST /api/auth/login` / OTP), customer portal login (`POST /api/auth/customer/login`), or PLATFORM_OWNER session. " +
        "Click Authorize and paste the token only (no `Bearer ` prefix). Tenant organization context is taken from the token — do not send organizationId as a trusted security parameter.",
    },
    PlatformAdminKey: {
      type: "apiKey",
      in: "header",
      name: "X-Platform-Admin-Key",
      description:
        "SaaS platform admin key for `/api/platform/*`. Alternative to a PLATFORM_OWNER JWT. Never commit real keys.",
    },
    InternalJobKey: {
      type: "apiKey",
      in: "header",
      name: "X-Internal-Job-Key",
      description:
        "Internal cron/job secret for `/api/jobs/*`. Set via `INTERNAL_JOB_SECRET` env var. Never commit real keys.",
    },
  },
  schemas: schemaComponents,
  responses: responseComponents,
} as const;
