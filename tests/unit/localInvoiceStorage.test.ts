import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveLocalPendingInvoice,
  getLocalPendingInvoices,
  removeLocalPendingInvoice,
  markInvoiceSyncStatus,
  getCachedInvoices,
  setCachedInvoices,
  getPendingSyncCount,
  clearLocalInvoiceStorageForTesting
} from '@/lib/localInvoiceStorage';
import { migrateLegacyAccountInvoices } from '@/lib/localInvoiceStorage';
import { setActiveAccountId } from '@/lib/firebase';
import type { Invoice } from '@/types/domain';

describe('Local Invoice Storage & Offline Queue (src/lib/localInvoiceStorage.ts)', () => {
  const sampleInvoice: Invoice = {
    id: 'test-inv-001',
    invoiceNumber: 'INV-2026-9999',
    customerId: 'cust-123',
    customerName: 'Test Customer',
    issueDate: '2026-09-19',
    dueDate: '2026-10-03',
    currency: 'SAR',
    items: [],
    subtotal: 1000,
    totalDiscount: 0,
    totalTax: 150,
    grandTotal: 1150,
    amountPaid: 0,
    amountDue: 1150,
    status: 'UNPAID',
    createdAt: '2026-09-19T10:00:00.000Z',
    updatedAt: '2026-09-19T10:00:00.000Z'
  };

  beforeEach(() => {
    localStorage.clear();
    setActiveAccountId('default');
    clearLocalInvoiceStorageForTesting();
  });

  it('saves an invoice to pending queue and local cache instantly', () => {
    saveLocalPendingInvoice({
      invoiceId: sampleInvoice.id,
      invoice: sampleInvoice,
      action: 'CREATE'
    });

    const pending = getLocalPendingInvoices();
    expect(pending).toHaveLength(1);
    expect(pending[0].invoiceId).toBe(sampleInvoice.id);
    expect(pending[0].action).toBe('CREATE');
    expect(pending[0].status).toBe('pending');
    expect(pending[0].invoice.syncStatus).toBe('pending');

    const cached = getCachedInvoices();
    expect(cached).toHaveLength(1);
    expect(cached[0].id).toBe(sampleInvoice.id);

    expect(getPendingSyncCount()).toBe(1);
  });

  it('updates sync status when markInvoiceSyncStatus is called', () => {
    saveLocalPendingInvoice({
      invoiceId: sampleInvoice.id,
      invoice: sampleInvoice,
      action: 'CREATE'
    });

    markInvoiceSyncStatus(sampleInvoice.id, 'syncing');
    let pending = getLocalPendingInvoices();
    expect(pending[0].status).toBe('syncing');

    markInvoiceSyncStatus(sampleInvoice.id, 'error', 'Network timeout');
    pending = getLocalPendingInvoices();
    expect(pending[0].status).toBe('error');
    expect(pending[0].error).toBe('Network timeout');
    expect(pending[0].retryCount).toBe(1);
  });

  it('removes pending invoice when sync succeeds and updates cached status to synced', () => {
    saveLocalPendingInvoice({
      invoiceId: sampleInvoice.id,
      invoice: sampleInvoice,
      action: 'CREATE'
    });

    expect(getPendingSyncCount()).toBe(1);

    removeLocalPendingInvoice(sampleInvoice.id);

    expect(getLocalPendingInvoices()).toHaveLength(0);
    expect(getPendingSyncCount()).toBe(0);

    const cached = getCachedInvoices();
    expect(cached).toHaveLength(1);
    expect(cached[0].syncStatus).toBe('synced');
  });

  it('handles multiple cached invoices and preserves order', () => {
    const inv2: Invoice = {
      ...sampleInvoice,
      id: 'test-inv-002',
      invoiceNumber: 'INV-2026-9998'
    };

    setCachedInvoices([sampleInvoice, inv2]);
    const cached = getCachedInvoices();
    expect(cached).toHaveLength(2);
    expect(cached[0].id).toBe(sampleInvoice.id);
    expect(cached[1].id).toBe(inv2.id);
  });

  it('keeps invoice caches and pending queues separate between accounts', () => {
    saveLocalPendingInvoice({ invoiceId: sampleInvoice.id, invoice: sampleInvoice, action: 'CREATE' }, 'company-a');
    expect(getCachedInvoices('company-a')).toHaveLength(1);
    expect(getCachedInvoices('company-b')).toEqual([]);
    expect(getLocalPendingInvoices('company-b')).toEqual([]);
    removeLocalPendingInvoice(sampleInvoice.id, 'company-b');
    expect(getLocalPendingInvoices('company-a')).toHaveLength(1);
  });

  it('migrates legacy invoices only to the account owning their customers and preserves the source cache', () => {
    saveLocalPendingInvoice({ invoiceId: sampleInvoice.id, invoice: sampleInvoice, action: 'CREATE' }, 'default');
    localStorage.setItem('meezan_local_customers_company-a', JSON.stringify([{ id: sampleInvoice.customerId }]));
    migrateLegacyAccountInvoices('company-b');
    expect(getCachedInvoices('company-b')).toEqual([]);
    migrateLegacyAccountInvoices('company-a');
    expect(getCachedInvoices('company-a')[0].id).toBe(sampleInvoice.id);
    expect(getCachedInvoices('default')[0].id).toBe(sampleInvoice.id);
    expect(getLocalPendingInvoices('company-a')).toHaveLength(1);
    expect(getLocalPendingInvoices('default')).toEqual([]);
    migrateLegacyAccountInvoices('company-a');
    expect(getLocalPendingInvoices('company-a')).toHaveLength(1);
  });
});
