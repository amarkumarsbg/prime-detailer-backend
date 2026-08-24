import {
  bearerSecurity,
  commonErrorResponses,
  jsonBody,
  okResponse,
  permNote,
  ref,
  type OpenApiPaths,
} from "../helpers.js";

const collectionParam = {
  name: "collection",
  in: "path",
  required: true,
  schema: { $ref: "#/components/schemas/CollectionName" },
  description:
    "JSON document collection (LEGACY gateway). Permission is mapped per collection (see collection-permissions).",
};

const collectionsLegacyNote =
  "**LEGACY** generic AppJsonRow gateway — kept for frontend compatibility. " +
  "Domain modules (job cards, billing, quotations) are owned in `backend/docs/MODULE_OWNERSHIP.md`; " +
  "studio FE uses dedicated `/api/job-cards`, `/api/invoices`, `/api/quotations` for those three (Phase 4). " +
  "Create/update is via PUT upsert; arrays support snapshot + DELETE; singletons use entityId `default` and cannot DELETE. " +
  "No GET-by-id route. See `backend/docs/CRUD_AND_ACTIONS.md`.";


export const collectionPaths: OpenApiPaths = {
  "/api/collections/appSettings/logo": {
    post: {
      tags: ["Settings"],
      summary: "Upload business logo",
      description: `${permNote("SETTINGS")} multipart field \`logo\`.`,
      security: bearerSecurity,
      requestBody: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: {
              type: "object",
              required: ["logo"],
              properties: { logo: { type: "string", format: "binary" } },
            },
          },
        },
      },
      responses: {
        "200": okResponse({
          type: "object",
          properties: { url: { type: "string" } },
        }),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/collections/{collection}": {
    get: {
      tags: [
        "Collections",
        "Job Cards",
        "Billing",
        "Appointments",
        "Bookings",
        "Pickup/Drop",
        "Services",
        "Inventory",
        "Reports",
        "Settings",
      ],
      summary: "List collection items (legacy gateway)",
      description:
        `${collectionsLegacyNote} ` +
        "Array collections return all items; singletons return the singleton document(s). " +
        "Permissions vary by collection (e.g. jobCards→JOB_CARDS, invoices→BILLING, appointments→APPOINTMENTS, pickupDropRequests→PICKUP_DROP, appSettings→SETTINGS). " +
        "See schemas JobCard, Invoice, Quotation, Appointment/Booking, PickupDropRequest, AppSettings.",
      security: bearerSecurity,
      parameters: [collectionParam],
      responses: {
        "200": okResponse({
          type: "object",
          properties: {
            items: {
              type: "array",
              items: { type: "object", additionalProperties: true },
            },
          },
        }),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/collections/{collection}/snapshot": {
    post: {
      tags: ["Collections"],
      summary: "Replace array collection snapshot (legacy gateway)",
      description:
        `${collectionsLegacyNote} ` +
        "Replaces all rows for an array collection only (singletons rejected). " +
        "jobCards writes may require JOB_CARD_PRICING when pricing fields change.",
      security: bearerSecurity,
      parameters: [collectionParam],
      requestBody: jsonBody({
        type: "object",
        required: ["items"],
        properties: {
          items: {
            type: "array",
            items: { type: "object", additionalProperties: true },
          },
        },
      }),
      responses: {
        "200": okResponse(ref("OkOk")),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/collections/{collection}/{entityId}": {
    put: {
      tags: [
        "Collections",
        "Job Cards",
        "Billing",
        "Appointments",
        "Bookings",
        "Pickup/Drop",
        "Services",
        "Inventory",
        "Settings",
      ],
      summary: "Upsert collection entity (legacy gateway)",
      description:
        `${collectionsLegacyNote} ` +
        "Upsert one entity. For singletons use entityId=`default`. Structural Zod validation applies to invoices, jobCards, quotations, payroll, membership.",
      security: bearerSecurity,
      parameters: [
        collectionParam,
        { name: "entityId", in: "path", required: true, schema: { type: "string" } },
      ],
      requestBody: jsonBody({
        type: "object",
        additionalProperties: true,
        description: "Payload must be a JSON object; payload.id should match entityId when present",
      }),
      responses: {
        "200": okResponse({ type: "object", additionalProperties: true }),
        ...commonErrorResponses(),
      },
    },
    delete: {
      tags: ["Collections"],
      summary: "Delete collection entity (legacy gateway)",
      description:
        `${collectionsLegacyNote} Array collections only (singletons rejected). Permission mapped per collection.`,
      security: bearerSecurity,
      parameters: [
        collectionParam,
        { name: "entityId", in: "path", required: true, schema: { type: "string" } },
      ],
      responses: {
        "200": okResponse(ref("OkOk")),
        ...commonErrorResponses(),
      },
    },
  },
};

export const jobCardUploadPaths: OpenApiPaths = {
  "/api/job-cards": {
    get: {
      tags: ["Job Cards"],
      summary: "List job cards (dedicated alias)",
      description:
        `${permNote("JOB_CARDS")} Same payload as collections ({ items }). Studio FE primary path (Phase 4).`,
      security: bearerSecurity,
      responses: {
        "200": okResponse({
          type: "object",
          properties: {
            items: { type: "array", items: ref("JobCard") },
          },
        }),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/job-cards/snapshot": {
    post: {
      tags: ["Job Cards"],
      summary: "Replace job cards snapshot (dedicated alias)",
      description:
        `${permNote("JOB_CARDS")} Same contract as collections snapshot. Pricing writes may require JOB_CARD_PRICING.`,
      security: bearerSecurity,
      requestBody: jsonBody({
        type: "object",
        required: ["items"],
        properties: {
          items: { type: "array", items: { type: "object", additionalProperties: true } },
        },
      }),
      responses: {
        "200": okResponse(ref("OkOk")),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/job-cards/{id}": {
    put: {
      tags: ["Job Cards"],
      summary: "Upsert job card (dedicated alias)",
      description:
        `${permNote("JOB_CARDS")} Same contract as \`PUT /api/collections/jobCards/{entityId}\`.`,
      security: bearerSecurity,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: jsonBody(ref("JobCard")),
      responses: {
        "200": okResponse(ref("OkOk")),
        ...commonErrorResponses(),
      },
    },
    delete: {
      tags: ["Job Cards"],
      summary: "Delete job card (dedicated alias)",
      description: permNote("JOB_CARDS"),
      security: bearerSecurity,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": okResponse(ref("OkOk")),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/job-cards/{jobCardId}/photos": {
    post: {
      tags: ["Job Cards"],
      summary: "Upload inspection photo",
      description: `${permNote("JOB_CARDS")} multipart field \`photo\`. Query \`type\` is required (BEFORE|AFTER).`,
      security: bearerSecurity,
      parameters: [
        { name: "jobCardId", in: "path", required: true, schema: { type: "string" } },
        {
          name: "type",
          in: "query",
          required: true,
          schema: { type: "string", enum: ["BEFORE", "AFTER"] },
        },
        {
          name: "photoId",
          in: "query",
          required: false,
          schema: { type: "string" },
          description: "Optional stable photo id; generated when omitted",
        },
      ],
      requestBody: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: {
              type: "object",
              required: ["photo"],
              properties: {
                photo: { type: "string", format: "binary" },
              },
            },
          },
        },
      },
      responses: {
        "201": okResponse({
          type: "object",
          properties: { url: { type: "string" } },
        }),
        ...commonErrorResponses(),
      },
    },
  },
};

export const invoiceAliasPaths: OpenApiPaths = {
  "/api/invoices": {
    get: {
      tags: ["Billing"],
      summary: "List invoices (dedicated alias)",
      description:
        `${permNote("BILLING")} Same payload as collections ({ items }). Studio FE primary path (Phase 4). ` +
        "Public view: `GET /api/public/invoices/{id}`.",
      security: bearerSecurity,
      responses: {
        "200": okResponse({
          type: "object",
          properties: {
            items: { type: "array", items: ref("Invoice") },
          },
        }),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/invoices/snapshot": {
    post: {
      tags: ["Billing"],
      summary: "Replace invoices snapshot (dedicated alias)",
      description: permNote("BILLING"),
      security: bearerSecurity,
      requestBody: jsonBody({
        type: "object",
        required: ["items"],
        properties: {
          items: { type: "array", items: { type: "object", additionalProperties: true } },
        },
      }),
      responses: {
        "200": okResponse(ref("OkOk")),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/invoices/{id}": {
    put: {
      tags: ["Billing"],
      summary: "Upsert invoice (dedicated alias)",
      description:
        `${permNote("BILLING")} Runs wallet sync on write (same as collections upsert).`,
      security: bearerSecurity,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: jsonBody(ref("Invoice")),
      responses: {
        "200": okResponse(ref("OkOk")),
        ...commonErrorResponses(),
      },
    },
    delete: {
      tags: ["Billing"],
      summary: "Delete invoice (dedicated alias)",
      description: permNote("BILLING"),
      security: bearerSecurity,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": okResponse(ref("OkOk")),
        ...commonErrorResponses(),
      },
    },
  },
};

export const quotationPaths: OpenApiPaths = {
  "/api/quotations": {
    get: {
      tags: ["Quotations"],
      summary: "List quotations (dedicated alias)",
      description:
        `${permNote("QUOTATIONS")} Same payload as collections ({ items }). Studio FE primary path (Phase 4).`,
      security: bearerSecurity,
      responses: {
        "200": okResponse({
          type: "object",
          properties: {
            items: { type: "array", items: ref("Quotation") },
          },
        }),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/quotations/snapshot": {
    post: {
      tags: ["Quotations"],
      summary: "Replace quotations snapshot (dedicated alias)",
      description: permNote("QUOTATIONS"),
      security: bearerSecurity,
      requestBody: jsonBody({
        type: "object",
        required: ["items"],
        properties: {
          items: { type: "array", items: { type: "object", additionalProperties: true } },
        },
      }),
      responses: {
        "200": okResponse(ref("OkOk")),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/quotations/{id}": {
    put: {
      tags: ["Quotations"],
      summary: "Upsert quotation (dedicated alias)",
      description: permNote("QUOTATIONS"),
      security: bearerSecurity,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: jsonBody(ref("Quotation")),
      responses: {
        "200": okResponse(ref("OkOk")),
        ...commonErrorResponses(),
      },
    },
    delete: {
      tags: ["Quotations"],
      summary: "Delete quotation (dedicated alias)",
      description: permNote("QUOTATIONS"),
      security: bearerSecurity,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": okResponse(ref("OkOk")),
        ...commonErrorResponses(),
      },
    },
  },
  "/api/quotations/convert-to-job": {
    post: {
      tags: ["Quotations", "Job Cards"],
      summary: "Convert quotation to job card",
      description: permNote("QUOTATIONS", "Atomically persists job card + updated quotation."),
      security: bearerSecurity,
      requestBody: jsonBody({
        type: "object",
        required: ["jobCard", "quotation"],
        properties: {
          jobCard: { type: "object", additionalProperties: true },
          quotation: { type: "object", additionalProperties: true },
        },
      }),
      responses: {
        "200": okResponse(ref("OkOk")),
        ...commonErrorResponses(),
      },
    },
  },
};
