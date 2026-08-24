import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import type { UserRole } from "@prisma/client";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  branchId: string;
  organizationId?: string;
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
      email: string;
      role: UserRole;
      branchId: string;
      organizationId?: string;
      name: string;
      permissions?: string[];
    };
    req.auth = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      branchId: decoded.branchId,
      organizationId: decoded.organizationId,
      name: decoded.name,
      permissions: decoded.permissions || [],
    };
    next();
  } catch {
    res.status(401).json({ data: null, error: { message: "Invalid or expired token" } });
  }
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ data: null, error: { message: "Unauthorized" } });
      return;
    }
    if (req.auth.role === "SUPER_ADMIN") {
      next();
      return;
    }
    if (req.auth.permissions && req.auth.permissions.includes(permission)) {
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
    if (req.auth.role === "SUPER_ADMIN") {
      next();
      return;
    }
    const held = req.auth.permissions ?? [];
    if (permissions.some((p) => held.includes(p))) {
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
