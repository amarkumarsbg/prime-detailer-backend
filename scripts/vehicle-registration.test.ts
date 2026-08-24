import { test } from "node:test";
import assert from "node:assert";
import { isValidIndianVehicleRegistration } from "../src/modules/vehicles/vehicle-api.controller.js";

test("backend vehicle-registration validation", () => {
  // Standard registration
  assert.strictEqual(isValidIndianVehicleRegistration("KA01AB1234"), true);
  assert.strictEqual(isValidIndianVehicleRegistration("UP24BH5177H"), true);

  // Hyphenated registration
  assert.strictEqual(isValidIndianVehicleRegistration("KA-01-AB-1234"), true);
  assert.strictEqual(isValidIndianVehicleRegistration("UP-24-BH-5177-H"), true);

  // 9-character registration
  assert.strictEqual(isValidIndianVehicleRegistration("KA01AB123"), true);
  assert.strictEqual(isValidIndianVehicleRegistration("DL3CAY123"), true);

  // 10-character registration
  assert.strictEqual(isValidIndianVehicleRegistration("KA01AB1234"), true);
  assert.strictEqual(isValidIndianVehicleRegistration("MH02RK9001"), true);

  // BH-series registration
  assert.strictEqual(isValidIndianVehicleRegistration("22BH1234AA"), true);
  assert.strictEqual(isValidIndianVehicleRegistration("22BH1234A"), true);

  // Lowercase input
  assert.strictEqual(isValidIndianVehicleRegistration("ka-01-ab-1234"), true);
  assert.strictEqual(isValidIndianVehicleRegistration("up24bh5177h"), true);

  // Leading/trailing spaces
  assert.strictEqual(isValidIndianVehicleRegistration("  KA-01-AB-1234  "), true);
  assert.strictEqual(isValidIndianVehicleRegistration("  22BH1234AA  "), true);

  // Invalid special characters
  assert.strictEqual(isValidIndianVehicleRegistration("KA-01-AB-1234$"), false);
  assert.strictEqual(isValidIndianVehicleRegistration("KA-01-AB-1234@"), false);
  assert.strictEqual(isValidIndianVehicleRegistration("KA 01 AB 1234"), false); // space in the middle is invalid

  // Empty registration
  assert.strictEqual(isValidIndianVehicleRegistration(""), false);
  assert.strictEqual(isValidIndianVehicleRegistration("   "), false);
});
