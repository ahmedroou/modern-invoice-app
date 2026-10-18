import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  saveLocalPendingInvoice,
  getLocalPendingInvoices,
  clearLocalInvoiceStorageForTesting
} from '@/lib/localInvoiceStorage';
import { syncPendingInvoices } from '@/lib/backgroundSyncService';
import type { Invoice } from '@/types/domain';

const mockCreateInvoiceAtomic = vi.fn().mockResolvedValue({ invoiceId: 'inv-sync-1' });

vi.mock('@/lib/atomicMutations', () => ({
  createInvoiceAtomic: (...args: any[]) => mockCreateInvoiceAtomic(...args),
  updateInvoiceAtomic: vi.fn().mockResolvedValue({}),
  cancelInvoiceAtomic: vi.fn().mockResolvedValue({})
}));

vi.mock('@/lib/firebase', () => ({
  db: {} as any,
  getActiveAccountId: () => 'default',
  getAccountDoc: () => ({})
}));

describe('Background Sync Service (src/lib/backgroundSyncService.ts)', () => {
  const testInvoice: Invoice = {
    id: 'inv-sync-1',
    invoiceNumber: 'INV-2026-8888',
    customerId: 'cust-1',
    customerName: 'Sync Test Customer',
    issueDate: '2026-09-19',
    dueDate: '2026-10-03',
    currency: 'SAR',
    items: [],
    subtotal: 100,
    totalDiscount: 0,
    totalTax: 15,
    grandTotal: 115,
    amountPaid: 0,
    amountDue: 115,
    status: 'UNPAID',
    createdAt: '2026-09-19T10:00:00.000Z',
    updatedAt: '2026-09-19T10:00:00.000Z'
  };

  beforeEach(() => {
    clearLocalInvoiceStorageForTesting();
    mockCreateInvoiceAtomic.mockClear();
  });

  it('processes pending local invoices and synchronizes them via createInvoiceAtomic', async () => {
    saveLocalPendingInvoice({
      invoiceId: testInvoice.id,
      invoice: testInvoice,
      action: 'CREATE'
    });

    expect(getLocalPendingInvoices()).toHaveLength(1);

    const { syncedCount, errorCount } = await syncPendingInvoices({} as any);

    expect(syncedCount).toBe(1);
    expect(errorCount).toBe(0);
    expect(mockCreateInvoiceAtomic).toHaveBeenCalledTimes(1);

    // Queue is cleared after successful sync
    expect(getLocalPendingInvoices()).toHaveLength(0);
  });

  it('preserves pending item and increments retry count if cloud sync throws error', async () => {
    mockCreateInvoiceAtomic.mockRejectedValueOnce(new Error('Firebase network unreachable'));

    saveLocalPendingInvoice({
      invoiceId: testInvoice.id,
      invoice: testInvoice,
      action: 'CREATE'
    });

    const { syncedCount, errorCount } = await syncPendingInvoices({} as any);

    expect(syncedCount).toBe(0);
    expect(errorCount).toBe(1);

    // Item remains in queue with error status for future retry
    const pending = getLocalPendingInvoices();
    expect(pending).toHaveLength(1);
    expect(pending[0].status).toBe('error');
    expect(pending[0].error).toBe('Firebase network unreachable');
    expect(pending[0].retryCount).toBe(1);
  });
});
