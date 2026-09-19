import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInvoices } from '@/hooks/useInvoices';
import type { Invoice } from '@/types/domain';

let mockSnapshotCallback: ((snapshot: any) => void) | null = null;
let mockUnsubscribe = vi.fn();

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    onSnapshot: (_query: any, _options: any, callback: any) => {
      mockSnapshotCallback = callback;
      return mockUnsubscribe;
    },
    collection: vi.fn(),
    query: vi.fn(),
    doc: vi.fn(() => ({ id: 'mock-doc-id' })),
    writeBatch: () => ({
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined)
    })
  };
});

describe('useInvoices Hook (src/hooks/useInvoices.ts)', () => {
  const sampleInvoices: Invoice[] = [
    {
      id: 'inv-1',
      invoiceNumber: 'INV-2026-0001',
      customerId: 'cust-1',
      customerName: 'Acme Corp',
      issueDate: '2026-09-01',
      dueDate: '2026-09-15',
      currency: 'USD',
      items: [],
      subtotal: 500,
      totalDiscount: 0,
      totalTax: 50,
      grandTotal: 550,
      amountPaid: 0,
      amountDue: 550,
      status: 'UNPAID',
      notes: 'Initial consulting work',
      createdAt: '2026-09-01T10:00:00Z',
      updatedAt: '2026-09-01T10:00:00Z'
    },
    {
      id: 'inv-2',
      invoiceNumber: 'INV-2026-0002',
      customerId: 'cust-2',
      customerName: 'Beta LLC',
      issueDate: '2026-09-05',
      dueDate: '2026-09-20',
      currency: 'SAR',
      items: [],
      subtotal: 1000,
      totalDiscount: 100,
      totalTax: 135,
      grandTotal: 1035,
      amountPaid: 1035,
      amountDue: 0,
      status: 'PAID',
      notes: 'Software license',
      createdAt: '2026-09-05T12:00:00Z',
      updatedAt: '2026-09-05T12:00:00Z'
    },
    {
      id: 'inv-3',
      invoiceNumber: 'INV-2026-0003',
      customerId: 'cust-1',
      customerName: 'Acme Corp',
      issueDate: '2026-08-01',
      dueDate: '2026-08-15',
      currency: 'USD',
      items: [],
      subtotal: 800,
      totalDiscount: 0,
      totalTax: 80,
      grandTotal: 880,
      amountPaid: 300,
      amountDue: 580,
      status: 'OVERDUE',
      notes: 'Hardware delivery',
      createdAt: '2026-08-01T09:00:00Z',
      updatedAt: '2026-08-01T09:00:00Z'
    }
  ];

  const emitSnapshot = (invoices: Invoice[]) => {
    if (!mockSnapshotCallback) return;
    const docs = invoices.map((inv) => ({
      id: inv.id,
      data: () => inv
    }));
    mockSnapshotCallback({
      forEach: (cb: any) => docs.forEach(cb),
      metadata: { hasPendingWrites: false, fromCache: false }
    });
  };

  beforeEach(() => {
    mockUnsubscribe.mockClear();
    mockSnapshotCallback = null;
  });

  it('subscribes to invoices collection and parses live documents', () => {
    const { result } = renderHook(() => useInvoices());

    expect(result.current.loading).toBe(true);
    act(() => {
      emitSnapshot(sampleInvoices);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.rawInvoices).toHaveLength(3);
    expect(result.current.invoices).toHaveLength(3);
  });

  it('filters invoices by search query matching invoice number or customer name', () => {
    const { result } = renderHook(() => useInvoices());
    act(() => {
      emitSnapshot(sampleInvoices);
    });

    // Search by invoice #
    act(() => {
      result.current.setSearchQuery('0002');
    });
    expect(result.current.invoices).toHaveLength(1);
    expect(result.current.invoices[0].invoiceNumber).toBe('INV-2026-0002');

    // Search by customer name
    act(() => {
      result.current.setSearchQuery('Acme');
    });
    expect(result.current.invoices).toHaveLength(2);
    expect(result.current.invoices.every((inv) => inv.customerName === 'Acme Corp')).toBe(true);
  });

  it('filters invoices by status correctly', () => {
    const { result } = renderHook(() => useInvoices());
    act(() => {
      emitSnapshot(sampleInvoices);
    });

    act(() => {
      result.current.setStatusFilter('PAID');
    });
    expect(result.current.invoices).toHaveLength(1);
    expect(result.current.invoices[0].status).toBe('PAID');

    act(() => {
      result.current.setStatusFilter('OVERDUE');
    });
    expect(result.current.invoices).toHaveLength(1);
    expect(result.current.invoices[0].status).toBe('OVERDUE');
  });

  it('filters invoices by customer ID', () => {
    const { result } = renderHook(() => useInvoices());
    act(() => {
      emitSnapshot(sampleInvoices);
    });

    act(() => {
      result.current.setCustomerFilter('cust-2');
    });
    expect(result.current.invoices).toHaveLength(1);
    expect(result.current.invoices[0].customerId).toBe('cust-2');
  });

  it('filters invoices by date range', () => {
    const { result } = renderHook(() => useInvoices());
    act(() => {
      emitSnapshot(sampleInvoices);
    });

    act(() => {
      result.current.setStartDate('2026-09-01');
      result.current.setEndDate('2026-09-30');
    });
    // Should return inv-1 (Sep 1) and inv-2 (Sep 5), excluding inv-3 (Aug 1)
    expect(result.current.invoices).toHaveLength(2);
  });

  it('computes accurate directory metrics from raw invoices', () => {
    const { result } = renderHook(() => useInvoices());
    act(() => {
      emitSnapshot(sampleInvoices);
    });

    const { metrics } = result.current;
    expect(metrics.totalCount).toBe(3);
    expect(metrics.unpaidCount).toBe(1);
    expect(metrics.paidCount).toBe(1);
    expect(metrics.overdueCount).toBe(1);
    // Total receivables: 550 (inv-1) + 580 (inv-3) = 1130
    expect(metrics.totalReceivables).toBe(1130);
    // Total revenue: 1035 (inv-2) + 300 (inv-3) = 1335
    expect(metrics.totalRevenue).toBe(1335);
  });

  it('getNextInvoiceNumber generates sequential invoice numbers', () => {
    const { result } = renderHook(() => useInvoices());
    act(() => {
      emitSnapshot(sampleInvoices);
    });

    const nextNum = result.current.getNextInvoiceNumber();
    const currentYear = new Date().getFullYear();
    expect(nextNum).toBe(`INV-${currentYear}-0004`);
  });

  it('createInvoice adds invoice immediately to local state and persists it locally', async () => {
    const { result } = renderHook(() => useInvoices());
    act(() => {
      emitSnapshot([]);
    });

    expect(result.current.invoices).toHaveLength(0);

    let createdInvoice: Invoice | undefined;
    await act(async () => {
      createdInvoice = await result.current.createInvoice({
        id: 'inv-instant-1',
        invoiceNumber: 'INV-2026-9001',
        customerId: 'cust-1',
        customerName: 'Acme Corp',
        issueDate: '2026-09-19',
        dueDate: '2026-10-03',
        currency: 'SAR',
        items: [],
        subtotal: 500,
        totalDiscount: 0,
        totalTax: 75,
        grandTotal: 575
      });
    });

    expect(createdInvoice).toBeDefined();
    expect(createdInvoice?.id).toBe('inv-instant-1');
    expect(createdInvoice?.syncStatus).toBe('pending');

    // Instantly visible in reactive hook state
    expect(result.current.invoices).toHaveLength(1);
    expect(result.current.invoices[0].id).toBe('inv-instant-1');
    expect(result.current.invoices[0].syncStatus).toBe('pending');
  });
});
