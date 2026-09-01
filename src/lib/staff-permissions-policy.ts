import type { AuthUser } from "../middleware/auth.js";

/** Matches frontend staff profile Save Access: SUPER_ADMIN / ADMIN or STAFF_EDIT / base STAFF. */
export function canManageUserPermissions(auth: AuthUser): boolean {
  if (auth.role === "SUPER_ADMIN" || auth.role === "ADMIN") return true;
  const held = auth.permissions ?? [];
  return held.includes("STAFF") || held.includes("STAFF_EDIT");
}
