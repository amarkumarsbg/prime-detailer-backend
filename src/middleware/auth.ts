import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import type { UserRole } from "@prisma/client";
import {
  granularPermissionKey,
  isGranularPermissionModule,
  type GranularAction,
} from "../constants/permission-keys.js";

/** Staff roles (Prisma `UserRole`) plus the customer-portal pseudo-role. */
export type AppRole = UserRole | "CUSTOMER";

export interface AuthUser {
  id: string;
  email: string;
  role: AppRole;
  /** Empty string for customer-portal tokens (customers aren't branch-scoped). */
  branchId: string;
  organizationId?: string;
  /** Present only for customer-portal tokens (`role === "CUSTOMER"`). */
  customerId?: string;
  name: string;
  permissions?: string[];
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ data: null, error: { message: "Missing authorization token" } });
    return;
  }
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload & {
      sub: string;
      email?: string;
      role: AppRole;
      branchId?: string;
      organizationId?: string;
      customerId?: string;
      name: string;
      permissions?: string[];
    };
    req.auth = {
      id: decoded.sub,
      email: decoded.email ?? "",
      role: decoded.role,
      branchId: decoded.branchId ?? "",
      organizationId: decoded.organizationId,
      customerId: decoded.customerId,
      name: decoded.name,
      permissions: decoded.permissions || [],
    };
    next();
  } catch {
    res.status(401).json({ data: null, error: { message: "Invalid or expired token" } });
  }
}

/** Gate customer-portal routes: requires a valid `role: "CUSTOMER"` token with a customerId claim. */
export function requireCustomerAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth || req.auth.role !== "CUSTOMER" || !req.auth.customerId) {
    res.status(401).json({ data: null, error: { message: "Unauthorized" } });
    return;
  }
  next();
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ data: null, error: { message: "Unauthorized" } });
      return;
    }
    if (hasPermissionForMethod(req.auth, permission, req.method)) {
      next();
      return;
    }
    res.status(403).json({ data: null, error: { message: `Forbidden: Missing permission ${permission}` } });
  };
}

/** Pass if the user holds any of the listed permissions (SUPER_ADMIN bypasses). */
export function requireAnyPermission(permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ data: null, error: { message: "Unauthorized" } });
      return;
    }
    if (permissions.some((p) => hasPermissionForMethod(req.auth!, p, req.method))) {
      next();
      return;
    }
    res.status(403).json({
      data: null,
      error: {
        message: `Forbidden: Missing one of permissions ${permissions.join(", ")}`,
      },
    });
  };
}

function actionFromHttpMethod(method: string): GranularAction | null {
  switch (method.toUpperCase()) {
    case "GET":
    case "HEAD":
      return "VIEW";
    case "POST":
      return "CREATE";
    case "PUT":
    case "PATCH":
      return "EDIT";
    case "DELETE":
      return "DELETE";
    default:
      return null;
  }
}

/**
 * Method-aware permission resolver:
 * - SUPER_ADMIN / ADMIN bypass all checks.
 * - Base permission key remains backward-compatible and implies all actions.
 * - Granular modules may use *_CREATE / *_VIEW / *_EDIT / *_DELETE.
 */
export function hasPermissionForMethod(auth: AuthUser, permission: string, method: string): boolean {
  if (auth.role === "SUPER_ADMIN" || auth.role === "ADMIN") return true;

  const held = auth.permissions ?? [];
  if (held.includes(permission)) return true;

  if (!isGranularPermissionModule(permission)) return false;

  const action = actionFromHttpMethod(method);
  if (!action) return false;

  return held.includes(granularPermissionKey(permission, action));
}
