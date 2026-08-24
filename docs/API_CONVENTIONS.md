# API conventions (errors, responses, auth, scope)

Canonical contract for studio and platform APIs. Phase 0 documents **current** behavior; prefer converging new code on this.

## Response envelope

### Success

```json
{ "data": { }, "error": null }
```

`data` shape is endpoint-specific (examples):

| Pattern | Example |
|---------|---------|
| Entity wrapper | `{ "customer": { … } }` |
| List wrapper | `{ "customers": [ … ] }`, `{ "users": [ … ] }` |
| Collections list | `{ "items": [ … ] }` |
| OK flag | `{ "ok": true }` |

**Do not change existing wrappers** without a versioned FE migration.

### Error

```json
{
  "data": null,
  "error": {
    "message": "Human-readable summary",
    "code": "VALIDATION",
    "details": {}
  }
}
```

Stable codes (`ApiErrorCode` in `src/lib/app-error.ts`):

| Code | Typical HTTP |
|------|----------------|
| `VALIDATION` | 400 |
| `UNAUTHORIZED` | 401 |
| `FORBIDDEN` | 403 |
| `NOT_FOUND` | 404 |
| `CONFLICT` | 409 |
| `PAYLOAD_TOO_LARGE` | 413 |
| `INTERNAL` | 500 |

Prefer throwing `AppError` (or `AppHttpError` where already used) and letting `errorHandler` format the body. Avoid inventing new ad-hoc envelopes.

Zod failures → `400` + `code: VALIDATION` + `details` from `flatten()`.

## Authentication

| Surface | Mechanism |
|---------|-----------|
| Studio API | `Authorization: Bearer <JWT>` from login / OTP |
| Public | No auth (`/api/public/*`, `/health`) |
| Platform | `PLATFORM_OWNER` JWT **or** `X-Platform-Admin-Key` |

JWT carries `sub`, `role`, `branchId`, `organizationId`, `permissions[]`.  
`SUPER_ADMIN` bypasses permission checks in `requirePermission` / collection permission middleware.

## Permissions

- Studio module routes use `requirePermission("<KEY>")` with keys from `PERMISSION_KEYS`.
- Collection gateway uses `COLLECTION_PERMISSION_MAP` (default-deny).
- Extra role allowlists exist where already implemented (e.g. payroll read/write roles, staff create).
- **Do not rename or remove permission keys** without a coordinated FE + seed change.

## Organization / branch scope

| Data | Current rule |
|------|----------------|
| Branches, users | Filter by `organizationId` (and branch for non–org-wide roles) |
| AppJsonRow arrays | Filter/stamp by `organizationId`; also filter by `payload.branchId` when scoped |
| Payroll / cashBank singletons | Nested arrays filtered by branch when scoped |
| Customers / vehicles / parties | Filter/stamp by `organizationId` (Phase 5); phone uniqueness is per-org |
| Optional `?branchId=` | Must intersect caller allowlist |

Org-wide roles (can see all org branches): `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `BRANCH_MANAGER` (see `data-scope.ts`).

## Naming

- Existing paths stay as registered (`/api/customers`, `/api/job-cards`, `/api/collections/jobCards`, …).
- Prefer **aliases** over renames when graduating modules.
- Special actions: verb or sub-resource (`…/convert-to-job`, `…/photos`, `…/wallet`).

## Validation

- Request bodies validated with Zod at the controller/route boundary where already present.
- Collection payloads: `validations/collection-payloads.ts`.
- Invalid input → `VALIDATION` via error handler when Zod is thrown/parsed.

## OpenAPI

- Spec assembled in `src/docs/openapi.ts`.
- Document **real** routes only.
- Mark `/api/collections` as **legacy gateway** in descriptions (see OPENAPI.md).
- Include permission notes on protected operations.
