import type { UserRole } from "@prisma/client";

/** Can list/create/edit staff users (non–role-assignment edits). */
export const STAFF_MANAGEMENT_ROLES: readonly UserRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "BRANCH_MANAGER",
  "MANAGER",
] as const;

/** Can assign or change roles (including elevating to admin). */
export const ROLE_ASSIGNMENT_ROLES: readonly UserRole[] = ["SUPER_ADMIN"] as const;

/** Branch create/update. */
export const BRANCH_MUTATION_ROLES: readonly UserRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "BRANCH_MANAGER",
  "MANAGER",
] as const;

/** Payroll / salary JSON collection read/write. */
export const PAYROLL_ACCESS_ROLES: readonly UserRole[] = ["SUPER_ADMIN", "ADMIN", "MANAGER"] as const;

export function isStaffManager(role: UserRole): boolean {
  return (STAFF_MANAGEMENT_ROLES as readonly string[]).includes(role);
}

export function canAssignUserRole(actor: UserRole, targetRole: UserRole): boolean {
  if (targetRole === "PLATFORM_OWNER") return false;
  return actor === "SUPER_ADMIN";
}

export function isPlatformOwner(role: UserRole | undefined): boolean {
  return role === "PLATFORM_OWNER";
}

export function canChangeRoles(actor: UserRole): boolean {
  return (ROLE_ASSIGNMENT_ROLES as readonly string[]).includes(actor);
}

/** Super Admin and Admin may onboard accounts (no public signup). */
export function canCreateStaffAccounts(actor: UserRole): boolean {
  return actor === "SUPER_ADMIN" || actor === "ADMIN";
}
