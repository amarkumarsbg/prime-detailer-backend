import {
  bearerSecurity,
  commonErrorResponses,
  jsonBody,
  okResponse,
  permNote,
  ref,
  type OpenApiPaths,
} from "../helpers.js";

export const userPaths: OpenApiPaths = {
  "/api/users": {
    get: {
      tags: ["Users", "Staff"],
      summary: "List staff users",
      description: `${permNote("STAFF")} Additional role gate: staff manager roles only. Org + branch scoped.`,
      security: bearerSecurity,
      responses: {
        "200": okResponse({
          type: "object",
          properties: {
            users: { type: "array", items: ref("User") },
          },
        }),
        ...commonErrorResponses(),
      },
    },
    post: {
      tags: ["Users", "Staff"],
      summary: "Create staff user",
      description: `${permNote("STAFF")} Only Super Admin / Admin can create; role assignment is further restricted.`,
      security: bearerSecurity,
      requestBody: jsonBody({
        type: "object",
        required: ["id", "name", "email", "phone", "role", "branchId"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          email: { type: "string", format: "email" },
          phone: { type: "string" },
          role: {
            type: "string",
            enum: [
              "SUPER_ADMIN",
              "ADMIN",
              "BRANCH_MANAGER",
              "MANAGER",
              "SUPERVISOR",
              "RECEPTIONIST",
              "MECHANIC",
            ],
          },
          branchId: { type: "string" },
          password: {
            type: "string",
            format: "password",
            description: "Optional; strong password policy when provided. Never returned in responses.",
          },
          avatar: { type: "string", nullable: true },
          isActive: { type: "boolean" },
          emailVerified: { type: "boolean" },
          attendancePin: { type: "string", nullable: true },
          permissions: {
            type: "array",
            items: { $ref: "#/components/schemas/PermissionKey" },
          },
        },
      }),
      responses: {
        "201": okResponse({ type: "object", additionalProperties: true }),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/users/directory": {
    get: {
      tags: ["Users", "Staff"],
      summary: "Staff directory (sanitized)",
      description:
        "Requires JWT and any of: STAFF, JOB_CARDS, APPOINTMENTS, PICKUP_DROP, ATTENDANCE, BOOKINGS, PAYROLL, MECHANICS. " +
        "Returns id/name/role/branchId/isActive/avatar only — no permissions, attendancePin, or email.",
      security: bearerSecurity,
      responses: {
        "200": okResponse({
          type: "object",
          properties: {
            users: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  role: { type: "string" },
                  branchId: { type: "string" },
                  organizationId: { type: "string" },
                  isActive: { type: "boolean" },
                  avatar: { type: "string" },
                },
              },
            },
          },
        }),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/users/{id}": {
    put: {
      tags: ["Users", "Staff"],
      summary: "Update staff user",
      description: permNote("STAFF"),
      security: bearerSecurity,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: jsonBody({ type: "object", additionalProperties: true }),
      responses: {
        "200": okResponse({
          type: "object",
          properties: { user: ref("User") },
        }),
        ...commonErrorResponses(),
      },
    },
  },
};

export const branchPaths: OpenApiPaths = {
  "/api/branches": {
    get: {
      tags: ["Branches"],
      summary: "List branches",
      description: permNote("BRANCHES"),
      security: bearerSecurity,
      responses: {
        "200": okResponse({
          type: "object",
          properties: {
            branches: { type: "array", items: ref("Branch") },
          },
        }),
        ...commonErrorResponses(),
      },
    },
    post: {
      tags: ["Branches"],
      summary: "Create branch",
      description: `${permNote("BRANCHES")} Mutation roles: SUPER_ADMIN, ADMIN, BRANCH_MANAGER (see rbac). Subject to SaaS maxBranches.`,
      security: bearerSecurity,
      requestBody: jsonBody({
        type: "object",
        required: ["id", "name", "address", "phone"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          address: { type: "string" },
          phone: { type: "string", pattern: "^\\d{10}$" },
          isActive: { type: "boolean" },
          qrCodeId: { type: "string", nullable: true },
          code: { type: "string", nullable: true },
          city: { type: "string", nullable: true },
          state: { type: "string", nullable: true },
          pincode: { type: "string", nullable: true },
          email: { type: "string", nullable: true },
          managerName: { type: "string", nullable: true },
          managerPhone: { type: "string", nullable: true },
        },
      }),
      responses: {
        "201": okResponse({
          type: "object",
          properties: { branch: ref("Branch") },
        }),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/branches/{id}": {
    put: {
      tags: ["Branches"],
      summary: "Update branch",
      description: permNote("BRANCHES"),
      security: bearerSecurity,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: jsonBody({ type: "object", additionalProperties: true }),
      responses: {
        "200": okResponse({
          type: "object",
          properties: { branch: ref("Branch") },
        }),
        ...commonErrorResponses(),
      },
    },
    delete: {
      tags: ["Branches"],
      summary: "Delete branch",
      description: permNote("BRANCHES"),
      security: bearerSecurity,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": okResponse(ref("OkOk")),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/branches/{id}/deletion-check": {
    get: {
      tags: ["Branches"],
      summary: "Check whether a branch can be deleted",
      description: permNote("BRANCHES"),
      security: bearerSecurity,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": okResponse({ type: "object", additionalProperties: true }),
        ...commonErrorResponses(),
      },
    },
  },
};

export const partyPaths: OpenApiPaths = {
  "/api/parties": {
    get: {
      tags: ["Parties"],
      summary: "List parties",
      description: permNote("PARTIES", "Optional `balance=1` includes computed balances."),
      security: bearerSecurity,
      parameters: [
        {
          name: "balance",
          in: "query",
          schema: { type: "string", enum: ["1", "true"] },
        },
      ],
      responses: {
        "200": okResponse({
          type: "object",
          properties: {
            parties: { type: "array", items: ref("Party") },
          },
        }),
        ...commonErrorResponses(),
      },
    },
    post: {
      tags: ["Parties"],
      summary: "Create party",
      description: permNote("PARTIES"),
      security: bearerSecurity,
      requestBody: jsonBody({
        type: "object",
        required: ["name", "kind"],
        properties: {
          name: { type: "string" },
          kind: { type: "string", enum: ["customer", "supplier"] },
          category: { type: "string" },
          mobile: { type: "string" },
          email: { type: "string" },
          gstin: { type: "string" },
          pan: { type: "string" },
          billingAddress: { type: "string" },
          shippingAddress: { type: "string" },
          openingBalance: { type: "number" },
          openingBalanceSide: { type: "string", enum: ["toCollect", "toPay"] },
          creditPeriodDays: { type: "integer" },
          creditLimit: { type: "number" },
          contactPersonName: { type: "string" },
          dateOfBirth: { type: "string" },
          customerId: { type: "string" },
          vendorKey: { type: "string" },
          bankAccounts: { type: "array", items: { type: "object" } },
          shippingAddresses: { type: "array", items: { type: "object" } },
          customFields: { type: "array", items: { type: "object" } },
        },
        additionalProperties: true,
      }),
      responses: {
        "201": okResponse({
          type: "object",
          properties: { party: ref("Party") },
        }),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/parties/{id}": {
    get: {
      tags: ["Parties"],
      summary: "Get party",
      description: permNote("PARTIES"),
      security: bearerSecurity,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": okResponse({
          type: "object",
          properties: { party: ref("Party") },
        }),
        ...commonErrorResponses(),
      },
    },
    put: {
      tags: ["Parties"],
      summary: "Update party",
      description: permNote("PARTIES"),
      security: bearerSecurity,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: jsonBody({ type: "object", additionalProperties: true }),
      responses: {
        "200": okResponse({
          type: "object",
          properties: { party: ref("Party") },
        }),
        ...commonErrorResponses(),
      },
    },
    delete: {
      tags: ["Parties"],
      summary: "Hide/delete party",
      description: permNote("PARTIES"),
      security: bearerSecurity,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": okResponse(ref("OkOk")),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/parties/{id}/ledger": {
    get: {
      tags: ["Parties"],
      summary: "Party ledger",
      description: permNote("PARTIES"),
      security: bearerSecurity,
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
        {
          name: "period",
          in: "query",
          schema: { type: "string", default: "last365" },
        },
      ],
      responses: {
        "200": okResponse({ type: "object", additionalProperties: true }),
        ...commonErrorResponses(),
      },
    },
  },
};
