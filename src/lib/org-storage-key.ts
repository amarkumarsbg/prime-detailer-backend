/** Build org-scoped object storage key prefixes (S3 and local uploads/). */
export function sanitizeOrgIdForStorage(organizationId: string): string {
  const safe = organizationId.trim().replace(/[^\w-]/g, "_").slice(0, 64);
  return safe || "org-unknown";
}

/**
 * Prefix for tenant object keys: `orgs/{organizationId}/…`
 * Legacy unprefixed keys remain readable; new writes always use this prefix.
 */
export function orgStorageKeyPrefix(organizationId: string): string {
  return `orgs/${sanitizeOrgIdForStorage(organizationId)}`;
}

export function orgObjectKey(organizationId: string, ...segments: string[]): string {
  const parts = segments
    .map((s) => String(s).replace(/^\/+|\/+$/g, ""))
    .filter(Boolean);
  return [orgStorageKeyPrefix(organizationId), ...parts].join("/");
}
