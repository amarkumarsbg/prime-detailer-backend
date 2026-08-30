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
