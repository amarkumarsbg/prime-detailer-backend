import crypto from "crypto";
import { env } from "../config/env.js";

/**
 * Generates a secure token for a Job Card using its ID and a cryptographic signature.
 */
export function generateJobCardSecureToken(jobCardId: string): string {
  const secret = env.JWT_SECRET || "default_secret_fallback_for_secure_tokens";
  const signature = crypto
    .createHmac("sha256", secret)
    .update(jobCardId)
    .digest("hex")
    .slice(0, 16);
  return `${jobCardId}.${signature}`;
}

/**
 * Verifies a secure token and returns the corresponding Job Card ID if valid, or null if invalid.
 */
export function verifyJobCardSecureToken(token: string): string | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [jobCardId, signature] = parts;
  if (!jobCardId || !signature) return null;

  const expected = generateJobCardSecureToken(jobCardId);
  if (token === expected) {
    return jobCardId;
  }
  return null;
}
