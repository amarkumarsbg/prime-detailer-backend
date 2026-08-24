import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Auth gate for `X-Internal-Job-Key` (same rules as requireInternalJobSecretOnly).
 */
function checkSecretAuth(opts: {
  configured: string;
  headerKey: string;
}): { status?: number; code?: string; ok?: boolean } {
  const configured = opts.configured.trim();
  const key = opts.headerKey.trim();
  if (!configured) {
    return { status: 503, code: "JOB_SECRET_NOT_CONFIGURED" };
  }
  if (!key || key !== configured) {
    return { status: 401, code: "JOB_UNAUTHORIZED" };
  }
  return { ok: true };
}

describe("internal job auth", () => {
  it("Unauthorized job request", () => {
    const missing = checkSecretAuth({
      configured: "prod-cron-secret-value-here",
      headerKey: "",
    });
    assert.equal(missing.status, 401);
    assert.equal(missing.code, "JOB_UNAUTHORIZED");

    const wrong = checkSecretAuth({
      configured: "prod-cron-secret-value-here",
      headerKey: "nope",
    });
    assert.equal(wrong.status, 401);
  });

  it("Authorized job request", () => {
    const r = checkSecretAuth({
      configured: "prod-cron-secret-value-here",
      headerKey: "prod-cron-secret-value-here",
    });
    assert.equal(r.ok, true);
  });
});
