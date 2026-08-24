import {
  bearerSecurity,
  commonErrorResponses,
  jsonBody,
  okResponse,
  ref,
  type OpenApiPaths,
} from "../helpers.js";

export const authPaths: OpenApiPaths = {
  "/api/auth/login": {
    post: {
      tags: ["Auth"],
      summary: "Password login",
      description: "Public. Returns JWT + user + branch.",
      security: [],
      requestBody: jsonBody({
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", format: "password" },
        },
      }),
      responses: {
        "200": okResponse(ref("AuthSuccess")),
        ...commonErrorResponses({
          "401": { description: "Invalid email or password" },
        }),
      },
    },
  },
  "/api/auth/otp/send": {
    post: {
      tags: ["Auth"],
      summary: "Send login OTP (SMS)",
      description: "Public. Sends OTP to an active staff phone (10 digits).",
      security: [],
      requestBody: jsonBody({
        type: "object",
        required: ["phone"],
        properties: { phone: { type: "string", pattern: "^\\d{10}$" } },
      }),
      responses: {
        "200": okResponse({ type: "object", additionalProperties: true }),
        ...commonErrorResponses({
          "404": { description: "No active user for phone" },
          "503": { $ref: "#/components/responses/ServiceUnavailable" },
        }),
      },
    },
  },
  "/api/auth/otp/verify": {
    post: {
      tags: ["Auth"],
      summary: "Verify login OTP",
      description: "Public. Returns the same AuthSuccess envelope as password login.",
      security: [],
      requestBody: jsonBody({
        type: "object",
        required: ["phone", "code"],
        properties: {
          phone: { type: "string", pattern: "^\\d{10}$" },
          code: { type: "string", minLength: 4, maxLength: 16 },
        },
      }),
      responses: {
        "200": okResponse(ref("AuthSuccess")),
        ...commonErrorResponses({
          "401": { description: "Invalid or expired OTP" },
        }),
      },
    },
  },
  "/api/auth/forgot-password": {
    post: {
      tags: ["Auth"],
      summary: "Request password reset email",
      description:
        "Public. Always returns a generic success message (does not reveal whether the email exists).",
      security: [],
      requestBody: jsonBody({
        type: "object",
        required: ["email"],
        properties: { email: { type: "string", format: "email" } },
      }),
      responses: {
        "200": okResponse({ type: "object", additionalProperties: true }),
        "503": { $ref: "#/components/responses/ServiceUnavailable" },
        ...commonErrorResponses(),
      },
    },
  },
  "/api/auth/reset-password/status": {
    get: {
      tags: ["Auth"],
      summary: "Check reset token validity",
      description: "Public. Query `token` — whether a reset can still complete once.",
      security: [],
      parameters: [
        {
          name: "token",
          in: "query",
          required: true,
          schema: { type: "string", minLength: 24 },
        },
      ],
      responses: {
        "200": okResponse({
          type: "object",
          properties: { pending: { type: "boolean" } },
        }),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/auth/reset-password": {
    post: {
      tags: ["Auth"],
      summary: "Complete password reset",
      security: [],
      requestBody: jsonBody({
        type: "object",
        required: ["token", "password"],
        properties: {
          token: { type: "string", minLength: 24 },
          password: {
            type: "string",
            format: "password",
            description: "Strong password policy applies",
          },
        },
      }),
      responses: {
        "200": okResponse({ type: "object", additionalProperties: true }),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/auth/change-password": {
    post: {
      tags: ["Auth"],
      summary: "Change password (authenticated)",
      description: "Requires JWT. Returns refreshed AuthSuccess.",
      security: bearerSecurity,
      requestBody: jsonBody({
        type: "object",
        required: ["currentPassword", "newPassword"],
        properties: {
          currentPassword: { type: "string", format: "password" },
          newPassword: { type: "string", format: "password" },
        },
      }),
      responses: {
        "200": okResponse(ref("AuthSuccess")),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/auth/me": {
    get: {
      tags: ["Auth"],
      summary: "Current user session payload",
      security: bearerSecurity,
      responses: {
        "200": okResponse({ type: "object", additionalProperties: true }),
        ...commonErrorResponses(),
      },
    },
    patch: {
      tags: ["Auth"],
      summary: "Update own profile (name/avatar)",
      security: bearerSecurity,
      requestBody: jsonBody({
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", minLength: 1 },
          avatar: { type: "string", nullable: true, maxLength: 4096 },
        },
      }),
      responses: {
        "200": okResponse(ref("AuthSuccess")),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/auth/me/report-favourites": {
    get: {
      tags: ["Auth"],
      summary: "List favourite report hrefs for the current user",
      security: bearerSecurity,
      responses: {
        "200": okResponse({
          type: "object",
          properties: {
            hrefs: { type: "array", items: { type: "string" } },
          },
        }),
        ...commonErrorResponses(),
      },
    },
    put: {
      tags: ["Auth"],
      summary: "Replace favourite report hrefs for the current user",
      security: bearerSecurity,
      requestBody: jsonBody({
        type: "object",
        required: ["hrefs"],
        properties: {
          hrefs: { type: "array", items: { type: "string" }, maxItems: 200 },
        },
      }),
      responses: {
        "200": okResponse({
          type: "object",
          properties: {
            hrefs: { type: "array", items: { type: "string" } },
          },
        }),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/auth/me/avatar": {
    post: {
      tags: ["Auth"],
      summary: "Upload own avatar image",
      description: "multipart field `avatar` (image file).",
      security: bearerSecurity,
      requestBody: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: {
              type: "object",
              required: ["avatar"],
              properties: { avatar: { type: "string", format: "binary" } },
            },
          },
        },
      },
      responses: {
        "200": okResponse(ref("AuthSuccess")),
        ...commonErrorResponses(),
      },
    },
  },
};

export const healthPaths: OpenApiPaths = {
  "/": {
    get: {
      tags: ["Health"],
      summary: "API root metadata",
      security: [],
      responses: {
        "200": {
          description: "Service identity + endpoint hints",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  ok: { type: "boolean" },
                  name: { type: "string" },
                  hint: { type: "string" },
                  frontend: { type: "string" },
                  endpoints: { type: "object" },
                },
              },
            },
          },
        },
      },
    },
  },
  "/health": {
    get: {
      tags: ["Health"],
      summary: "Liveness",
      security: [],
      responses: {
        "200": {
          description: "OK",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { ok: { type: "boolean" } },
              },
            },
          },
        },
      },
    },
  },
  "/api/health": {
    get: {
      tags: ["Health"],
      summary: "Liveness (API prefix alias)",
      description: "Same as `GET /health`.",
      security: [],
      responses: {
        "200": {
          description: "OK",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { ok: { type: "boolean" } },
              },
            },
          },
        },
      },
    },
  },
  "/health/db": {
    get: {
      tags: ["Health"],
      summary: "Database connectivity",
      security: [],
      responses: {
        "200": {
          description: "DB up",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  ok: { type: "boolean" },
                  database: { type: "string" },
                },
              },
            },
          },
        },
        "500": { $ref: "#/components/responses/InternalError" },
      },
    },
  },
  "/api/health/db": {
    get: {
      tags: ["Health"],
      summary: "Database connectivity (API prefix alias)",
      description: "Same as `GET /health/db`.",
      security: [],
      responses: {
        "200": {
          description: "DB up",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  ok: { type: "boolean" },
                  database: { type: "string" },
                },
              },
            },
          },
        },
        "500": { $ref: "#/components/responses/InternalError" },
      },
    },
  },
};

