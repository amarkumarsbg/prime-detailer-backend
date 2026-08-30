import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateCustomerPassword } from "../generate-password.js";

describe("generateCustomerPassword", () => {
  it("matches the documented example: Sanchit Kumar + 7004509790 -> SANCHIT7004", () => {
    assert.equal(generateCustomerPassword("Sanchit Kumar", "7004509790"), "SANCHIT7004");
  });

  it("uses only the first name, uppercased", () => {
    assert.equal(generateCustomerPassword("ravi sharma", "9876543210"), "RAVI9876");
  });

  it("strips non-letter characters from the first name", () => {
    assert.equal(generateCustomerPassword("O'Brien-123 Smith", "9876543210"), "OBRIEN9876");
  });

  it("pads a 1-2 letter first name with X to at least 4 chars", () => {
    assert.equal(generateCustomerPassword("Al", "9876543210"), "ALXX9876");
  });

  it("normalizes phone with country code / formatting to last 10 digits first", () => {
    assert.equal(generateCustomerPassword("Sanchit Kumar", "+91-7004509790"), "SANCHIT7004");
  });

  it("pads short phone numbers with 0", () => {
    assert.equal(generateCustomerPassword("Sanchit Kumar", "70"), "SANCHIT7000");
  });

  it("falls back to CUST when the name has no letters", () => {
    assert.equal(generateCustomerPassword("123", "9876543210"), "CUST9876");
  });

  it("single-word name works the same as first name of a multi-word name", () => {
    assert.equal(generateCustomerPassword("Sanchit", "7004509790"), "SANCHIT7004");
  });
});
