import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePayments } from '@/hooks/usePayments';
import type { Payment } from '@/types/domain';

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
    collection: vi.fn((_fs: any, ...path: string[]) => ({ id: path[path.length - 1] || 'col' })),
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

describe('usePayments Hook (src/hooks/usePayments.ts)', () => {
  const samplePayments: Payment[] = [
    {
      id: 'pay-1',
      paymentNumber: 'PAY-2026-0001',
      invoiceId: 'inv-101',
      invoiceNumber: 'INV-2026-0101',
      customerId: 'cust-1',
      customerName: 'Acme Corp',
      amount: 500,
      paymentDate: '2026-09-02',
      paymentMethod: 'BANK_TRANSFER',
      referenceNumber: 'TXN-001',
      createdAt: '2026-09-02T10:00:00Z'
    },
    {
      id: 'pay-2',
      paymentNumber: 'PAY-2026-0002',
      invoiceId: 'inv-102',
      invoiceNumber: 'INV-2026-0102',
      customerId: 'cust-2',
      customerName: 'Beta LLC',
      amount: 1200.5,
      paymentDate: '2026-09-10',
      paymentMethod: 'CASH',
      createdAt: '2026-09-10T14:00:00Z'
    },
    {
      id: 'pay-3',
      paymentNumber: 'PAY-2026-0003',
      invoiceId: 'inv-101',
      invoiceNumber: 'INV-2026-0101',
      customerId: 'cust-1',
      customerName: 'Acme Corp',
      amount: 250,
      paymentDate: '2026-09-15',
      paymentMethod: 'CREDIT_CARD',
      referenceNumber: 'AUTH-999',
      createdAt: '2026-09-15T09:00:00Z'
    }
  ];

  const emitSnapshot = (payments: Payment[]) => {
    if (!mockSnapshotCallback) return;
    const docs = payments.map((p) => ({
      id: p.id,
      data: () => p
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

  it('subscribes to payments collection and parses live documents', () => {
    const { result } = renderHook(() => usePayments());

    expect(result.current.loading).toBe(true);
    act(() => {
      emitSnapshot(samplePayments);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.rawPayments).toHaveLength(3);
    expect(result.current.payments).toHaveLength(3);
  });

  it('filters payments by search query', () => {
    const { result } = renderHook(() => usePayments());
    act(() => {
      emitSnapshot(samplePayments);
    });

    // Search by reference
    act(() => {
      result.current.setSearchQuery('AUTH-999');
    });
    expect(result.current.payments).toHaveLength(1);
    expect(result.current.payments[0].paymentNumber).toBe('PAY-2026-0003');

    // Search by invoice #
    act(() => {
      result.current.setSearchQuery('0101');
    });
    expect(result.current.payments).toHaveLength(2);
  });

  it('filters payments by payment method', () => {
    const { result } = renderHook(() => usePayments());
    act(() => {
      emitSnapshot(samplePayments);
    });

    act(() => {
      result.current.setMethodFilter('BANK_TRANSFER');
    });
    expect(result.current.payments).toHaveLength(1);
    expect(result.current.payments[0].paymentMethod).toBe('BANK_TRANSFER');

    act(() => {
      result.current.setMethodFilter('CASH');
    });
    expect(result.current.payments).toHaveLength(1);
    expect(result.current.payments[0].paymentMethod).toBe('CASH');
  });

  it('computes accurate payment aggregate metrics', () => {
    const { result } = renderHook(() => usePayments());
    act(() => {
      emitSnapshot(samplePayments);
    });

    const { metrics } = result.current;
    // Total collected: 500 + 1200.5 + 250 = 1950.5
    expect(metrics.totalCollected).toBe(1950.5);
    expect(metrics.paymentCount).toBe(3);
    expect(metrics.methodCounts.BANK_TRANSFER).toBe(1);
    expect(metrics.methodCounts.CASH).toBe(1);
    expect(metrics.methodCounts.CREDIT_CARD).toBe(1);
    expect(metrics.methodCounts.CHECK).toBe(0);
  });

  it('getPaymentsForInvoice and getPaymentsForCustomer return linked records', () => {
    const { result } = renderHook(() => usePayments());
    act(() => {
      emitSnapshot(samplePayments);
    });

    const forInvoice = result.current.getPaymentsForInvoice('inv-101');
    expect(forInvoice).toHaveLength(2);

    const forCustomer = result.current.getPaymentsForCustomer('cust-2');
    expect(forCustomer).toHaveLength(1);
    expect(forCustomer[0].customerName).toBe('Beta LLC');
  });

  it('getNextPaymentNumber generates next sequential payment number', () => {
    const { result } = renderHook(() => usePayments());
    act(() => {
      emitSnapshot(samplePayments);
    });

    const nextNum = result.current.getNextPaymentNumber();
    const currentYear = new Date().getFullYear();
    expect(nextNum).toBe(`PAY-${currentYear}-0004`);
  });
});
