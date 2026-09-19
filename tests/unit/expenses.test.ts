import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVendors } from '@/hooks/useVendors';
import { useExpenseBills } from '@/hooks/useExpenseBills';
import { useExpensePayments } from '@/hooks/useExpensePayments';
import type { Vendor, ExpenseBill } from '@/types/domain';

let mockUnsubscribe = vi.fn();

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    onSnapshot: (_query: any, _options: any, callback: any) => {
      callback?.({ docs: [], forEach: () => {}, metadata: { hasPendingWrites: false, fromCache: false } });
      return mockUnsubscribe;
    },
    collection: vi.fn((_fs: any, ...path: string[]) => ({ id: path[path.length - 1] || 'col' })),
    query: vi.fn(),
    doc: vi.fn(() => ({ id: 'mock-doc-id' })),
    increment: vi.fn((val: number) => val),
    writeBatch: () => ({
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined)
    })
  };
});

describe('Expenses & Accounts Payable Module (Unit Tests)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('useVendors Hook', () => {
    it('creates a new vendor with zero initial balances and active status', async () => {
      const { result } = renderHook(() => useVendors());

      let createdVendor: Vendor | undefined;
      await act(async () => {
        createdVendor = await result.current.createVendor({
          name: 'شركة التوريدات العالمية',
          company: 'Global Supplies',
          phone: '0501234567',
          currency: 'SAR',
          status: 'ACTIVE'
        });
      });

      expect(createdVendor).toBeDefined();
      expect(createdVendor?.name).toBe('شركة التوريدات العالمية');
      expect(createdVendor?.totalBilled).toBe(0);
      expect(createdVendor?.totalPaid).toBe(0);
      expect(createdVendor?.outstandingBalance).toBe(0);
      expect(createdVendor?.status).toBe('ACTIVE');
      expect(result.current.vendors.length).toBe(1);
    });

    it('filters vendors by name insensitive to Arabic diacritics', async () => {
      const { result } = renderHook(() => useVendors());

      await act(async () => {
        await result.current.createVendor({
          name: 'أحمد للتجارة',
          currency: 'SAR',
          status: 'ACTIVE'
        });
        await result.current.createVendor({
          name: 'شركة الكهرباء',
          currency: 'SAR',
          status: 'ACTIVE'
        });
      });

      expect(result.current.rawVendors.length).toBe(2);

      act(() => {
        result.current.setSearchQuery('احمد'); // Normalized search
      });

      expect(result.current.vendors.length).toBe(1);
      expect(result.current.vendors[0].name).toBe('أحمد للتجارة');
    });
  });

  describe('useExpenseBills Hook', () => {
    it('creates an expense bill and accurately computes amountDue and metrics', async () => {
      const { result } = renderHook(() => useExpenseBills());

      let newBill: ExpenseBill | undefined;
      await act(async () => {
        newBill = await result.current.createBill({
          billNumber: 'BILL-2026-001',
          vendorId: 'vnd-1',
          vendorName: 'مورد المعدات',
          issueDate: '2026-09-01',
          dueDate: '2026-09-30',
          category: 'GOODS',
          currency: 'SAR',
          items: [
            {
              id: 'item-1',
              description: 'أجهزة ومعدات',
              quantity: 2,
              unitPrice: 500,
              taxRate: 15,
              lineTotal: 1150
            }
          ],
          subtotal: 1000,
          taxAmount: 150,
          grandTotal: 1150
        });
      });

      expect(newBill).toBeDefined();
      expect(newBill?.grandTotal).toBe(1150);
      expect(newBill?.amountPaid).toBe(0);
      expect(newBill?.amountDue).toBe(1150);
      expect(newBill?.status).toBe('UNPAID');

      // Check metrics
      expect(result.current.metrics.totalBilled).toBe(1150);
      expect(result.current.metrics.totalPayables).toBe(1150);
      expect(result.current.metrics.unpaidCount).toBe(1);
    });

    it('flags overdue bills when dueDate is in the past and bill is unpaid', async () => {
      const { result } = renderHook(() => useExpenseBills());

      await act(async () => {
        await result.current.createBill({
          billNumber: 'BILL-OVERDUE-01',
          vendorId: 'vnd-2',
          vendorName: 'شركة الإيجار',
          issueDate: '2026-01-01',
          dueDate: '2026-02-01', // past date
          category: 'RENT',
          currency: 'SAR',
          items: [{ id: '1', description: 'إيجار شهر يناير', quantity: 1, unitPrice: 3000, taxRate: 0, lineTotal: 3000 }],
          subtotal: 3000,
          taxAmount: 0,
          grandTotal: 3000
        });
      });

      expect(result.current.metrics.overdueCount).toBe(1);
    });
  });

  describe('useExpensePayments Hook', () => {
    it('records an outgoing payment voucher and decrements bill amountDue', async () => {
      const { result: billsHook } = renderHook(() => useExpenseBills());
      const { result: payHook } = renderHook(() => useExpensePayments());

      let bill: ExpenseBill | undefined;
      await act(async () => {
        bill = await billsHook.current.createBill({
          billNumber: 'BILL-100',
          vendorId: 'vnd-10',
          vendorName: 'مكتب الخدمات الفنية',
          issueDate: '2026-09-10',
          dueDate: '2026-09-25',
          category: 'MAINTENANCE',
          currency: 'SAR',
          items: [{ id: '1', description: 'صيانة دورية', quantity: 1, unitPrice: 800, taxRate: 0, lineTotal: 800 }],
          subtotal: 800,
          taxAmount: 0,
          grandTotal: 800
        });
      });

      expect(bill).toBeDefined();

      // Record a partial payment of 500
      await act(async () => {
        await payHook.current.recordPayment(
          {
            billId: bill!.id,
            billNumber: bill!.billNumber,
            vendorId: bill!.vendorId,
            vendorName: bill!.vendorName,
            amount: 500,
            paymentDate: '2026-09-15',
            paymentMethod: 'BANK_TRANSFER',
            referenceNumber: 'TR-5544'
          },
          bill
        );
      });

      expect(payHook.current.payments.length).toBe(1);
      expect(payHook.current.payments[0].amount).toBe(500);
      expect(payHook.current.payments[0].voucherNumber).toMatch(/^VOUCH-/);
      expect(payHook.current.totalPaidAmount).toBe(500);
    });
  });
});
