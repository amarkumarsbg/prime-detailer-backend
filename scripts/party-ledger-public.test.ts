import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPublicCustomerStatement } from "../src/lib/party-ledger.ts";
import type { Invoice } from "../src/types/finance-documents.ts";
import type { Party } from "../src/types/party.ts";

function party(overrides: Partial<Party> = {}): Party {
  return {
    id: "c:cust-1",
    kind: "customer",
    name: "Danish",
    openingBalance: 0,
    openingBalanceSide: "toCollect",
    customFields: [],
    customerId: "cust-1",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    ...overrides,
  };
}

function invoice(overrides: Partial<Invoice> & Pick<Invoice, "id" | "grandTotal" | "createdAt">): Invoice {
  return {
    invoiceNumber: overrides.invoiceNumber ?? "INV-1",
    jobCardId: "jc-1",
    jobNumber: "JC-1",
    customerId: "cust-1",
    customerName: "Danish",
    customerPhone: "9889574310",
    vehicleRegNumber: "UP16AB1234",
    lineItems: [],
    subtotal: overrides.grandTotal,
    taxRate: 0,
    taxAmount: 0,
    discountAmount: 0,
    rewardDiscount: 0,
    walletAmountUsed: 0,
    status: "ISSUED",
    payments: [],
    ...overrides,
  };
}

describe("buildPublicCustomerStatement", () => {
  it("puts invoice amount in Debit and payment in Credit on the same row", () => {
    const invoices: Invoice[] = [
      invoice({
        id: "a",
        invoiceNumber: "1216",
        grandTotal: 400,
        createdAt: "2026-04-24T10:00:00.000Z",
        status: "PAID",
        payments: [
          {
            id: "p1",
            invoiceId: "a",
            amount: 400,
            method: "CASH",
            paidAt: "2026-04-24T11:00:00.000Z",
          },
        ],
      }),
      invoice({
        id: "b",
        invoiceNumber: "1953",
        grandTotal: 400,
        createdAt: "2026-08-16T10:00:00.000Z",
        status: "ISSUED",
        payments: [],
      }),
    ];

    const lines = buildPublicCustomerStatement(party(), invoices, "all");
    const sales = lines.filter((l) => !l.isSummary);

    assert.equal(sales.length, 2);
    assert.equal(sales[0]!.debit, 400);
    assert.equal(sales[0]!.credit, 400);
    assert.equal(sales[0]!.balance, 0);
    assert.equal(sales[0]!.dueLabel, "Paid");

    assert.equal(sales[1]!.debit, 400);
    assert.equal(sales[1]!.credit, undefined);
    assert.equal(sales[1]!.balance, 400);
    assert.match(sales[1]!.dueLabel ?? "", /Unpaid$/);

    const closing = lines.find((l) => l.id === "closing");
    assert.equal(closing?.debit, 400);
    assert.equal(closing?.balance, 400);

    const opening = lines.find((l) => l.id === "opening");
    assert.equal(opening?.debit, 0);
  });

  it("exposes invoice-level due on a partially paid invoice without changing running balance", () => {
    const invoices: Invoice[] = [
      invoice({
        id: "0341",
        invoiceNumber: "INV-2026-0341",
        grandTotal: 1710,
        createdAt: "2026-08-18T10:00:00.000Z",
        status: "PARTIALLY_PAID",
        payments: [
          {
            id: "p-partial",
            invoiceId: "0341",
            amount: 1000,
            method: "CASH",
            paidAt: "2026-08-18T12:00:00.000Z",
          },
        ],
      }),
    ];
    const lines = buildPublicCustomerStatement(party(), invoices, "all");
    const row = lines.find((l) => l.serialNo === "INV-2026-0341");
    assert.equal(row?.debit, 1710);
    assert.equal(row?.credit, 1000);
    assert.equal(row?.invoiceDue, 710);
    assert.equal(row?.balance, 710);
    assert.match(row?.dueLabel ?? "", /Partially Paid/);
  });

  it("does not emit separate Payment In rows", () => {
    const invoices: Invoice[] = [
      invoice({
        id: "a",
        grandTotal: 400,
        createdAt: "2026-04-24T10:00:00.000Z",
        payments: [
          {
            id: "p1",
            invoiceId: "a",
            amount: 400,
            method: "CASH",
            paidAt: "2026-04-24T11:00:00.000Z",
          },
        ],
      }),
    ];
    const lines = buildPublicCustomerStatement(party(), invoices, "all");
    assert.equal(lines.some((l) => l.voucher === "Payment In"), false);
  });
});
