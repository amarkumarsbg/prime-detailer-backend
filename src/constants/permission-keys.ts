/**
 * Canonical permission keys for RBAC.
 * Keep aligned with frontend/src/lib/permission-keys.ts (no shared package yet).
 */
export const PERMISSION_KEYS = [
  "DASHBOARD",
  "JOB_CARDS",
  "JOB_CARD_PRICING",
  "BOOKINGS",
  "PICKUP_DROP",
  "QUOTATIONS",
  "APPOINTMENTS",
  "CUSTOMERS",
  "MEMBERSHIP",
  "VEHICLES",
  "REMINDERS",
  "FOLLOW_UPS",
  "REFERRALS",
  "BILLING",
  "REPORTS",
  "CASH_BANK",
  "PARTIES",
  "SHARED_LEDGER",
  "EXPENSES",
  "VENDORS",
  "STAFF",
  "ATTENDANCE",
  "LEAVE",
  "PAYROLL",
  "STAFF_REWARDS",
  "SERVICES",
  "INVENTORY",
  "BRANCHES",
  "PERFORMANCE",
  "MECHANICS",
  "ANALYTICS",
  "ADVANCED_REPORTS",
  "ACTIVITY",
  "MESSAGES",
  "SETTINGS",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];
