/** Shapes stored in AppJsonRow for invoices / expenses (aligned with frontend types). */

export type InvoiceStatus = "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID";

export interface InvoicePayment {
  id: string;
  invoiceId: string;
  amount: number;
  method: string;
  referenceNumber?: string;
  paidAt: string;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  type: string;
  quantity: number;
  unitPrice: number;
  total: number;
  hsnSac?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  jobCardId?: string;
  jobNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  vehicleRegNumber: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  rewardDiscount: number;
  walletAmountUsed: number;
  grandTotal: number;
  status: InvoiceStatus;
  payments: InvoicePayment[];
  createdAt: string;
  source?: "COUNTER_SALE" | "MEMBERSHIP";
  branchId?: string;
}

export type ExpensePaymentStatus = "PAID" | "PENDING" | "PARTIAL" | "OVERDUE";

export interface Expense {
  id: string;
  title: string;
  category: string;
  amount: number;
  amountPaid?: number;
  date: string;
  vendorName?: string;
  paymentStatus: ExpensePaymentStatus;
  paymentMethod: string;
  createdAt: string;
}

export type PaymentInDetail = {
  payment: InvoicePayment;
  invoice: Invoice;
  partyId: string;
  partyName: string;
};
