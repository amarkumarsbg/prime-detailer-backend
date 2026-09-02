import {
  bearerSecurity,
  commonErrorResponses,
  exportIntentParameters,
  jsonBody,
  okResponse,
  permNote,
  ref,
  workshopAccessNote,
  type OpenApiPaths,
} from "../helpers.js";

export const customerPaths: OpenApiPaths = {
  "/api/customers": {
    get: {
      tags: ["Customers"],
      summary: "List customers",
      description:
        permNote("CUSTOMERS", workshopAccessNote(
          "When `export`/`download`/`format=csv` or X-Export-Intent is set, enforces export lock (403 EXPORT_LOCKED)."
        )),
      security: bearerSecurity,
      parameters: [
        { name: "page", in: "query", schema: { type: "integer", default: 1 } },
        { name: "pageSize", in: "query", schema: { type: "integer", default: 10, enum: [10, 20, 50], maximum: 50 } },
        ...exportIntentParameters,
      ],
      responses: {
        "200": okResponse({
          type: "object",
          properties: {
            customers: { type: "array", items: ref("Customer") },
          },
        }),
        ...commonErrorResponses({
          "403": {
            description:
              "Workshop access denied (ORG_INACTIVE / SUBSCRIPTION_*) or EXPORT_LOCKED when export intent query/header is set.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { nullable: true },
                    error: ref("ApiError"),
                  },
                },
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
        }),
      },
    },
    post: {
      tags: ["Customers"],
      summary: "Create customer",
      description: permNote(
        "CUSTOMERS",
        workshopAccessNote("Enforces plan maxCustomers (403 CUSTOMER_LIMIT_REACHED).")
      ),
      security: bearerSecurity,
      requestBody: jsonBody({
        type: "object",
        required: ["name", "phone", "email", "address", "referralCode"],
        properties: {
          name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          address: { type: "string" },
          referralCode: { type: "string" },
          referredBy: { type: "string" },
          totalVisits: { type: "integer" },
          rewardPoints: { type: "integer" },
          walletBalance: { type: "number" },
          lastVisitDate: { type: "string" },
          notes: { type: "string" },
          isInactive: { type: "boolean" },
          emailVerified: { type: "boolean" },
        },
      }),
      responses: {
        "201": okResponse({
          type: "object",
          properties: { customer: ref("Customer") },
        }),
        "409": { $ref: "#/components/responses/Conflict" },
        ...commonErrorResponses(),
      },
    },
  },
  "/api/customers/bulk": {
    post: {
      tags: ["Customers"],
      summary: "Bulk create customers",
      description: permNote("CUSTOMERS", "Max 5000 items."),
      security: bearerSecurity,
      requestBody: jsonBody({
        type: "object",
        required: ["customers"],
        properties: {
          customers: {
            type: "array",
            minItems: 1,
            maxItems: 5000,
            items: {
              type: "object",
              required: ["name", "phone"],
              properties: {
                name: { type: "string" },
                phone: { type: "string" },
                email: { type: "string" },
                address: { type: "string" },
              },
            },
          },
        },
      }),
      responses: {
        "201": okResponse({ type: "object", additionalProperties: true }),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/customers/{id}": {
    get: {
      tags: ["Customers"],
      summary: "Get customer by id",
      description: permNote("CUSTOMERS"),
      security: bearerSecurity,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": okResponse({
          type: "object",
          properties: { customer: ref("Customer") },
        }),
        ...commonErrorResponses(),
      },
    },
    put: {
      tags: ["Customers"],
      summary: "Update customer",
      description: permNote("CUSTOMERS"),
      security: bearerSecurity,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: jsonBody({
        type: "object",
        additionalProperties: true,
        properties: {
          name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          address: { type: "string" },
          referralCode: { type: "string" },
          referredBy: { type: "string" },
          totalVisits: { type: "integer" },
          rewardPoints: { type: "integer" },
          walletBalance: { type: "number" },
          lastVisitDate: { type: "string" },
          notes: { type: "string" },
          isInactive: { type: "boolean" },
          emailVerified: { type: "boolean" },
        },
      }),
      responses: {
        "200": okResponse({
          type: "object",
          properties: { customer: ref("Customer") },
        }),
        "409": { $ref: "#/components/responses/Conflict" },
        ...commonErrorResponses(),
      },
    },
    delete: {
      tags: ["Customers"],
      summary: "Delete customer",
      description: permNote("CUSTOMERS"),
      security: bearerSecurity,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": okResponse(ref("OkOk")),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/customers/{id}/wallet": {
    patch: {
      tags: ["Customers"],
      summary: "Adjust customer wallet",
      description: permNote("CUSTOMERS"),
      security: bearerSecurity,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: jsonBody({
        type: "object",
        required: ["amount"],
        properties: {
          amount: { type: "number", minimum: 0, exclusiveMinimum: true },
          type: { type: "string", enum: ["CREDIT", "DEBIT"], default: "CREDIT" },
          reason: { type: "string", default: "Manual Adjustment" },
        },
      }),
      responses: {
        "200": okResponse({
          type: "object",
          properties: { customer: ref("Customer") },
        }),
        ...commonErrorResponses(),
      },
    },
  },
};

