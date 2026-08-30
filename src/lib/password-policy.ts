import { z } from "zod";

/** User-visible requirement text (keep aligned with `validateStrongPassword`). */
export const PASSWORD_POLICY_HINT =
  "At least 8 characters with uppercase, lowercase, a number, and a special character (#@$%&*!?+-).";

/** Returns an error message, or null if the password satisfies policy. */
export function validateStrongPassword(plain: string): string | null {
  if (plain.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(plain)) return "Password must include an uppercase letter.";
  if (!/[a-z]/.test(plain)) return "Password must include a lowercase letter.";
  if (!/[0-9]/.test(plain)) return "Password must include a number.";
  if (!/[#@$%&*!?+-]/.test(plain))
    return "Password must include one of these special characters: # @ $ % & * ! ? + -";
  return null;
}

/** Use with `.password`, `.newPassword`, etc. */
export const strongPasswordSchema = z.string().superRefine((val, ctx) => {
  const msg = validateStrongPassword(val);
  if (msg) ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg });
});

/**
 * Relaxed policy for customer-portal passwords. The deterministic default
 * (first name + first 4 phone digits, e.g. "SANCHIT7004") is simple by design
 * and must not be rejected by staff typing/reusing that same format — so this
 * only enforces a minimum length, not the staff-grade complexity rules.
 */
export const CUSTOMER_PASSWORD_POLICY_HINT = "At least 6 characters.";

export function validateCustomerPassword(plain: string): string | null {
  if (plain.length < 6) return "Password must be at least 6 characters.";
  return null;
}

/** Use with customer-portal `.password` / `.newPassword` fields. */
export const customerPasswordSchema = z.string().superRefine((val, ctx) => {
  const msg = validateCustomerPassword(val);
  if (msg) ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg });
});
