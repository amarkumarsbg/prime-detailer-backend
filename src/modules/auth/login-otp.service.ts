import { prisma } from "../../lib/prisma.js";
import type { User } from "@prisma/client";

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/** Match seed phones like +91-9876543210 to the last 10 digits entered in the UI. */
export async function findActiveUserByTenDigitPhone(ten: string): Promise<User | null> {
  if (ten.length !== 10) return null;
  const users = await prisma.user.findMany({ where: { isActive: true } });
  for (const u of users) {
    const d = digitsOnly(u.phone);
    if (d.endsWith(ten)) return u;
  }
  return null;
}

type OtpEntry = { code: string; expiresAt: number };

const otpByPhone = new Map<string, OtpEntry>();

const OTP_TTL_MS = 10 * 60 * 1000;

export function issueLoginOtp(phoneTen: string): string {
  const code = String(Math.floor(1000 + Math.random() * 9000));
  otpByPhone.set(phoneTen, { code, expiresAt: Date.now() + OTP_TTL_MS });
  return code;
}

export function consumeLoginOtpIfValid(phoneTen: string, entered: string): boolean {
  const entry = otpByPhone.get(phoneTen);
  if (!entry || entry.expiresAt < Date.now()) {
    if (entry) otpByPhone.delete(phoneTen);
    return false;
  }
  if (entry.code !== entered) return false;
  otpByPhone.delete(phoneTen);
  return true;
}

/**
 * Optional bypass for local/demo. Set LOGIN_OTP_DEMO_CODE= to disable.
 * When unset, defaults to 1234.
 */
export function isDemoLoginOtp(entered: string): boolean {
  const raw = process.env.LOGIN_OTP_DEMO_CODE;
  if (raw === "") return false;
  const expected = raw ?? "1234";
  return entered === expected;
}