export const publicPaths: OpenApiPaths = {
  "/api/public/invoices/{id}": {
    get: {
      tags: ["Public"],
      summary: "Public invoice view",
      description: "No auth. Customer-facing invoice payload by id.",
      security: [],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": okResponse({ type: "object", additionalProperties: true }),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/public/branding": {
    get: {
      tags: ["Public"],
      summary: "Public branding assets",
      security: [],
      responses: {
        "200": okResponse({ type: "object", additionalProperties: true }),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/public/attendance/context": {
    get: {
      tags: ["Attendance"],
      summary: "Public attendance QR context",
      description: "No auth. Staff scan branch QR on personal phones.",
      security: [],
      parameters: [
        { name: "branchId", in: "query", required: true, schema: { type: "string" } },
        { name: "qr", in: "query", required: false, schema: { type: "string" } },
      ],
      responses: {
        "200": okResponse({ type: "object", additionalProperties: true }),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/public/attendance/resolve-pin": {
    post: {
      tags: ["Attendance"],
      summary: "Resolve staff by attendance PIN",
      security: [],
      requestBody: jsonBody({
        type: "object",
        required: ["branchId", "pin"],
        properties: {
          branchId: { type: "string" },
          pin: { type: "string" },
        },
      }),
      responses: {
        "200": okResponse({ type: "object", additionalProperties: true }),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/public/attendance/punch": {
    post: {
      tags: ["Attendance"],
      summary: "Public check-in / check-out punch",
      security: [],
      requestBody: jsonBody({
        type: "object",
        required: ["staffId", "branchId"],
        properties: {
          staffId: { type: "string" },
          branchId: { type: "string" },
          clientLocalDate: { type: "string" },
          clientLocalTime: { type: "string" },
        },
      }),
      responses: {
        "200": okResponse({ type: "object", additionalProperties: true }),
        ...commonErrorResponses(),
      },
    },
  },
};
