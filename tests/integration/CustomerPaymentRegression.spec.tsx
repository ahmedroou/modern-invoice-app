import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCustomers } from '@/hooks/useCustomers';
import { useInvoices } from '@/hooks/useInvoices';
import { usePayments } from '@/hooks/usePayments';
import { useCustomerLedger } from '@/hooks/useCustomerLedger';
import { getCachedInvoices, setCachedInvoices, getLocalPendingInvoices } from '@/lib/localInvoiceStorage';
import { setActiveAccountId } from '@/lib/firebase';
import type { Invoice } from '@/types/domain';

vi.mock('firebase/firestore', async importOriginal => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    onSnapshot: (_ref: unknown, _options: unknown, next: (snapshot: unknown) => void) => {
      queueMicrotask(() => next({ docs: [], forEach: () => {}, metadata: { hasPendingWrites: false, fromCache: true } }));
      return vi.fn();
    },
    writeBatch: () => ({ set: vi.fn(), update: vi.fn(), delete: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) })
  };
});

const invoice: Invoice = {
  id: 'invoice-regression', invoiceNumber: 'INV-REGRESSION', customerId: 'customer-regression', customerName: 'New Customer',
  issueDate: '2026-10-18', dueDate: '2099-01-01', currency: 'SAR', items: [], subtotal: 1000, totalDiscount: 0,
  totalTax: 0, grandTotal: 1000, amountPaid: 0, amountDue: 1000, status: 'UNPAID', createdAt: '2026-10-18T10:00:00Z', updatedAt: '2026-10-18T10:00:00Z'
};

describe('Customer and payment cache regressions', () => {
  beforeEach(() => { localStorage.clear(); setActiveAccountId('default'); });

  it('opens a just-created customer from the shared directory cache before cloud snapshots arrive', async () => {
    const directory = renderHook(() => useCustomers());
    let customerId = '';
    await act(async () => {
      const customer = await directory.result.current.createCustomer({ name: 'New Customer', currency: 'SAR', status: 'ACTIVE' });
      customerId = customer.id;
    });
    const ledger = renderHook(() => useCustomerLedger(customerId));
    await waitFor(() => expect(ledger.result.current.loading).toBe(false));
    expect(ledger.result.current.customer?.name).toBe('New Customer');
    expect(ledger.result.current.metrics.outstandingBalance).toBe(0);
  });

  it('updates all mounted invoice views and the customer ledger after partial and full payments, including remount', async () => {
    setCachedInvoices([invoice]);
    localStorage.setItem('meezan_local_customers_default', JSON.stringify([{ id: invoice.customerId, name: invoice.customerName, currency: 'SAR', status: 'ACTIVE', outstandingAmount: 1000 }]));
    const invoices = renderHook(() => useInvoices());
    const ledger = renderHook(() => useCustomerLedger(invoice.customerId));
    const payments = renderHook(() => usePayments());
    await waitFor(() => expect(invoices.result.current.loading).toBe(false));
    await act(async () => {
      await payments.result.current.recordPayment({
        payment: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, customerId: invoice.customerId, customerName: invoice.customerName, amount: 250, paymentNumber: 'PAY-1', paymentDate: '2026-10-18', paymentMethod: 'CASH' },
        currentInvoice: invoice
      });
    });
    expect(invoices.result.current.rawInvoices[0]).toMatchObject({ amountPaid: 250, amountDue: 750, status: 'PARTIALLY_PAID' });
    expect(invoices.result.current.metrics).toMatchObject({ totalRevenue: 250, totalReceivables: 750 });
    await waitFor(() => expect(ledger.result.current.metrics).toMatchObject({ totalInvoiced: 1000, totalPaid: 250, outstandingBalance: 750 }));
    expect(getCachedInvoices()[0].amountDue).toBe(750);
    invoices.unmount();
    const reopened = renderHook(() => useInvoices());
    await waitFor(() => expect(reopened.result.current.loading).toBe(false));
    expect(reopened.result.current.rawInvoices[0].amountDue).toBe(750);
    await act(async () => {
      await payments.result.current.recordPayment({
        payment: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, customerId: invoice.customerId, customerName: invoice.customerName, amount: 750, paymentNumber: 'PAY-2', paymentDate: '2026-10-18', paymentMethod: 'CASH' },
        currentInvoice: reopened.result.current.rawInvoices[0]
      });
    });
    expect(reopened.result.current.rawInvoices[0]).toMatchObject({ amountPaid: 1000, amountDue: 0, status: 'PAID' });
    await waitFor(() => expect(ledger.result.current.metrics).toMatchObject({ totalPaid: 1000, outstandingBalance: 0 }));
  });

  it('submits a new invoice once to the Firestore local write queue instead of the legacy replay queue', async () => {
    const invoices = renderHook(() => useInvoices());
    await act(async () => { await invoices.result.current.createInvoice(invoice); });
    expect(invoices.result.current.rawInvoices[0].id).toBe(invoice.id);
    expect(getLocalPendingInvoices()).toEqual([]);
  });
});
