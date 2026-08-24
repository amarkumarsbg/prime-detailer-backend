export type PartyKind = "customer" | "supplier";
export type OpeningBalanceSide = "toCollect" | "toPay";

export interface PartyCustomField {
  key: string;
  value: string;
}

export interface PartyBankAccount {
  id: string;
  accountNumber: string;
  ifsc?: string;
  accountHolderName?: string;
  bankName?: string;
  branchName?: string;
  upiId?: string;
}

export interface PartyShippingAddress {
  id: string;
  name: string;
  street: string;
  state?: string;
  pincode?: string;
  city?: string;
  isDefault?: boolean;
}

export interface Party {
  id: string;
  kind: PartyKind;
  name: string;
  category?: string;
  mobile?: string;
  email?: string;
  gstin?: string;
  pan?: string;
  billingAddress?: string;
  shippingAddress?: string;
  openingBalance: number;
  openingBalanceSide?: OpeningBalanceSide;
  creditPeriodDays?: number;
  creditLimit?: number;
  contactPersonName?: string;
  dateOfBirth?: string;
  bankAccounts?: PartyBankAccount[];
  shippingAddresses?: PartyShippingAddress[];
  customFields: PartyCustomField[];
  customerId?: string;
  vendorKey?: string;
  createdAt: string;
  updatedAt: string;
}

export type PartyTransactionRow = {
  id: string;
  at: string;
  typeLabel: string;
  reference: string;
  amount: number;
  unpaidAmount?: number;
  status: string;
  statusTone: "success" | "warning" | "muted";
  href?: string;
};

export type PartyStatementLine = {
  id: string;
  date: string;
  voucher: string;
  serialNo: string;
  paymentMode: string;
  credit?: number;
  debit?: number;
  balance: number;
  /** Invoice-level outstanding (debit − credit) when the invoice is partially paid. */
  invoiceDue?: number;
  dueLabel?: string;
  isSummary?: boolean;
};

export type PartyItemWiseRow = {
  itemName: string;
  itemCode: string;
  salesQuantity: number;
  salesUnit: string;
  salesAmount: number;
  purchaseQuantity: number;
  purchaseUnit: string;
  purchaseAmount: number;
};

export type PartyLedgerSummary = {
  totalReceivableOrPayable: number;
  overdueAmount: number;
  totalSalesOrPurchases: number;
  totalReceivedOrPaid: number;
};

export type PartyWithBalance = Party & { balance: number };

export type PartyLedgerBundle = {
  balance: number;
  summary: PartyLedgerSummary;
  transactions: PartyTransactionRow[];
  statement: PartyStatementLine[];
  itemWise: PartyItemWiseRow[];
};
