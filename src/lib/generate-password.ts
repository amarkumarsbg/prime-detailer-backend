import { randomInt } from "node:crypto";

function pickChar(set: string): string {
  return set[randomInt(0, set.length)]!;
}

/**
 * Random secure password generator (10 chars) meeting the app-wide strong
 * password policy (mixed case, digit, symbol, length >= 8) — see `password-policy.ts`.
 * Used for staff onboarding and customer-portal credential provisioning.
 */
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

/**
 * Deterministic customer-portal default password: the customer's first name
 * (uppercase) + first 4 digits of their phone number.
 * e.g. "Sanchit Kumar" + "7004509790" -> "SANCHIT7004".
 *
 * Note: this is intentionally predictable (derivable from public-ish info like
 * the customer's name and phone number). There is no forced password-change
 * flow — customers may keep this default indefinitely — so treat it as a
 * low-security default, not a temporary/onboarding-only password.
 */
export function generateCustomerPassword(name: string, phone: string): string {
  const firstName = name.trim().split(/\s+/)[0] ?? "";
  const namePart = (firstName.replace(/[^a-zA-Z]/g, "").toUpperCase() || "CUST").padEnd(4, "X");

  const digits = phone.replace(/\D/g, "").slice(-10); // normalize like phone-match logic elsewhere
  const phonePart = digits.slice(0, 4).padEnd(4, "0");

  return `${namePart}${phonePart}`;
}
