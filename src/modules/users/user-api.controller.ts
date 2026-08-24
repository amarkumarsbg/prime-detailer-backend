import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import {
  canAssignUserRole,
  canChangeRoles,
  canCreateStaffAccounts,
  isStaffManager,
} from "../../lib/rbac.js";
import { validateStrongPassword } from "../../lib/password-policy.js";
import {
  isPasswordResetEmailConfigured,
} from "../auth/password-reset-email.service.js";
import { sendUserCredentialsEmail } from "../auth/onboarding-credentials-email.service.js";
import {
  listUsersApi,
  listStaffDirectoryApi,
  createUserApi,
  updateUserApi,
} from "./user-api.service.js";
import { prisma } from "../../lib/prisma.js";
import { resolveBranchScope } from "../../lib/data-scope.js";

function paramId(req: Request): string {
  const raw = req.params.id;
  return Array.isArray(raw) ? raw[0]! : raw!;
}

function forbidden(res: Response, message: string) {
  res.status(403).json({ data: null, error: { message } });
}

const roleEnum = z.enum([
  "SUPER_ADMIN",
  "ADMIN",
  "BRANCH_MANAGER",
  "MANAGER",
  "SUPERVISOR",
  "RECEPTIONIST",
  "MECHANIC",
]);

/** Plain shape — Zod v4 forbids `.partial()` on schemas that already use `.superRefine()`. */
const createUserBodySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  role: roleEnum,
  branchId: z.string().min(1),
  password: z.string().optional(),
  avatar: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  emailVerified: z.boolean().optional(),
  attendancePin: z.string().nullable().optional(),
  totalJobsCompleted: z.number().nullable().optional(),
  totalIncentiveEarned: z.number().nullable().optional(),
  birthday: z.string().nullable().optional(),
  anniversary: z.string().nullable().optional(),
  employeeCode: z.string().nullable().optional(),
  designation: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  joiningDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  permissions: z.array(z.string()).optional(),
});

const createUserSchema = createUserBodySchema.superRefine((data, ctx) => {
  const p = data.password?.trim();
  if (!p) return;
  const msg = validateStrongPassword(p);
  if (msg) ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg, path: ["password"] });
});

const updateUserSchema = createUserBodySchema.omit({ id: true, password: true }).partial();

export async function getUsers(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth || !isStaffManager(req.auth.role)) {
      forbidden(res, "You do not have access to user management.");
      return;
    }
    const scope = await resolveBranchScope(req.auth);
    if (!scope) {
      res.json({ data: { users: [] }, error: null });
      return;
    }
    const users = await listUsersApi({
      organizationId: scope.organizationId,
      branchIds: scope.allowedBranchIds,
    });
    res.json({ data: { users }, error: null });
  } catch (e) {
    next(e);
  }
}

/** Sanitized staff list for operational UIs (no pins / permissions). */
export async function getStaffDirectory(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth) {
      forbidden(res, "Unauthorized");
      return;
    }
    const scope = await resolveBranchScope(req.auth);
    if (!scope) {
      res.json({ data: { users: [] }, error: null });
      return;
    }
    const users = await listStaffDirectoryApi({
      organizationId: scope.organizationId,
      branchIds: scope.allowedBranchIds,
    });
    res.json({ data: { users }, error: null });
  } catch (e) {
    next(e);
  }
}

export async function postUser(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth || !canCreateStaffAccounts(req.auth.role)) {
      forbidden(res, "Only Super Admin or Admin can create new user accounts.");
      return;
    }
    const body = createUserSchema.parse(req.body);
    if (!canAssignUserRole(req.auth.role, body.role)) {
      forbidden(res, "Only Super Admin can assign user roles.");
      return;
    }
    let organizationId = req.auth.organizationId;
    if (!organizationId) {
      const actor = await prisma.user.findUnique({
        where: { id: req.auth.id },
        select: { organizationId: true },
      });
      organizationId = actor?.organizationId;
    }
    if (!organizationId) {
      forbidden(res, "Organization not found on user");
      return;
    }
    // Set default permissions to all keys if not specified
    const created = await createUserApi({
      ...body,
      role: body.role as UserRole,
      organizationId,
      createdById: req.auth.id,
    });

    let credentialsEmailSent = false;
    if (created.temporaryPassword && isPasswordResetEmailConfigured()) {
      const mailResult = await sendUserCredentialsEmail({
        toEmail: created.user.email,
        recipientName: created.user.name,
        temporaryPassword: created.temporaryPassword,
      });
      credentialsEmailSent = mailResult.ok;
      if (!mailResult.ok && process.env.NODE_ENV !== "production") {
        console.info(`[users/create] Credential email failed: ${mailResult.detail}`);
      }
    } else if (created.temporaryPassword && process.env.NODE_ENV !== "production") {
      console.info(
        "[users/create] RESEND_API_KEY / MAIL_FROM not configured — copy temporary password from API/UI."
      );
    }

    res.status(201).json({
      data: {
        user: created.user,
        temporaryPassword: created.temporaryPassword,
        credentialsEmailSent,
      },
      error: null,
    });
  } catch (e) {
    next(e);
  }
}

export async function putUser(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth || !isStaffManager(req.auth.role)) {
      forbidden(res, "You do not have permission to update users.");
      return;
    }
    const id = paramId(req);
    const body = updateUserSchema.parse(req.body);

    if (body.role !== undefined) {
      if (id === req.auth.id) {
        forbidden(res, "You cannot change your own role.");
        return;
      }
      const existing = await prisma.user.findUnique({ where: { id } });
      if (existing && existing.role !== body.role) {
        if (req.auth.role !== "SUPER_ADMIN") {
          forbidden(res, "Only Super Admin can change user roles.");
          return;
        }
      }
    }

    if (body.permissions !== undefined && req.auth.role !== "SUPER_ADMIN") {
      forbidden(res, "Only Super Admin can manage user permissions.");
      return;
    }

    const user = await updateUserApi(id, {
      ...body,
      role: body.role as UserRole | undefined,
    });
    if (!user) {
      res.status(404).json({ data: null, error: { message: "User not found" } });
      return;
    }
    res.json({ data: { user }, error: null });
  } catch (e) {
    next(e);
  }
}
