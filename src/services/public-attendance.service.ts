import type { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

function normalizePin(pin: string): string {
  return pin.replace(/\D/g, "").trim();
}

/** Branches default to `qr-<id>` when no explicit QR id was stored. */
function expectedQrCodeId(branchId: string, stored: string | null): string {
  return stored?.trim() || `qr-${branchId}`;
}

export type AttendanceContextResult =
  | { ok: true; branch: { id: string; name: string }; qrCodeId: string }
  | { ok: false; error: "BRANCH_NOT_FOUND" | "INVALID_QR" };

export async function getBranchAttendanceContext(
  branchId: string,
  qr?: string | null
): Promise<AttendanceContextResult> {
  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch || !branch.isActive) {
    return { ok: false, error: "BRANCH_NOT_FOUND" };
  }

  const expectedQr = expectedQrCodeId(branch.id, branch.qrCodeId);
  const qrTrim = qr?.trim();
  if (qrTrim && qrTrim !== expectedQr) {
    return { ok: false, error: "INVALID_QR" };
  }

  return {
    ok: true,
    branch: { id: branch.id, name: branch.name },
    qrCodeId: expectedQr,
  };
}

export type ResolvePinResult =
  | {
      ok: true;
      staff: { id: string; name: string; role: UserRole; branchId: string };
    }
  | { ok: false; error: "INVALID_PIN" | "WRONG_BRANCH" };

export async function resolveAttendancePin(
  pin: string,
  branchId: string
): Promise<ResolvePinResult> {
  const digits = normalizePin(pin);
  if (!digits) {
    return { ok: false, error: "INVALID_PIN" };
  }

  const user = await prisma.user.findFirst({
    where: { attendancePin: digits, isActive: true },
    select: { id: true, name: true, role: true, branchId: true },
  });

  if (!user) {
    return { ok: false, error: "INVALID_PIN" };
  }

  if (user.branchId !== branchId) {
    return { ok: false, error: "WRONG_BRANCH" };
  }

  return {
    ok: true,
    staff: {
      id: user.id,
      name: user.name,
      role: user.role,
      branchId: user.branchId,
    },
  };
}
