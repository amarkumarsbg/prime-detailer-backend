# Module ownership table

Maps **business modules** → **current HTTP surfaces** → **primary code (today)** → **permission**.  
Paths are as registered in Express today. Do not invent routes from this table.

Storage: **Prisma** = relational table(s). **AppJsonRow** = `collection` name in `/api/collections/{collection}`.

| Module | Public HTTP (current) | Storage | Permission / auth | Primary code (current layout) | Notes |
|--------|----------------------|---------|-------------------|-------------------------------|-------|
| Auth | `/api/auth/*` | Prisma `User` | Mixed public + JWT | `modules/auth/*` | Login, OTP, me, password |
| Bootstrap | `GET /api/bootstrap` | Prisma + AppJsonRow (branding) | JWT | `modules/bootstrap/*` | Thin shell only |
| Health | `/health`, `/api/health`, `…/db` | — | Public | `index.ts` | Liveness |
| Customers | `/api/customers` | Prisma `Customer` | `CUSTOMERS` | `modules/customers/*` | Org-scoped (Phase 5) |
| Vehicles | `/api/vehicles` | Prisma `Vehicle` | `VEHICLES` | `modules/vehicles/*` | Org-scoped (Phase 5) |
| Vehicle catalog | `/api/collections/vehicleCatalog` | AppJsonRow singleton | `VEHICLES` | collections + `COLLECTION_PERMISSION_MAP` | Catalog, not vehicle rows |
| Users / Staff | `/api/users`, `/api/users/directory` | Prisma `User` | `STAFF` / any-of for directory | `modules/users/*` | No DELETE; soft-deactivate via PUT |
| Branches | `/api/branches` | Prisma `Branch` | `BRANCHES` | `modules/branches/*` | + deletion-check |
| Parties | `/api/parties` | Prisma + party helpers | `PARTIES` | `modules/parties/*` | Org-scoped (Phase 5); + ledger |
| Job Cards | `/api/job-cards` (FE primary), `/api/collections/jobCards` (compat), photos | AppJsonRow + uploads | `JOB_CARDS` | `modules/job-cards/*` | Phase 4 FE cutover |
| Appointments / Bookings | `/api/collections/appointments` | AppJsonRow | `APPOINTMENTS` | collections document handler | Bookings: `kind: BOOKING` |
| Quotations | `/api/quotations` (FE primary), `/api/collections/quotations` (compat), convert | AppJsonRow | `QUOTATIONS` | `modules/quotations/*` | Phase 4 FE cutover |
| Invoices / Billing | `/api/invoices` (FE primary), `/api/collections/invoices` (compat), public | AppJsonRow | `BILLING` / public | `modules/invoices/*` | Phase 4 FE cutover; wallet sync on write |
| Expenses | `/api/collections/expenses`, `expenseMeta` | AppJsonRow | `EXPENSES` | collections | Meta = singleton |
| Services catalog | `serviceCatalog`, `serviceCategories`, `highEndServices` | AppJsonRow | `SERVICES` | collections | Three related collections |
| Inventory | `parts`, `stockMovements`, `productPurchases` | AppJsonRow | `INVENTORY` | collections | |
| Payroll | `/api/collections/payroll` | AppJsonRow singleton | `PAYROLL` + role allowlist | collections + `PAYROLL_ACCESS_ROLES` | Sensitive |
| Membership | `/api/collections/membership` | AppJsonRow singleton | `MEMBERSHIP` | collections | |
| Cash / Bank | `/api/collections/cashBank` | AppJsonRow singleton | `CASH_BANK` | collections | |
| Follow-ups | `followUps` | AppJsonRow | `FOLLOW_UPS` | collections | |
| Reminders | `serviceReminders` | AppJsonRow | `REMINDERS` | collections | |
| Referrals / wallet txs | `walletTransactions`, `referralProgram` | AppJsonRow | `REFERRALS` | collections + customer wallet | |
| Pickup / Drop | `pickupDropRequests` | AppJsonRow | `PICKUP_DROP` | collections | |
| Communications | `communications` | AppJsonRow | `MESSAGES` | collections | |
| Activity | `activityLogs` | AppJsonRow | `ACTIVITY` | collections | |
| Notifications | `notifications` | AppJsonRow | `DASHBOARD` | collections | |
| Dashboard stats | `dashboardStats` | AppJsonRow singleton | `DASHBOARD` | collections | |
| App settings | `appSettings`, logo POST | AppJsonRow singleton | `SETTINGS` | collections | |
| Shared ledger / BS | `balanceSheetManual` | AppJsonRow singleton | `SHARED_LEDGER` | collections | |
| Reports (schedules) | `reportSchedules` | AppJsonRow singleton | `ADVANCED_REPORTS` | collections | Aggregation mostly FE |
| Attendance | `/api/attendance`, `/api/public/attendance/*` | Prisma `Attendance` | `ATTENDANCE` / public | `attendance.*`, `public-attendance.*` | Punch public; studio list/reset |
| Messaging | `/api/messaging/*` | — | JWT; tests need `SETTINGS` | `messaging.*` | Actions only |
| Organization (studio) | `GET /api/organization/subscription` | Prisma org/sub | JWT | `modules/organization/*` | Entitlement |
| Platform (SaaS) | `/api/platform/*` | Prisma org/sub | Platform auth | `modules/platform/*` | Control plane |
| Collections gateway | `/api/collections/*` | AppJsonRow | Per `COLLECTION_PERMISSION_MAP` | `modules/collections/*` | **Legacy gateway** → domain or document handlers |

## Ownership rules (for future phases)

1. When a module graduates, **one** service owns domain rules; HTTP may be dedicated routes and/or collections dispatcher.
2. OpenAPI tags should match this module list.
3. Do not add a second full CRUD surface for the same entity without an explicit FE migration plan.
