import { parsePagination } from "../pagination.js";
import { describe, it } from "node:test";
import assert from "node:assert";
import type { Request } from "express";

describe("parsePagination", () => {
  it("defaults to page 1, pageSize 10 when parameters are omitted", () => {
    const req = { query: {} } as unknown as Request;
    const result = parsePagination(req);
    assert.deepStrictEqual(result, { page: 1, pageSize: 10 });
  });

  it("parses valid page and pageSize", () => {
    const req = { query: { page: "2", pageSize: "20" } } as unknown as Request;
    const result = parsePagination(req);
    assert.deepStrictEqual(result, { page: 2, pageSize: 20 });
  });

  it("parses pageSize 50 correctly", () => {
    const req = { query: { page: "5", pageSize: "50" } } as unknown as Request;
    const result = parsePagination(req);
    assert.deepStrictEqual(result, { page: 5, pageSize: 50 });
  });

  it("caps pageSize to 50 if greater than 50", () => {
    const req = { query: { page: "1", pageSize: "100" } } as unknown as Request;
    const result = parsePagination(req);
    assert.deepStrictEqual(result, { page: 1, pageSize: 50 });
  });
  
  it("caps pageSize to 50 if very large (e.g. 5000)", () => {
    const req = { query: { page: "1", pageSize: "5000" } } as unknown as Request;
    const result = parsePagination(req);
    assert.deepStrictEqual(result, { page: 1, pageSize: 50 });
  });

  it("snaps invalid pageSize to allowed values (10, 20, 50)", () => {
    assert.strictEqual(parsePagination({ query: { pageSize: "40" } } as unknown as Request).pageSize, 20);
    assert.strictEqual(parsePagination({ query: { pageSize: "15" } } as unknown as Request).pageSize, 10);
    assert.strictEqual(parsePagination({ query: { pageSize: "5" } } as unknown as Request).pageSize, 10);
  });

  it("handles invalid string page safely", () => {
    const req = { query: { page: "invalid" } } as unknown as Request;
    const result = parsePagination(req);
    assert.strictEqual(result.page, 1);
  });

  it("handles invalid string pageSize safely", () => {
    const req = { query: { pageSize: "invalid" } } as unknown as Request;
    const result = parsePagination(req);
    assert.strictEqual(result.pageSize, 10);
  });
  
  it("handles negative page numbers safely", () => {
    const req = { query: { page: "-5" } } as unknown as Request;
    const result = parsePagination(req);
    assert.strictEqual(result.page, 1);
  });
});
