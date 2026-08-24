# OpenAPI / Swagger documentation

## Access

With the API running locally (default port **4000**):

| Resource | URL |
|----------|-----|
| Swagger UI | [http://localhost:4000/api/docs](http://localhost:4000/api/docs) |
| OpenAPI JSON | [http://localhost:4000/api/docs/openapi.json](http://localhost:4000/api/docs/openapi.json) |

Root `GET /` also lists `docs` / `openapi` when Swagger is enabled.

## Architecture docs (start here)

| Doc | Purpose |
|-----|---------|
| [ADR-001-api-architecture.md](./ADR-001-api-architecture.md) | Target architecture decision |
| [MODULE_OWNERSHIP.md](./MODULE_OWNERSHIP.md) | Module → routes → permissions |
| [CRUD_AND_ACTIONS.md](./CRUD_AND_ACTIONS.md) | CRUD matrix + special actions |
| [API_CONVENTIONS.md](./API_CONVENTIONS.md) | Envelope, errors, auth, scope |
| [MIGRATION_PHASES.md](./MIGRATION_PHASES.md) | Phased rollout |

## Enabling / disabling

| Environment | Behavior |
|-------------|----------|
| Non-production (`NODE_ENV` ≠ `production`) | **Enabled** by default |
| Production | **Disabled** by default |
| `SWAGGER_ENABLED=true` / `1` / `yes` | Force **on** |
| `SWAGGER_ENABLED=false` / `0` / `no` | Force **off** |

See `env.example` for the `SWAGGER_ENABLED` variable.

Do not leave Swagger publicly reachable in production unless you intentionally need it (prefer a private network or VPN).

## Trying protected APIs

1. Open Swagger UI → **Auth** → `POST /api/auth/login`.
2. Execute with a valid email/password.
3. Copy `data.accessToken` from the response (never commit or share production tokens).
4. Click **Authorize**, paste the JWT **without** the `Bearer ` prefix, then **Authorize**.
5. Use **Try it out** on protected routes.

Platform (SaaS) routes under `/api/platform/*` accept either:

- a JWT for a user with role `PLATFORM_OWNER`, or
- header `X-Platform-Admin-Key` matching `PLATFORM_ADMIN_API_KEY` (Authorize → **PlatformAdminKey**).

## Spec layout (maintainability)

Documentation is modular TypeScript under `src/docs/`:

```
src/docs/
  openapi.ts                 # assembles the OpenAPI 3.0.3 document
  register-swagger.ts        # mounts UI + JSON; env gating
  helpers.ts                 # shared path helpers
  components/
    index.ts                 # security schemes + schemas + responses
    schemas.ts              # User, Customer, Vehicle, JobCard, …
    responses.ts            # common error envelopes
  paths/
    auth-health-public.paths.ts
    customers-vehicles.paths.ts
    users-branches-parties.paths.ts
    collections-jobs.paths.ts
    messaging-platform.paths.ts
```

### Adding or updating an endpoint

1. Implement the real Express route (do not invent fake paths in the docs).
2. Add or edit the matching entry under `src/docs/paths/*.paths.ts`.
3. Reuse schemas from `components/schemas.ts` when possible.
4. Document auth (`BearerAuth` / `PlatformAdminKey`) and required permission keys in the description.
5. Rebuild / restart the API and refresh `/api/docs`.

### Bootstrap (thin shell)

`GET /api/bootstrap` returns only org-scoped **branches**, public **branding**, and **entitlement**. Domain data (customers, job cards, payroll, etc.) is loaded via permission-scoped entity and collection APIs — not via bootstrap.

### Domain entities via collections (**legacy gateway**)

Many studio resources (job cards, invoices, appointments/bookings, quotations, pickup/drop, app settings, inventory, etc.) are stored as `AppJsonRow` and exposed through the **legacy** gateway:

- `GET/PUT/DELETE /api/collections/{collection}/…`
- `POST /api/collections/{collection}/snapshot`

OpenAPI tags these operations under **Collections** (legacy) as well as domain tags for discoverability.

**Graduated modules (Phase 4 — FE primary on dedicated routes):**

- `/api/job-cards` — list, snapshot, upsert, delete (+ photos)
- `/api/invoices` — list, snapshot, upsert, delete
- `/api/quotations` — list, snapshot, upsert, delete (+ convert-to-job)

Matching `/api/collections/{jobCards|invoices|quotations}` paths remain for compatibility but are no longer used by the studio frontend domain loader / sync helpers.

Other AppJsonRow domains still use the collections gateway. Entity shapes are documented as reusable schemas (`JobCard`, `Invoice`, `Appointment`, `Booking`, …). Bookings are `Appointment` rows with `kind: BOOKING`.

Special actions:

- `POST /api/quotations/convert-to-job`
- `POST /api/job-cards/{jobCardId}/photos`

See [CRUD_AND_ACTIONS.md](./CRUD_AND_ACTIONS.md).

## Packages

- `swagger-ui-express` — serves Swagger UI
- `@types/swagger-ui-express` — TypeScript types

## Safety

- Never document real passwords, JWT secrets, Twilio/Resend/S3 keys, or database URLs.
- User responses omit `passwordHash` and password-reset token hashes.
- Prefer disabling Swagger on public production hosts.
