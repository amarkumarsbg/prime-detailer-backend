# CRUD vs special actions

Verified against Express route registration. **Create via collections** means `PUT /api/collections/{collection}/{entityId}` upsert (there is no `POST /api/collections/{collection}` for a single item). **Detail** means a dedicated `GET …/:id` route.

## Dedicated REST (Prisma-backed)

| Resource | Create | List | Detail | Update | Delete | Special actions |
|----------|--------|------|--------|--------|--------|-----------------|
| Customers | ✅ | ✅ | ✅ | ✅ | ✅ | `PATCH /:id/wallet`, `POST /bulk` |
| Vehicles | ✅ | ✅ | ❌ | ✅ | ✅ | `POST /bulk`, `POST /snapshot` |
| Users / Staff | ✅ | ✅ | ❌ | ✅ | ❌ | `GET /directory` (sanitized read) |
| Branches | ✅ | ✅ | ❌ | ✅ | ✅ | `GET /:id/deletion-check` |
| Parties | ✅ | ✅ | ✅ | ✅ | ✅ | `GET /:id/ledger` |
| Attendance (studio) | ❌ | ✅ | ❌ | ❌ | ⚠️ reset-all | Public punch / PIN under `/api/public/attendance` |
| Organization subscription | ❌ | ✅ | — | ❌ | ❌ | — |
| Platform orgs | ❌ | ✅ | ✅ | ⚠️ PATCH subscription | ❌ | Platform auth only |

## Dedicated document APIs (Phase 4 — FE primary; AppJsonRow underneath)

Same envelopes as collections (`{ items }`, `{ ok: true }`). Matching collection paths remain for compatibility.

| Resource | Create | List | Detail | Update | Delete | Special actions |
|----------|--------|------|--------|--------|--------|-----------------|
| Job Cards | ✅ PUT upsert | ✅ `/api/job-cards` | ❌ | ✅ PUT | ✅ | `POST /:id/photos`; snapshot |
| Invoices | ✅ PUT upsert | ✅ `/api/invoices` | ❌ (public GET) | ✅ PUT | ✅ | Wallet sync on PUT; snapshot |
| Quotations | ✅ PUT upsert | ✅ `/api/quotations` | ❌ | ✅ PUT | ✅ | `POST /convert-to-job`; snapshot |

## Collection-backed documents (AppJsonRow)

| Collection | List GET | Detail GET | Upsert PUT | Snapshot POST | Delete | Permission |
|------------|----------|------------|------------|---------------|--------|------------|
| Array collections (`jobCards`, `invoices`, `quotations`, `appointments`, `expenses`, `activityLogs`, `serviceReminders`, `walletTransactions`, `serviceCatalog`, `parts`, `stockMovements`, `productPurchases`, `followUps`, `serviceCategories`, `notifications`, `pickupDropRequests`, `communications`) | ✅ | ❌ | ✅ | ✅ (arrays only) | ✅ | See `COLLECTION_PERMISSION_MAP` |
| Singleton collections (`dashboardStats`, `expenseMeta`, `cashBank`, `payroll`, `membership`, `appSettings`, `referralProgram`, `balanceSheetManual`, `highEndServices`, `reportSchedules`, `vehicleCatalog`) | ✅ (0–1 items) | — | ✅ (`…/default`) | ❌ | ❌ | Same map; payroll also role-gated |

## Explicit special actions (keep explicit)

| Action | Method / path | Permission |
|--------|---------------|------------|
| Convert quotation → job | `POST /api/quotations/convert-to-job` | `QUOTATIONS` |
| Job card inspection photo | `POST /api/job-cards/:jobCardId/photos` | `JOB_CARDS` |
| Customer wallet adjust | `PATCH /api/customers/:id/wallet` | `CUSTOMERS` |
| App settings logo | `POST /api/collections/appSettings/logo` | `SETTINGS` |
| Collection / vehicle snapshot | `POST …/snapshot` | Per resource |
| Messaging send / SMS·WhatsApp test | `POST /api/messaging/*` | Auth; tests `SETTINGS` |
| Public attendance punch | `POST /api/public/attendance/punch` | Public |
| Thin bootstrap | `GET /api/bootstrap` | JWT |

## Strategy

- **CRUD** where the UI manages durable entities (customers, parties, branches, staff list/update).
- **Document upsert** for AppJsonRow aggregates until dedicated module routes exist.
- **Never** document a special workflow as “just PUT the collection” without also documenting the dedicated action route when one exists.
- **Do not invent** endpoints solely to fill CRUD gaps (e.g. staff DELETE, vehicle detail GET) unless product + frontend require them.
