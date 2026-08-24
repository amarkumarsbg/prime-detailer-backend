import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Prisma, User as PrismaUser } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/app-error.js";
import { toStaffDirectoryEntry } from "../../lib/data-scope.js";
import { assertCanCreateUser } from "../organization/organization-subscription.service.js";

function pickChar(set: string): string {
  return set[randomInt(0, set.length)]!;
}

/** Meets application password policy (mixed case, digit, symbol, length ≥ 8). */
export function generateTemporaryPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const special = "#@$%&*!?+-";
  const all = upper + lower + digits + special;
  const targetLen = 10;
  const chars: string[] = [
    pickChar(upper),
    pickChar(lower),
    pickChar(digits),
    pickChar(special),
  ];
  while (chars.length < targetLen) chars.push(pickChar(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    const a = chars[i]!;
    const b = chars[j]!;
    chars[i] = b;
    chars[j] = a;
  }
  return chars.join("");
}


/** Trim; empty string becomes null (clears optional HR fields / unique employeeCode). */
function nullIfEmpty(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function toApiUser(u: PrismaUser) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    employeeCode: u.employeeCode ?? undefined,
    designation: u.designation ?? undefined,
    department: u.department ?? undefined,
    joiningDate: u.joiningDate ?? undefined,
    role: u.role,
    branchId: u.branchId,
    organizationId: u.organizationId,
    avatar: u.avatar ?? undefined,
    isActive: u.isActive,
    emailVerified: u.emailVerified || undefined,
    attendancePin: u.attendancePin ?? undefined,
    totalJobsCompleted: u.totalJobsCompleted ?? undefined,
    totalIncentiveEarned: u.totalIncentiveEarned ?? undefined,
    birthday: u.birthday ?? undefined,
    anniversary: u.anniversary ?? undefined,
    notes: u.notes ?? undefined,
    mustChangePassword: u.mustChangePassword === true ? true : undefined,
    passwordCreatedBy: u.passwordCreatedBy ?? undefined,
    passwordUpdatedAt: u.passwordUpdatedAt?.toISOString(),
    permissions: u.permissions || [],
  };
}

export async function listUsersApi(opts?: {
  organizationId?: string | null;
  /** When set, only users on these branches. null/undefined = all org users. */
  branchIds?: string[] | null;
}) {
  const where: Prisma.UserWhereInput = {
    role: { not: "PLATFORM_OWNER" },
  };
  if (opts?.organizationId) {
    where.organizationId = opts.organizationId;
  }
  if (opts?.branchIds && opts.branchIds.length > 0) {
    where.branchId = { in: opts.branchIds };
  } else if (opts?.branchIds && opts.branchIds.length === 0) {
    return [];
  }
  const rows = await prisma.user.findMany({
    where,
    orderBy: { id: "asc" },
  });
  return rows.map(toApiUser);
}

export async function listStaffDirectoryApi(opts: {
  organizationId: string;
  branchIds?: string[] | null;
}) {
  const where: Prisma.UserWhereInput = {
    role: { not: "PLATFORM_OWNER" },
    organizationId: opts.organizationId,
  };
  if (opts.branchIds && opts.branchIds.length > 0) {
    where.branchId = { in: opts.branchIds };
  } else if (opts.branchIds && opts.branchIds.length === 0) {
    return [];
  }
  const rows = await prisma.user.findMany({
    where,
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      role: true,
      branchId: true,
      organizationId: true,
      isActive: true,
      avatar: true,
    },
  });
  return rows.map(toStaffDirectoryEntry);
}

