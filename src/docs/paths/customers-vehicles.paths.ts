import {
  bearerSecurity,
  commonErrorResponses,
  jsonBody,
  okResponse,
  permNote,
  ref,
  type OpenApiPaths,
} from "../helpers.js";

export const customerPaths: OpenApiPaths = {
  "/api/customers": {
    get: {
      tags: ["Customers"],
      summary: "List customers",
      description: permNote("CUSTOMERS"),
      security: bearerSecurity,
      responses: {
        "200": okResponse({
          type: "object",
          properties: {
            customers: { type: "array", items: ref("Customer") },
          },
        }),
        ...commonErrorResponses(),
      },
    },
    post: {
      tags: ["Customers"],
      summary: "Create customer",
      description: permNote("CUSTOMERS"),
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
      description: permNote("VEHICLES"),
      security: bearerSecurity,
      responses: {
        "200": okResponse({
          type: "object",
          properties: {
            vehicles: { type: "array", items: ref("Vehicle") },
          },
        }),
        ...commonErrorResponses(),
      },
    },
    post: {
      tags: ["Vehicles"],
      summary: "Create vehicle",
      description: permNote("VEHICLES"),
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
      description: permNote("VEHICLES"),
      security: bearerSecurity,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": okResponse(ref("OkOk")),
        ...commonErrorResponses(),
      },
    },
  },
};
