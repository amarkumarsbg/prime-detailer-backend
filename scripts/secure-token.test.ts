import { test } from "node:test";
import assert from "node:assert";
import { generateJobCardSecureToken, verifyJobCardSecureToken } from "../src/lib/secure-token.js";

test("secure token generation and verification", () => {
  const jobCardId = "jc-12345";
  const token = generateJobCardSecureToken(jobCardId);

  // Token should contain the ID and a signature
  assert.ok(token.startsWith(jobCardId + "."));
  assert.notStrictEqual(token, jobCardId);

  // Verification should succeed with a valid token
  const verifiedId = verifyJobCardSecureToken(token);
  assert.strictEqual(verifiedId, jobCardId);

  // Verification should fail with an invalid token
  const invalidToken = token + "modified";
  const verifiedInvalid = verifyJobCardSecureToken(invalidToken);
  assert.strictEqual(verifiedInvalid, null);

  // Verification should fail with an empty token
  assert.strictEqual(verifyJobCardSecureToken(""), null);
  assert.strictEqual(verifyJobCardSecureToken(null as any), null);
});
