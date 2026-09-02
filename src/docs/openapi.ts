import { openApiComponents } from "./components/index.js";
import { authPaths, healthPaths, publicPaths, attendanceAdminPaths } from "./paths/auth-health-public.paths.js";
import { customerPaths, customerPortalPaths, vehiclePaths } from "./paths/customers-vehicles.paths.js";
import {
  branchPaths,
  partyPaths,
  userPaths,
} from "./paths/users-branches-parties.paths.js";
import {
  collectionPaths,
  jobCardUploadPaths,
  invoiceAliasPaths,
  quotationPaths,
} from "./paths/collections-jobs.paths.js";
import {
  attendancePaths,
  bootstrapPaths,
  jobsPaths,
  messagingPaths,
  organizationPaths,
  platformPaths,
  platformExtPaths,
} from "./paths/messaging-platform.paths.js";
import type { OpenApiPaths } from "./helpers.js";

const tags = [
  { name: "Health", description: "Liveness and service metadata" },
  { name: "Auth", description: "Staff login, OTP, password reset, and session" },
  { name: "Customer Portal", description: "Customer-facing auth and bootstrap (role CUSTOMER JWT)" },
  { name: "Users", description: "Staff user management" },
  { name: "Staff", description: "Alias tag for staff/user APIs" },
  { name: "Customers", description: "Tenant staff CRM customers (not customer portal)" },
  { name: "Vehicles", description: "Vehicle registry" },
  { name: "Job Cards", description: "Job cards dedicated API + photo upload (FE primary; collections compat)" },
  { name: "Billing", description: "Workshop invoices dedicated API + public invoice (not SaaS subscription billing)" },
  { name: "Quotations", description: "Quotations dedicated API + convert-to-job (FE primary; collections compat)" },
  { name: "Appointments", description: "Appointments via collections/appointments" },
  {
    name: "Bookings",
    description:
      "Customer bookings are Appointment rows with kind=BOOKING (same appointments collection)",
  },
  { name: "Pickup/Drop", description: "pickupDropRequests collection" },
  { name: "Services", description: "serviceCatalog / categories / highEndServices collections" },
  { name: "Inventory", description: "parts / stockMovements / productPurchases / branchStocks / stockTransfers / partCategories collections" },
  { name: "Reports", description: "reportSchedules and reporting-related collections" },
  { name: "Settings", description: "appSettings + logo upload + org messaging settings" },
  { name: "Collections", description: "LEGACY gateway: generic AppJsonRow list/upsert/snapshot/delete. Prefer module docs; see backend/docs/ADR-001-api-architecture.md" },
  { name: "Branches", description: "Branch management" },
  { name: "Parties", description: "Customer/supplier parties and ledger" },
  { name: "Messaging", description: "SMS, WhatsApp, email (org overrides + platform fallback)" },
  { name: "Attendance", description: "Public QR punch + dashboard attendance" },
  { name: "Bootstrap", description: "Studio bootstrap payload" },
  { name: "Organization", description: "Studio subscription entitlement, renewals, messaging settings, exports" },
  { name: "Organizations", description: "Platform tenant organization management" },
  { name: "Subscriptions", description: "SaaS subscription, trial, pricing, checkout, bills" },
  { name: "Plans", description: "Plan codes and limits (catalog-backed)" },
  { name: "Exports", description: "Data export endpoints and export-lock checks" },
  { name: "SaaS Admin", description: "Platform-owner control plane (/api/platform)" },
  { name: "Jobs", description: "Internal cron/job endpoints (/api/jobs). Auth via X-Internal-Job-Key or JWT." },
  { name: "Public", description: "Unauthenticated public endpoints (signup lead, register, pricing, invoices)" },
  { name: "Activity", description: "Activity logs (via collections/activityLogs)" },
  { name: "Payments", description: "SaaS subscription payments (platform) and workshop invoice payments (tenant)" },
];

function mergePaths(...parts: OpenApiPaths[]): OpenApiPaths {
  return Object.assign({}, ...parts);
}

export function buildOpenApiDocument(options?: { serverUrl?: string }) {
  const serverUrl = options?.serverUrl?.replace(/\/$/, "") || "/";
  return {
    openapi: "3.0.3",
    info: {
      title: "Prime Detailers API",
      version: "0.2.0",
      description: [
        "Express API for Prime Detailers studio, customer portal, and SaaS platform (Phase 2).",
        "",
        "## API audiences",
        "- **Tenant staff / admin** — JWT from `/api/auth/login` (or OTP). Organization context comes from the token.",
        "- **Customer portal** — JWT from `/api/auth/customer/login` (role `CUSTOMER`). Customers only see their own data.",
        "- **Platform (SaaS Admin)** — `PLATFORM_OWNER` JWT **or** header `X-Platform-Admin-Key` on `/api/platform/*`.",
        "- **Public** — no auth (signup lead, self-serve register, pricing quote, public invoice/branding).",
        "",
        "## Authentication",
        "1. Staff: `POST /api/auth/login` → `accessToken`.",
        "2. Customer: `POST /api/auth/customer/login` → `accessToken`.",
        "3. Click **Authorize** and paste the JWT (without the `Bearer ` prefix).",
        "4. Protected routes send `Authorization: Bearer <token>`.",
        "",
        "## Multi-tenant security",
        "Do **not** send `organizationId` as a trusted client security parameter for tenant APIs.",
        "Organization and branch scope are taken from the authenticated identity. Response `organizationId` fields are server-managed.",
        "",
        "## Workshop access (Phase 2)",
        "Most studio workshop routes require an **active organization** and subscription status **ACTIVE**, **PAST_DUE**, or **TRIAL** (with `trialEndsAt` still in the future).",
        "Common 403 codes: `ORG_INACTIVE`, `SUBSCRIPTION_EXPIRED`, `SUBSCRIPTION_CANCELLED`, `SUBSCRIPTION_TRIAL_ENDED`.",
        "Intentionally reachable without workshop access: `/api/auth/*`, `/api/bootstrap`, `/api/organization/*` (renewal/entitlement), `/api/platform/*`.",
        "",
        "## Export lock",
        "When ≤30 days remain until subscription end (or past expiry), `canExportData` is false.",
        "Dedicated export routes and list calls with `?export=1`, `?download=true`, `?format=csv`, or `X-Export-Intent: 1` return 403 `EXPORT_LOCKED`.",
        "",
        "## Permissions",
        "Most studio routes require a permission key in the JWT (SUPER_ADMIN bypasses).",
        "Collection routes map collection names → permission keys (default-deny).",
        "",
        "## Architecture",
        "See `backend/docs/ADR-001-api-architecture.md`. `/api/collections/*` is a legacy document gateway.",
        "",
        "## Safety",
        "This document never includes real secrets, passwords, or database credentials.",
        "Do not paste production tokens into shared Swagger sessions.",
      ].join("\n"),
    },
    servers: [{ url: serverUrl, description: "API base" }],
    tags,
    paths: mergePaths(
      healthPaths,
      authPaths,
      publicPaths,
      bootstrapPaths,
      customerPaths,
      customerPortalPaths,
      vehiclePaths,
      userPaths,
      branchPaths,
      partyPaths,
      collectionPaths,
      jobCardUploadPaths,
      invoiceAliasPaths,
      quotationPaths,
      messagingPaths,
      attendancePaths,
      attendanceAdminPaths,
      organizationPaths,
      platformPaths,
      platformExtPaths,
      jobsPaths
    ),
    components: openApiComponents,
  };
}

export type OpenApiDocument = ReturnType<typeof buildOpenApiDocument>;
