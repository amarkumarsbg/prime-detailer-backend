# API migration phases

Incremental plan. **Do not start a phase until explicitly approved.**

| Phase | Scope | Runtime behavior change? | Status |
|-------|--------|---------------------------|--------|
| **0** | ADR, module ownership, CRUD/actions matrix, API conventions, OpenAPI legacy labeling for collections | **No** | **Done** (this docs set) |
| **1** | Folder moves into `modules/` for already-clear REST domains (customers, vehicles, users, branches, parties, auth, …); same mounts | No (re-exports) | **Done** |
| **2** | Domain services behind collections dispatcher (job-cards, invoices, quotations, …) | No (same HTTP) | **Done** |
| **3** | Optional dedicated route **aliases** when FE ready | Additive only | **Done** |
| **4** | FE cutover off collections for graduated modules; deprecate unused collection traffic | Yes (coordinated) | **Done** |
| **5** | Tenant columns / hard org isolation (separate track) | Yes | **Done** |

## Phase 0 deliverables

- [ADR-001-api-architecture.md](./ADR-001-api-architecture.md)
- [MODULE_OWNERSHIP.md](./MODULE_OWNERSHIP.md)
- [CRUD_AND_ACTIONS.md](./CRUD_AND_ACTIONS.md)
- [API_CONVENTIONS.md](./API_CONVENTIONS.md)
- OpenAPI: Collections tag + path descriptions marked **legacy**
- [OPENAPI.md](./OPENAPI.md) updated pointers

## Phase 1 deliverables

- Clear REST domains under `src/modules/{auth,customers,vehicles,users,branches,parties,bootstrap,organization,platform}/`
- `src/index.ts` mounts from `modules/…` (same `/api/*` paths)
- Deprecated shims at old `routes/` / `services/` paths for scripts and leftover imports
- No HTTP path, payload, or permission changes

## Phase 2 deliverables

- `modules/collections/` — AppJsonRow store + thin HTTP dispatcher
- Domain services: `modules/job-cards/`, `modules/invoices/`, `modules/quotations/`
- Pricing / wallet / convert logic owned by those services
- Other collections use generic document handlers
- Same `/api/collections/*`, `/api/quotations/convert-to-job`, `/api/job-cards/:id/photos` mounts
- Deprecated shims at old `routes/` / `controllers/` / `services/` paths

## Phase 3 deliverables

- Dedicated aliases (same services + same `{ items }` / `{ ok }` envelopes as collections):
  - `/api/job-cards` (list / snapshot / upsert / delete) + existing photos
  - `/api/invoices` (list / snapshot / upsert / delete); public view unchanged
  - `/api/quotations` (list / snapshot / upsert / delete) + existing convert-to-job
- Collections remain primary for the frontend until Phase 4
- OpenAPI documents aliases under Job Cards / Billing / Quotations tags

## Phase 4 deliverables

- Frontend domain loader + `collection-sync` use dedicated paths for `jobCards` / `invoices` / `quotations`
- Collections gateway remains mounted for compatibility and non-graduated domains
- No removal of `/api/collections/{jobCards|invoices|quotations}` yet (telemetry / rollback)

## Phase 5 deliverables

- `organizationId` on `Customer`, `Vehicle`, `Party`, `AppJsonRow` (FK to `Organization`, backfilled to `org-default`)
- List/get/write paths filter or stamp the caller’s organization
- Cross-org AppJsonRow id collisions rejected (`409 CONFLICT`)
- Public invoice still resolves by collection + entityId (no auth org)
- Seed stamps `organizationId` on customers, vehicles, parties, and JSON rows

## Hard rules for all phases

1. Preserve path + payload + permission behavior unless a versioned change is intentional.
2. Frontend compatibility is a release gate.
3. No invented CRUD endpoints without product + FE need.
4. Special actions remain explicit routes.
