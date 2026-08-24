import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { validateStrongPassword } from "../../lib/password-policy.js";

const RESET_TTL_MS = 60 * 60 * 1000;

export function hashPasswordResetToken(plain: string): string {
  return createHash("sha256").update(plain, "utf8").digest("hex");
}

export function createPasswordResetPlainToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function issuePasswordResetForUser(
  userId: string,
  plainToken: string
): Promise<void> {
  const tokenHash = hashPasswordResetToken(plainToken);
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);
  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE "User"
      SET "passwordResetTokenHash" = ${tokenHash},
          "passwordResetExpiresAt" = ${expiresAt}
      WHERE id = ${userId}
    `
  );
}

/** Clears a pending reset after a failed outbound email (e.g. production). */
export async function clearPasswordResetForUser(userId: string): Promise<void> {
  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE "User"
      SET "passwordResetTokenHash" = NULL,
          "passwordResetExpiresAt" = NULL
      WHERE id = ${userId}
    `
  );
}

export type ConsumeResetPasswordResult =
  | { ok: true }
  | { ok: false; reason: "INVALID" | "EXPIRED" };

type PendingResetRow = {
  isActive: boolean;
  passwordResetExpiresAt: Date | null;
};

type ConsumeResetRow = PendingResetRow & { id: string };

/** True only while this token is stored on a user and not past expiry (reset not yet completed). */
export async function isPasswordResetTokenPending(plainToken: string): Promise<boolean> {
  if (!plainToken.trim()) return false;
  const tokenHash = hashPasswordResetToken(plainToken.trim());
  const rows = await prisma.$queryRaw<PendingResetRow[]>(
    Prisma.sql`
      SELECT "isActive", "passwordResetExpiresAt"
      FROM "User"
      WHERE "passwordResetTokenHash" = ${tokenHash}
      LIMIT 1
    `
  );
  const user = rows[0];
  if (!user?.isActive) return false;
  if (
    !user.passwordResetExpiresAt ||
    user.passwordResetExpiresAt.getTime() <= Date.now()
  ) {
    return false;
  }
  return true;
}

export async function consumePasswordResetToken(
  plainToken: string,
  newPassword: string
): Promise<ConsumeResetPasswordResult> {
  if (!plainToken.trim()) {
    return { ok: false, reason: "INVALID" };
  }
  if (validateStrongPassword(newPassword) !== null) {
    return { ok: false, reason: "INVALID" };
  }
  const tokenHash = hashPasswordResetToken(plainToken);
  const rows = await prisma.$queryRaw<ConsumeResetRow[]>(
    Prisma.sql`
      SELECT id, "isActive", "passwordResetExpiresAt"
      FROM "User"
      WHERE "passwordResetTokenHash" = ${tokenHash}
      LIMIT 1
    `
  );
  const user = rows[0];
  if (!user || !user.isActive) return { ok: false, reason: "INVALID" };
  if (
    !user.passwordResetExpiresAt ||
    user.passwordResetExpiresAt.getTime() <= Date.now()
  ) {
    return { ok: false, reason: "EXPIRED" };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const passwordUpdatedAt = new Date();
  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE "User"
      SET "passwordHash" = ${passwordHash},
          "mustChangePassword" = false,
          "passwordUpdatedAt" = ${passwordUpdatedAt},
          "passwordResetTokenHash" = NULL,
          "passwordResetExpiresAt" = NULL
      WHERE id = ${user.id}
    `
  );

  return { ok: true };
}
