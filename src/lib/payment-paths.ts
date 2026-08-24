export function salesInvoiceDetailPath(invoiceId: string): string {
  return `/billing/invoices/${encodeURIComponent(invoiceId)}`;
}

export function paymentInDetailPath(paymentId: string): string {
  return `/billing/payments/${encodeURIComponent(paymentId)}`;
}
