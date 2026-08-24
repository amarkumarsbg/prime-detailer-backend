import { prisma } from "../../lib/prisma.js";

export async function handleInvoiceWalletSync(
  organizationId: string,
  invoiceId: string,
  newInvoice: any
) {
  // Fetch existing invoice to compare payments and wallet usage
  const oldInvoiceRow = await prisma.appJsonRow.findUnique({
    where: { collection_entityId: { collection: "invoices", entityId: invoiceId } },
  });
  if (oldInvoiceRow && oldInvoiceRow.organizationId !== organizationId) {
    throw new Error("Invoice belongs to another organization");
  }
  const oldInvoice = oldInvoiceRow ? (oldInvoiceRow.payload as any) : null;
  const customerId = newInvoice.customerId;
  if (!customerId) return;

  // Perform all database operations inside a single Prisma transaction to ensure strict consistency
  await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({
      where: { id: customerId, organizationId },
    });
    if (!customer) return;

    let walletBalance = customer.walletBalance;

    // 1. Process walletAmountUsed changes (DEBITS/CREDITS)
    const oldWalletUsed = oldInvoice ? (oldInvoice.walletAmountUsed || 0) : 0;
    const newWalletUsed = newInvoice.walletAmountUsed || 0;
    const walletUsedDiff = Math.round((newWalletUsed - oldWalletUsed) * 100) / 100;

    if (walletUsedDiff > 0) {
      // Customer used more wallet balance to pay invoice -> DEBIT wallet
      if (walletBalance < walletUsedDiff) {
        throw new Error(`Insufficient wallet balance: required ₹${walletUsedDiff}, available ₹${walletBalance}`);
      }
      walletBalance = Math.round((walletBalance - walletUsedDiff) * 100) / 100;
      
      const txId = `wtx-deb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const walletTx = {
        id: txId,
        customerId,
        customerName: customer.name,
        type: "DEBIT",
        amount: walletUsedDiff,
        source: "INVOICE_PAYMENT",
        referenceId: newInvoice.invoiceNumber || invoiceId,
        description: `Used for invoice ${newInvoice.invoiceNumber || invoiceId}`,
        balanceAfter: walletBalance,
        createdAt: new Date().toISOString(),
      };
      
      await tx.appJsonRow.create({
        data: {
          collection: "walletTransactions",
          entityId: txId,
          organizationId,
          payload: walletTx as any,
        },
      });
    } else if (walletUsedDiff < 0) {
      // Wallet usage was reduced/removed -> CREDIT wallet back (refund/reversal)
      const refundAmount = Math.abs(walletUsedDiff);
      walletBalance = Math.round((walletBalance + refundAmount) * 100) / 100;

      const txId = `wtx-crd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const walletTx = {
        id: txId,
        customerId,
        customerName: customer.name,
        type: "CREDIT",
        amount: refundAmount,
        source: "REFUND",
        referenceId: newInvoice.invoiceNumber || invoiceId,
        description: `Reversal of wallet usage on invoice ${newInvoice.invoiceNumber || invoiceId}`,
        balanceAfter: walletBalance,
        createdAt: new Date().toISOString(),
      };
      
      await tx.appJsonRow.create({
        data: {
          collection: "walletTransactions",
          entityId: txId,
          organizationId,
          payload: walletTx as any,
        },
      });
    }

    // 2. Process payments list changes (CREDITS from extra payment, or DEBITS from payment deletion)
    const oldPayments: any[] = oldInvoice?.payments || [];
    const newPayments: any[] = newInvoice.payments || [];

    // Find new payments that weren't in oldInvoice.payments
    for (const payment of newPayments) {
      // If payment has a stamp for walletTransactionId, it was already processed
      if (payment.walletTransactionId) {
        continue;
      }
      
      // If payment has addExtraToWallet = true and extraAmount > 0
      if (payment.addExtraToWallet && payment.extraAmount > 0) {
        const extra = payment.extraAmount;
        walletBalance = Math.round((walletBalance + extra) * 100) / 100;

        const txId = `wtx-pay-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const walletTx = {
          id: txId,
          customerId,
          customerName: customer.name,
          type: "CREDIT",
          amount: extra,
          source: "INVOICE_PAYMENT",
          referenceId: newInvoice.invoiceNumber || invoiceId,
          description: `Extra payment for invoice ${newInvoice.invoiceNumber || invoiceId}`,
          balanceAfter: walletBalance,
          createdAt: new Date().toISOString(),
        };

        await tx.appJsonRow.create({
          data: {
            collection: "walletTransactions",
            entityId: txId,
            organizationId,
            payload: walletTx as any,
          },
        });

        // Stamp the payment so we don't process it again
        payment.walletTransactionId = txId;
      }
    }

    // Find deleted payments (were in oldPayments, not in newPayments)
    for (const oldPay of oldPayments) {
      const isStillPresent = newPayments.some((np) => np.id === oldPay.id);
      if (!isStillPresent && oldPay.walletTransactionId) {
        // This payment was deleted and had created a wallet credit! We must reverse it.
        if (oldPay.addExtraToWallet && oldPay.extraAmount > 0) {
          const extra = oldPay.extraAmount;
          if (walletBalance < extra) {
            throw new Error(`Cannot delete payment: reversing wallet credit of ₹${extra} would make wallet negative.`);
          }
          walletBalance = Math.round((walletBalance - extra) * 100) / 100;

          const txId = `wtx-rev-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const walletTx = {
            id: txId,
            customerId,
            customerName: customer.name,
            type: "DEBIT",
            amount: extra,
            source: "REFUND",
            referenceId: newInvoice.invoiceNumber || invoiceId,
            description: `Reversal of extra payment on invoice ${newInvoice.invoiceNumber || invoiceId}`,
            balanceAfter: walletBalance,
            createdAt: new Date().toISOString(),
          };

          await tx.appJsonRow.create({
            data: {
              collection: "walletTransactions",
              entityId: txId,
              organizationId,
              payload: walletTx as any,
            },
          });
        }
      }
    }

    // Update customer wallet balance in database
    await tx.customer.update({
      where: { id: customerId },
      data: { walletBalance },
    });
  });
}