export const vehiclePaths: OpenApiPaths = {
  "/api/vehicles": {
    get: {
      tags: ["Vehicles"],
      summary: "List vehicles",
      description: permNote(
        "VEHICLES",
        workshopAccessNote(
          "Export intent query/header enforces export lock (403 EXPORT_LOCKED)."
        )
      ),
      security: bearerSecurity,
      parameters: [
        { name: "page", in: "query", schema: { type: "integer", default: 1 } },
        { name: "pageSize", in: "query", schema: { type: "integer", default: 10, enum: [10, 20, 50], maximum: 50 } },
        ...exportIntentParameters,
      ],
      responses: {
        "200": okResponse({
          type: "object",
          properties: {
            vehicles: { type: "array", items: ref("Vehicle") },
          },
        }),
        ...commonErrorResponses({
          "403": { $ref: "#/components/responses/ExportLocked" },
        }),
      },
    },
    post: {
      tags: ["Vehicles"],
      summary: "Create vehicle",
      description: permNote("VEHICLES", workshopAccessNote()),
      security: bearerSecurity,
      requestBody: jsonBody({ $ref: "#/components/schemas/Vehicle" }),
      responses: {
        "201": okResponse({
          type: "object",
          properties: { vehicle: ref("Vehicle") },
        }),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/vehicles/snapshot": {
    post: {
      tags: ["Vehicles"],
      summary: "Replace all vehicles (snapshot)",
      description: permNote("VEHICLES"),
      security: bearerSecurity,
      requestBody: jsonBody({
        type: "object",
        required: ["vehicles"],
        properties: {
          vehicles: { type: "array", items: ref("Vehicle") },
        },
      }),
      responses: {
        "200": okResponse(ref("OkOk")),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/vehicles/bulk": {
    post: {
      tags: ["Vehicles"],
      summary: "Bulk create vehicles",
      description: permNote("VEHICLES", "Max 5000 items."),
      security: bearerSecurity,
      requestBody: jsonBody({
        type: "object",
        required: ["vehicles"],
        properties: {
          vehicles: {
            type: "array",
            minItems: 1,
            maxItems: 5000,
            items: {
              type: "object",
              required: ["registrationNumber", "customerId", "customerName", "make", "model"],
              properties: {
                registrationNumber: { type: "string" },
                customerId: { type: "string" },
                customerName: { type: "string" },
                make: { type: "string" },
                model: { type: "string" },
                fuelType: { $ref: "#/components/schemas/FuelType" },
                segment: { $ref: "#/components/schemas/VehicleSegment" },
                year: { type: "integer" },
                color: { type: "string" },
                variant: { type: "string" },
                notes: { type: "string" },
              },
            },
          },
        },
      }),
      responses: {
        "201": okResponse({ type: "object", additionalProperties: true }),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/vehicles/{id}": {
    put: {
      tags: ["Vehicles"],
      summary: "Update vehicle",
      description: permNote("VEHICLES"),
      security: bearerSecurity,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: jsonBody({ type: "object", additionalProperties: true }),
      responses: {
        "200": okResponse({
          type: "object",
          properties: { vehicle: ref("Vehicle") },
        }),
        ...commonErrorResponses(),
      },
    },
    delete: {
      tags: ["Vehicles"],
      summary: "Delete vehicle",
      description: permNote("VEHICLES", workshopAccessNote()),
      security: bearerSecurity,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": okResponse(ref("OkOk")),
        ...commonErrorResponses(),
      },
    },
  },
};

/** Customer portal APIs — distinct from tenant staff `/api/customers` CRM. */
export const customerPortalPaths: OpenApiPaths = {
  "/api/auth/customer/login": {
    post: {
      tags: ["Customer Portal", "Auth"],
      summary: "Customer portal login",
      description:
        "Public. Authenticates a customer by phone + password. Requires active organization and workshop-allowed subscription " +
        "(ACTIVE / PAST_DUE / TRIAL). Returns a customer JWT (role CUSTOMER) scoped to that customer's organizationId and customerId.",
      security: [],
      requestBody: jsonBody({
        type: "object",
        required: ["phone", "password"],
        properties: {
          phone: { type: "string", example: "9876543210" },
          password: { type: "string", format: "password" },
        },
      }),
      responses: {
        "200": okResponse({
          type: "object",
          properties: {
            accessToken: { type: "string" },
            user: ref("Customer"),
          },
        }),
        ...commonErrorResponses({
          "401": { description: "Invalid phone or password" },
          "403": { $ref: "#/components/responses/WorkshopAccessDenied" },
        }),
      },
    },
  },
  "/api/auth/customer/me": {
    get: {
      tags: ["Customer Portal"],
      summary: "Current customer profile",
      description:
        "Customer JWT required (role CUSTOMER). Returns only the authenticated customer's own record. " +
        workshopAccessNote(),
      security: bearerSecurity,
      responses: {
        "200": okResponse({
          type: "object",
          properties: { user: ref("Customer") },
        }),
        ...commonErrorResponses({
          "403": { $ref: "#/components/responses/WorkshopAccessDenied" },
        }),
      },
    },
  },
  "/api/auth/customer/logout": {
    post: {
      tags: ["Customer Portal"],
      summary: "Customer logout",
      description: "Customer JWT. Client should discard the token; server acknowledges logout.",
      security: bearerSecurity,
      responses: {
        "200": okResponse(ref("OkOk")),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/auth/customer/set-password": {
    post: {
      tags: ["Customer Portal"],
      summary: "Customer change password",
      description: "Customer JWT + workshop access. Sets a new portal password.",
      security: bearerSecurity,
      requestBody: jsonBody({
        type: "object",
        required: ["currentPassword", "newPassword"],
        properties: {
          currentPassword: { type: "string", format: "password" },
          newPassword: { type: "string", format: "password", minLength: 6 },
        },
      }),
      responses: {
        "200": okResponse(ref("OkOk")),
        ...commonErrorResponses({
          "403": { $ref: "#/components/responses/WorkshopAccessDenied" },
        }),
      },
    },
  },
  "/api/customer/bootstrap": {
    get: {
      tags: ["Customer Portal", "Bootstrap"],
      summary: "Customer portal bootstrap",
      description:
        "Customer JWT + workshop access. Returns customer-scoped bootstrap payload (own data / rewards config). " +
        "Does not expose other customers or staff-only collections. " +
        workshopAccessNote(),
      security: bearerSecurity,
      responses: {
        "200": okResponse({ type: "object", additionalProperties: true }),
        ...commonErrorResponses({
          "403": { $ref: "#/components/responses/WorkshopAccessDenied" },
        }),
      },
    },
  },
};
