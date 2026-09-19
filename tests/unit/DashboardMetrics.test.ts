import { describe, it, expect } from 'vitest';
import { roundFinancial } from '@/lib/calculations';
import { formatRelativeTime } from '@/components/modules/dashboard/ActivityFeed';
import type { Invoice } from '@/types/domain';

describe('Real-Time Financial Dashboard Metrics & Activity Feeds', () => {
  describe('1. Financial Metrics Invariant Calculations', () => {
    // Pure calculation logic equivalent to useDashboardMetrics useMemo
    function calculateMetrics(invoices: Invoice[], referenceDate: string = '2026-09-19') {
      const today = referenceDate;
      let totalRevenue = 0;
      let outstandingReceivables = 0;
      let totalInvoiced = 0;
      let paidInvoicesCount = 0;
      let overdueInvoicesCount = 0;
      let unpaidInvoicesCount = 0;
      let draftInvoicesCount = 0;
      let activeInvoicesCount = 0;

      for (const inv of invoices) {
        const isCancelled = inv.status === 'CANCELLED';
        const isDraft = inv.status === 'DRAFT';
        const grandTotal = Number(inv.grandTotal) || 0;
        const amountPaid = Number(inv.amountPaid) || 0;
        const amountDue = Number(inv.amountDue) || 0;

        if (isDraft) {
          draftInvoicesCount++;
          continue;
        }

        if (isCancelled) {
          continue;
        }

        activeInvoicesCount++;
        totalInvoiced += grandTotal;
        totalRevenue += amountPaid;

        if (amountDue > 0) {
          outstandingReceivables += amountDue;
          unpaidInvoicesCount++;
        }

        if (inv.status === 'PAID' || (amountDue <= 0.0001 && grandTotal > 0)) {
          paidInvoicesCount++;
        }

        const isOverdue =
          inv.status === 'OVERDUE' ||
          (Boolean(inv.dueDate) && inv.dueDate < today && amountDue > 0 && inv.status !== 'PAID');

        if (isOverdue) {
          overdueInvoicesCount++;
        }
      }

      const roundedRevenue = roundFinancial(totalRevenue);
      const roundedReceivables = roundFinancial(outstandingReceivables);
      const roundedInvoiced = roundFinancial(totalInvoiced);
      const collectionRate = roundedInvoiced > 0
        ? roundFinancial((roundedRevenue / roundedInvoiced) * 100, 1)
        : 0;

      return {
        totalRevenue: roundedRevenue,
        outstandingReceivables: roundedReceivables,
        totalInvoiced: roundedInvoiced,
        paidInvoicesCount,
        overdueInvoicesCount,
        unpaidInvoicesCount,
        draftInvoicesCount,
        totalInvoicesCount: activeInvoicesCount,
        collectionRate
      };
    }

    const testInvoices: Invoice[] = [
      {
        id: 'inv-1',
        invoiceNumber: 'INV-001',
        customerId: 'cust-1',
        customerName: 'Customer 1',
        issueDate: '2026-09-01',
        dueDate: '2026-09-30',
        currency: 'SAR',
        items: [],
        subtotal: 5000,
        totalDiscount: 0,
        totalTax: 0,
        grandTotal: 5000,
        amountPaid: 5000,
        amountDue: 0,
        status: 'PAID',
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z'
      },
      {
        id: 'inv-2',
        invoiceNumber: 'INV-002',
        customerId: 'cust-2',
        customerName: 'Customer 2',
        issueDate: '2026-09-05',
        dueDate: '2026-10-05',
        currency: 'SAR',
        items: [],
        subtotal: 3000,
        totalDiscount: 0,
        totalTax: 0,
        grandTotal: 3000,
        amountPaid: 1000,
        amountDue: 2000,
        status: 'PARTIALLY_PAID',
        createdAt: '2026-09-05T00:00:00Z',
        updatedAt: '2026-09-05T00:00:00Z'
      },
      {
        id: 'inv-3',
        invoiceNumber: 'INV-003',
        customerId: 'cust-3',
        customerName: 'Customer 3',
        issueDate: '2026-08-10',
        dueDate: '2026-09-01', // Overdue relative to 2026-09-19
        currency: 'SAR',
        items: [],
        subtotal: 2500,
        totalDiscount: 0,
        totalTax: 0,
        grandTotal: 2500,
        amountPaid: 0,
        amountDue: 2500,
        status: 'UNPAID', // Notice status in DB is UNPAID, but dueDate is past
        createdAt: '2026-08-10T00:00:00Z',
        updatedAt: '2026-08-10T00:00:00Z'
      },
      {
        id: 'inv-4',
        invoiceNumber: 'INV-004',
        customerId: 'cust-4',
        customerName: 'Customer 4',
        issueDate: '2026-09-12',
        dueDate: '2026-09-20',
        currency: 'SAR',
        items: [],
        subtotal: 9999,
        totalDiscount: 0,
        totalTax: 0,
        grandTotal: 9999,
        amountPaid: 0,
        amountDue: 9999,
        status: 'CANCELLED', // Cancelled invoice
        createdAt: '2026-09-12T00:00:00Z',
        updatedAt: '2026-09-12T00:00:00Z'
      },
      {
        id: 'inv-5',
        invoiceNumber: 'INV-005',
        customerId: 'cust-5',
        customerName: 'Customer 5',
        issueDate: '2026-09-15',
        dueDate: '2026-10-15',
        currency: 'SAR',
        items: [],
        subtotal: 1200,
        totalDiscount: 0,
        totalTax: 0,
        grandTotal: 1200,
        amountPaid: 0,
        amountDue: 1200,
        status: 'DRAFT', // Draft invoice
        createdAt: '2026-09-15T00:00:00Z',
        updatedAt: '2026-09-15T00:00:00Z'
      }
    ];

    it('calculates total revenue as sum(amountPaid) for non-cancelled invoices', () => {
      const res = calculateMetrics(testInvoices);
      // inv-1 (5000) + inv-2 (1000) = 6000
      expect(res.totalRevenue).toBe(6000);
    });

    it('calculates outstanding receivables as sum(amountDue) for non-cancelled/non-draft invoices', () => {
      const res = calculateMetrics(testInvoices);
      // inv-2 (2000) + inv-3 (2500) = 4500
      expect(res.outstandingReceivables).toBe(4500);
    });

    it('maintains accounting invariant: totalInvoiced === totalRevenue + outstandingReceivables', () => {
      const res = calculateMetrics(testInvoices);
      expect(res.totalInvoiced).toBe(res.totalRevenue + res.outstandingReceivables);
      expect(res.totalInvoiced).toBe(10500);
    });

    it('dynamically identifies overdue invoices even when status stored in DB is UNPAID', () => {
      const res = calculateMetrics(testInvoices, '2026-09-19');
      // inv-3 dueDate is 2026-09-01 < 2026-09-19 with amountDue 2500
      expect(res.overdueInvoicesCount).toBe(1);
    });

    it('excludes CANCELLED invoices from revenue, receivables, and active count', () => {
      const res = calculateMetrics(testInvoices);
      expect(res.totalInvoicesCount).toBe(3); // inv-1, inv-2, inv-3
      expect(res.draftInvoicesCount).toBe(1);
    });

    it('computes collectionRate percentage rounded to 1 decimal place', () => {
      const res = calculateMetrics(testInvoices);
      // 6000 / 10500 * 100 = 57.1428... -> 57.1%
      expect(res.collectionRate).toBe(57.1);
    });
  });

  describe('2. Activity Feed Bilingual Relative Time Formatting', () => {
    it('formats times less than a minute ago as "just now" / "الآن"', () => {
      const justNow = new Date(Date.now() - 20 * 1000).toISOString();
      expect(formatRelativeTime(justNow, 'en')).toBe('just now');
      expect(formatRelativeTime(justNow, 'ar')).toBe('الآن');
    });

    it('formats minutes ago correctly in English and Arabic', () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(formatRelativeTime(fiveMinAgo, 'en')).toBe('5m ago');
      expect(formatRelativeTime(fiveMinAgo, 'ar')).toBe('منذ 5 د');
    });

    it('formats hours ago correctly in English and Arabic', () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
      expect(formatRelativeTime(threeHoursAgo, 'en')).toBe('3h ago');
      expect(formatRelativeTime(threeHoursAgo, 'ar')).toBe('منذ 3 س');
    });

    it('formats yesterday correctly in English and Arabic', () => {
      const yesterday = new Date(Date.now() - 25 * 3600 * 1000).toISOString();
      expect(formatRelativeTime(yesterday, 'en')).toBe('yesterday');
      expect(formatRelativeTime(yesterday, 'ar')).toBe('أمس');
    });

    it('formats days ago correctly in English and Arabic', () => {
      const fourDaysAgo = new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString();
      expect(formatRelativeTime(fourDaysAgo, 'en')).toBe('4d ago');
      expect(formatRelativeTime(fourDaysAgo, 'ar')).toBe('منذ 4 أ');
    });
  });
});