export async function createUserApi(input: {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: PrismaUser["role"];
  branchId: string;
  organizationId: string;
  password?: string;
  avatar?: string | null;
  isActive?: boolean;
  emailVerified?: boolean;
  attendancePin?: string | null;
  totalJobsCompleted?: number | null;
  totalIncentiveEarned?: number | null;
  birthday?: string | null;
  anniversary?: string | null;
  employeeCode?: string | null;
  designation?: string | null;
  department?: string | null;
  joiningDate?: string | null;
  notes?: string | null;
  /** Creator `User.id` when provisioned by an authenticated admin. */
  createdById?: string | null;
  permissions?: string[];
}): Promise<{ user: ReturnType<typeof toApiUser>; temporaryPassword?: string }> {
  if (input.role === "PLATFORM_OWNER") {
    throw AppError.validation("Cannot create PLATFORM_OWNER accounts via studio user management.");
  }

  const branch = await prisma.branch.findUnique({ where: { id: input.branchId } });
  if (!branch) {
    throw AppError.validation("Selected branch was not found.");
  }
  if (input.isActive ?? true) {
    await assertCanCreateUser(branch.organizationId);
  }

  const useExplicitPassword = input.password !== undefined && input.password.trim() !== "";
  const plainPassword = useExplicitPassword ? input.password!.trim() : generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(plainPassword, 10);
  const now = new Date();

  const data: Prisma.UserUncheckedCreateInput = {
    id: input.id,
    name: input.name,
    email: input.email.toLowerCase(),
    phone: input.phone,
    role: input.role,
    branchId: input.branchId,
    organizationId: branch.organizationId,
    passwordHash,
    mustChangePassword: !useExplicitPassword,
    passwordCreatedBy: input.createdById ?? null,
    passwordUpdatedAt: now,
    avatar: input.avatar ?? null,
    isActive: input.isActive ?? true,
    emailVerified: input.emailVerified ?? false,
    attendancePin: input.attendancePin ?? null,
    totalJobsCompleted: input.totalJobsCompleted ?? null,
    totalIncentiveEarned: input.totalIncentiveEarned ?? null,
    birthday: nullIfEmpty(input.birthday) ?? null,
    anniversary: nullIfEmpty(input.anniversary) ?? null,
    employeeCode: nullIfEmpty(input.employeeCode) ?? null,
    designation: nullIfEmpty(input.designation) ?? null,
    department: nullIfEmpty(input.department) ?? null,
    joiningDate: nullIfEmpty(input.joiningDate) ?? null,
    notes: nullIfEmpty(input.notes) ?? null,
    permissions: input.permissions ?? [],
  };

  const code = data.employeeCode as string | null;
  if (code) {
    const clash = await prisma.user.findFirst({ where: { employeeCode: code } });
    if (clash) {
      throw AppError.validation("Employee code is already in use.");
    }
  }

  const row = await prisma.user.create({ data });
  return {
    user: toApiUser(row),
    ...(!useExplicitPassword ? { temporaryPassword: plainPassword } : {}),
  };
}

export async function updateUserApi(
  id: string,
  patch: Partial<{
    name: string;
    email: string;
    phone: string;
    role: PrismaUser["role"];
    branchId: string;
    avatar: string | null;
    isActive: boolean;
    emailVerified: boolean;
    attendancePin: string | null;
    totalJobsCompleted: number | null;
    totalIncentiveEarned: number | null;
    birthday: string | null;
    anniversary: string | null;
    employeeCode: string | null;
    designation: string | null;
    department: string | null;
    joiningDate: string | null;
    notes: string | null;
    permissions: string[];
  }>
): Promise<ReturnType<typeof toApiUser> | null> {
  try {
    const current = await prisma.user.findUnique({ where: { id } });
    if (!current) return null;

    const data: Prisma.UserUncheckedUpdateInput = { ...patch };
    if (patch.email !== undefined) data.email = patch.email.toLowerCase();
    if (patch.employeeCode !== undefined) data.employeeCode = nullIfEmpty(patch.employeeCode) ?? null;
    if (patch.designation !== undefined) data.designation = nullIfEmpty(patch.designation) ?? null;
    if (patch.department !== undefined) data.department = nullIfEmpty(patch.department) ?? null;
    if (patch.joiningDate !== undefined) data.joiningDate = nullIfEmpty(patch.joiningDate) ?? null;
    if (patch.notes !== undefined) data.notes = nullIfEmpty(patch.notes) ?? null;
    if (patch.birthday !== undefined) data.birthday = nullIfEmpty(patch.birthday) ?? null;
    if (patch.anniversary !== undefined) data.anniversary = nullIfEmpty(patch.anniversary) ?? null;
    if (patch.branchId !== undefined) {
      const branch = await prisma.branch.findUnique({ where: { id: patch.branchId } });
      if (!branch) return null;
      data.organizationId = branch.organizationId;
    }

    const nextActive = patch.isActive ?? current.isActive;
    const wasInactive = !current.isActive;
    if (nextActive && wasInactive) {
      const nextOrgId =
        typeof data.organizationId === "string" && data.organizationId.trim()
          ? data.organizationId
          : current.organizationId;
      await assertCanCreateUser(nextOrgId);
    }

    if (typeof data.employeeCode === "string" && data.employeeCode) {
      const clash = await prisma.user.findFirst({
        where: { employeeCode: data.employeeCode, NOT: { id } },
      });
      if (clash) {
        throw AppError.validation("Employee code is already in use.");
      }
    }
    const row = await prisma.user.update({ where: { id }, data });
    return toApiUser(row);
  } catch (e) {
    if (e && typeof e === "object" && "statusCode" in e) throw e;
    return null;
  }
}
