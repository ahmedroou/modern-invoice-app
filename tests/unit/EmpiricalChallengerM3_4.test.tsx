import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrendingUp, Users } from 'lucide-react';
import { MemoryRouter } from 'react-router-dom';

import { roundFinancial } from '@/lib/calculations';
import type { Invoice, Customer } from '@/types/domain';
import { CompactCard } from '@/components/common/CompactCard';
import { CompactMetricCard } from '@/components/common/CompactMetricCard';
import { MetricsGrid } from '@/components/modules/dashboard/MetricsGrid';
import { CustomerList } from '@/components/modules/customers/CustomerList';
import { CustomerProfileSummary } from '@/components/modules/customers/CustomerProfileSummary';
import { DirectionProvider } from '@/context/DirectionContext';
import { ThemeProvider } from '@/context/ThemeContext';
import type { DashboardMetrics } from '@/hooks/useDashboardMetrics';
import type { CustomerFinancialMetrics } from '@/hooks/useCustomerLedger';

// Pure mirror of useDashboardMetrics calculation engine for isolated stress testing
function calculateDashboardMetrics(
  invoices: Invoice[],
  referenceDate?: string,
  currency: string = 'SAR'
): DashboardMetrics {
  const today = referenceDate || new Date().toISOString().split('T')[0];

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

    // Outstanding Receivables
    if (amountDue > 0) {
      outstandingReceivables += amountDue;
      unpaidInvoicesCount++;
    }

    // Paid evaluation
    if (inv.status === 'PAID' || (amountDue <= 0.0001 && grandTotal > 0)) {
      paidInvoicesCount++;
    }

    // Dynamic Overdue evaluation
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

  const sortedInvoices = [...invoices].sort((a, b) => {
    const dateA = a.createdAt || a.issueDate || '';
    const dateB = b.createdAt || b.issueDate || '';
    return dateB.localeCompare(dateA);
  });

  return {
    totalRevenue: roundedRevenue,
    outstandingReceivables: roundedReceivables,
    paidInvoicesCount,
    overdueInvoicesCount,
    unpaidInvoicesCount,
    totalInvoicesCount: activeInvoicesCount,
    draftInvoicesCount,
    totalInvoiced: roundedInvoiced,
    collectionRate,
    primaryCurrency: currency,
    recentInvoices: sortedInvoices.slice(0, 5),
    isLoading: false,
    error: null
  };
}

// Router mocks
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => vi.fn()
  };
});

// useCustomers mock for CustomerList tests
let mockCustomerData: Customer[] = [];
vi.mock('@/hooks/useCustomers', () => ({
  useCustomers: () => ({
    customers: mockCustomerData,
    rawCustomers: mockCustomerData,
    loading: false,
    error: null,
    searchQuery: '',
    setSearchQuery: vi.fn(),
    statusFilter: 'ALL',
    setStatusFilter: vi.fn(),
    balanceFilter: 'ALL',
    setBalanceFilter: vi.fn(),
    sortBy: 'name',
    setSortBy: vi.fn(),
    sortOrder: 'asc',
    setSortOrder: vi.fn(),
    toggleSortOrder: vi.fn(),
    createCustomer: vi.fn(),
    updateCustomer: vi.fn(),
    archiveCustomer: vi.fn(),
    restoreCustomer: vi.fn(),
    deleteCustomer: vi.fn(),
    getCustomerById: vi.fn(),
    metrics: {
      totalCount: mockCustomerData.length,
      activeCount: mockCustomerData.filter(c => c.status === 'ACTIVE').length,
      archivedCount: mockCustomerData.filter(c => c.status === 'ARCHIVED').length,
      totalOutstanding: mockCustomerData.reduce((acc, c) => acc + (c.outstandingAmount || 0), 0),
      withDebtCount: mockCustomerData.filter(c => (c.outstandingAmount || 0) > 0).length
    }
  })
}));

describe('Empirical Challenger M3-4: Dashboard Metrics & Card Dimension Constraints', () => {

  describe('1. Stress-Testing useDashboardMetrics Calculation Engine', () => {

    it('1.1 handles completely empty collections without crashing or NaN', () => {
      const emptyMetrics = calculateDashboardMetrics([]);

      expect(emptyMetrics.totalRevenue).toBe(0);
      expect(emptyMetrics.outstandingReceivables).toBe(0);
      expect(emptyMetrics.totalInvoiced).toBe(0);
      expect(emptyMetrics.paidInvoicesCount).toBe(0);
      expect(emptyMetrics.overdueInvoicesCount).toBe(0);
      expect(emptyMetrics.unpaidInvoicesCount).toBe(0);
      expect(emptyMetrics.totalInvoicesCount).toBe(0);
      expect(emptyMetrics.draftInvoicesCount).toBe(0);
      expect(emptyMetrics.collectionRate).toBe(0);
      expect(Number.isNaN(emptyMetrics.collectionRate)).toBe(false);
      expect(Number.isFinite(emptyMetrics.collectionRate)).toBe(true);
      expect(emptyMetrics.recentInvoices).toEqual([]);
    });

    it('1.2 strictly ignores all-cancelled invoices across all financial and count totals', () => {
      const cancelledInvoices: Invoice[] = [
        {
          id: 'inv-c1',
          invoiceNumber: 'INV-C1',
          customerId: 'c-1',
          customerName: 'Cancelled Co 1',
          issueDate: '2026-08-01',
          dueDate: '2026-08-15',
          currency: 'SAR',
          items: [],
          subtotal: 10000,
          totalDiscount: 0,
          totalTax: 0,
          grandTotal: 10000,
          amountPaid: 3000,
          amountDue: 7000,
          status: 'CANCELLED',
          createdAt: '2026-08-01T10:00:00Z',
          updatedAt: '2026-08-01T10:00:00Z'
        },
        {
          id: 'inv-c2',
          invoiceNumber: 'INV-C2',
          customerId: 'c-2',
          customerName: 'Cancelled Co 2',
          issueDate: '2026-08-10',
          dueDate: '2026-08-20',
          currency: 'SAR',
          items: [],
          subtotal: 5000,
          totalDiscount: 0,
          totalTax: 0,
          grandTotal: 5000,
          amountPaid: 5000,
          amountDue: 0,
          status: 'CANCELLED',
          createdAt: '2026-08-10T10:00:00Z',
          updatedAt: '2026-08-10T10:00:00Z'
        }
      ];

      const res = calculateDashboardMetrics(cancelledInvoices, '2026-09-19');

      expect(res.totalInvoiced).toBe(0);
      expect(res.totalRevenue).toBe(0);
      expect(res.outstandingReceivables).toBe(0);
      expect(res.totalInvoicesCount).toBe(0);
      expect(res.paidInvoicesCount).toBe(0);
      expect(res.overdueInvoicesCount).toBe(0);
      expect(res.unpaidInvoicesCount).toBe(0);
      expect(res.draftInvoicesCount).toBe(0);
      expect(res.collectionRate).toBe(0);
    });

    it('1.3 accurately distinguishes invoices due today vs overdue against custom referenceDate', () => {
      const referenceDate = '2026-09-19';

      const boundaryInvoices: Invoice[] = [
        // Due today (2026-09-19) -> NOT overdue
        {
          id: 'inv-today',
          invoiceNumber: 'INV-TODAY',
          customerId: 'c-1',
          customerName: 'Due Today Inc',
          issueDate: '2026-09-01',
          dueDate: '2026-09-19',
          currency: 'SAR',
          items: [],
          subtotal: 1500,
          totalDiscount: 0,
          totalTax: 0,
          grandTotal: 1500,
          amountPaid: 0,
          amountDue: 1500,
          status: 'UNPAID',
          createdAt: '2026-09-01T10:00:00Z',
          updatedAt: '2026-09-01T10:00:00Z'
        },
        // Due yesterday (2026-09-18) -> OVERDUE
        {
          id: 'inv-yesterday',
          invoiceNumber: 'INV-YESTERDAY',
          customerId: 'c-2',
          customerName: 'Due Yesterday Inc',
          issueDate: '2026-09-01',
          dueDate: '2026-09-18',
          currency: 'SAR',
          items: [],
          subtotal: 2200,
          totalDiscount: 0,
          totalTax: 0,
          grandTotal: 2200,
          amountPaid: 200,
          amountDue: 2000,
          status: 'PARTIALLY_PAID',
          createdAt: '2026-09-01T10:00:00Z',
          updatedAt: '2026-09-01T10:00:00Z'
        },
        // Due tomorrow (2026-09-20) -> NOT overdue
        {
          id: 'inv-tomorrow',
          invoiceNumber: 'INV-TOMORROW',
          customerId: 'c-3',
          customerName: 'Due Tomorrow Inc',
          issueDate: '2026-09-05',
          dueDate: '2026-09-20',
          currency: 'SAR',
          items: [],
          subtotal: 3000,
          totalDiscount: 0,
          totalTax: 0,
          grandTotal: 3000,
          amountPaid: 0,
          amountDue: 3000,
          status: 'UNPAID',
          createdAt: '2026-09-05T10:00:00Z',
          updatedAt: '2026-09-05T10:00:00Z'
        },
        // Due past, but fully paid (amountDue = 0, status = 'PAID') -> NOT overdue
        {
          id: 'inv-past-paid',
          invoiceNumber: 'INV-PAST-PAID',
          customerId: 'c-4',
          customerName: 'Past Paid Inc',
          issueDate: '2026-08-01',
          dueDate: '2026-08-30',
          currency: 'SAR',
          items: [],
          subtotal: 4000,
          totalDiscount: 0,
          totalTax: 0,
          grandTotal: 4000,
          amountPaid: 4000,
          amountDue: 0,
          status: 'PAID',
          createdAt: '2026-08-01T10:00:00Z',
          updatedAt: '2026-08-01T10:00:00Z'
        },
        // Due past, but amountDue = 0 with status UNPAID (cleared balance) -> NOT overdue
        {
          id: 'inv-cleared',
          invoiceNumber: 'INV-CLEARED',
          customerId: 'c-5',
          customerName: 'Cleared Balance Inc',
          issueDate: '2026-08-10',
          dueDate: '2026-09-10',
          currency: 'SAR',
          items: [],
          subtotal: 1000,
          totalDiscount: 0,
          totalTax: 0,
          grandTotal: 1000,
          amountPaid: 1000,
          amountDue: 0,
          status: 'UNPAID',
          createdAt: '2026-08-10T10:00:00Z',
          updatedAt: '2026-08-10T10:00:00Z'
        },
        // Explicit status OVERDUE, even if dueDate is future -> IS overdue
        {
          id: 'inv-explicit-overdue',
          invoiceNumber: 'INV-EXPLICIT-OD',
          customerId: 'c-6',
          customerName: 'Forced Overdue Inc',
          issueDate: '2026-09-10',
          dueDate: '2026-10-10',
          currency: 'SAR',
          items: [],
          subtotal: 500,
          totalDiscount: 0,
          totalTax: 0,
          grandTotal: 500,
          amountPaid: 0,
          amountDue: 500,
          status: 'OVERDUE',
          createdAt: '2026-09-10T10:00:00Z',
          updatedAt: '2026-09-10T10:00:00Z'
        },
        // Missing dueDate with status UNPAID -> NOT overdue (graceful handling)
        {
          id: 'inv-no-date',
          invoiceNumber: 'INV-NO-DATE',
          customerId: 'c-7',
          customerName: 'No Date Inc',
          issueDate: '2026-09-01',
          dueDate: '',
          currency: 'SAR',
          items: [],
          subtotal: 800,
          totalDiscount: 0,
          totalTax: 0,
          grandTotal: 800,
          amountPaid: 0,
          amountDue: 800,
          status: 'UNPAID',
          createdAt: '2026-09-01T10:00:00Z',
          updatedAt: '2026-09-01T10:00:00Z'
        }
      ];

      const res = calculateDashboardMetrics(boundaryInvoices, referenceDate);

      // Exactly 2 overdue: inv-yesterday (past due date with amountDue) and inv-explicit-overdue
      expect(res.overdueInvoicesCount).toBe(2);

      // inv-today must NOT be overdue
      // inv-tomorrow must NOT be overdue
      // inv-past-paid must NOT be overdue
      // inv-cleared must NOT be overdue
      // inv-no-date must NOT be overdue

      // Paid count: inv-past-paid (status PAID) + inv-cleared (amountDue <= 0.0001 && grandTotal > 0)
      expect(res.paidInvoicesCount).toBe(2);
    });

    it('1.4 verifies precision rounding avoids IEEE-754 mantissa drift across 500 fractional invoices', () => {
      const fractionalInvoices: Invoice[] = [];

      for (let i = 0; i < 500; i++) {
        // e.g. 19.99 * 3 = 59.97
        const grandTotal = 59.97;
        const amountPaid = 29.99;
        const amountDue = 29.98; // 29.99 + 29.98 = 59.97

        fractionalInvoices.push({
          id: `inv-f-${i}`,
          invoiceNumber: `INV-F-${i}`,
          customerId: `c-${i % 10}`,
          customerName: `Customer ${i % 10}`,
          issueDate: '2026-09-01',
          dueDate: '2026-09-30',
          currency: 'SAR',
          items: [],
          subtotal: grandTotal,
          totalDiscount: 0,
          totalTax: 0,
          grandTotal,
          amountPaid,
          amountDue,
          status: 'PARTIALLY_PAID',
          createdAt: '2026-09-01T10:00:00Z',
          updatedAt: '2026-09-01T10:00:00Z'
        });
      }

      const res = calculateDashboardMetrics(fractionalInvoices, '2026-09-19');

      // 500 * 59.97 = 29985.00
      expect(res.totalInvoiced).toBe(29985.00);
      // 500 * 29.99 = 14995.00
      expect(res.totalRevenue).toBe(14995.00);
      // 500 * 29.98 = 14990.00
      expect(res.outstandingReceivables).toBe(14990.00);

      // Invariant check: totalInvoiced === totalRevenue + outstandingReceivables
      expect(res.totalInvoiced).toBe(roundFinancial(res.totalRevenue + res.outstandingReceivables));

      // Collection rate: (14995 / 29985) * 100 = 50.0083... -> rounded to 1 decimal: 50.0%
      expect(res.collectionRate).toBe(50.0);
    });

    it('1.5 verifies collectionRate precision rounding and edge scenarios', () => {
      // Scenario A: 1 cent collected out of 3 cents -> 33.3%
      const inv3: Invoice[] = [
        {
          id: 'inv-3c',
          invoiceNumber: 'INV-3C',
          customerId: 'c-1',
          customerName: 'C1',
          issueDate: '2026-09-01',
          dueDate: '2026-09-30',
          currency: 'SAR',
          items: [],
          subtotal: 0.03,
          totalDiscount: 0,
          totalTax: 0,
          grandTotal: 0.03,
          amountPaid: 0.01,
          amountDue: 0.02,
          status: 'PARTIALLY_PAID',
          createdAt: '2026-09-01T10:00:00Z',
          updatedAt: '2026-09-01T10:00:00Z'
        }
      ];
      const res3 = calculateDashboardMetrics(inv3);
      expect(res3.collectionRate).toBe(33.3);

      // Scenario B: 2 cents collected out of 3 cents -> 66.7%
      inv3[0].amountPaid = 0.02;
      inv3[0].amountDue = 0.01;
      const res3b = calculateDashboardMetrics(inv3);
      expect(res3b.collectionRate).toBe(66.7);
    });
  });

  describe('2. Programmatic Inspection of Card Dimensions & Responsive Layouts', () => {

    it('2.1 MetricsGrid renders 4 cards strictly with Tailwind h-[82px] (< 90px height)', () => {
      const sampleMetrics: DashboardMetrics = {
        totalRevenue: 125000.50,
        outstandingReceivables: 35000.25,
        paidInvoicesCount: 28,
        overdueInvoicesCount: 3,
        unpaidInvoicesCount: 7,
        totalInvoicesCount: 35,
        draftInvoicesCount: 2,
        totalInvoiced: 160000.75,
        collectionRate: 78.1,
        primaryCurrency: 'SAR',
        recentInvoices: [],
        isLoading: false,
        error: null
      };

      const { container } = render(
        <ThemeProvider>
          <DirectionProvider>
            <MetricsGrid metrics={sampleMetrics} />
          </DirectionProvider>
        </ThemeProvider>
      );

      const gridEl = screen.getByTestId('metrics-grid');
      expect(gridEl).toBeInTheDocument();
      // Verify responsive grid columns: 2 cols on mobile, 4 on desktop
      expect(gridEl.className).toContain('grid-cols-2');
      expect(gridEl.className).toContain('lg:grid-cols-4');

      // Query all cards inside grid
      const cards = gridEl.querySelectorAll('.h-\\[82px\\]');
      expect(cards.length).toBe(4);

      // Check height constraint on each card: 82px < 90px
      cards.forEach((card) => {
        expect(card.className).toContain('h-[82px]');
        // Verify min-w-0 for flex containment
        expect(card.className).toContain('min-w-0');
      });

      // Assert no card in container has height >= 90px
      const allDivs = container.querySelectorAll('div');
      allDivs.forEach((div) => {
        const heightMatch = div.className.match(/h-\[(\d+)px\]/);
        if (heightMatch) {
          const pxHeight = parseInt(heightMatch[1], 10);
          expect(pxHeight).toBeLessThan(90);
        }
      });
    });

    it('2.2 CustomerList cards view renders compact cards strictly with h-[82px] (< 90px)', () => {
      mockCustomerData = [
        {
          id: 'cust-101',
          name: 'Al-Madinah Trading Establishment with an Exceptionally Long Corporate Name That Must Truncate Gracefully',
          email: 'verylongemailaddressforbusinesscontact@almadinahtrading.sa',
          phone: '+966 50 111 2222',
          currency: 'SAR',
          outstandingAmount: 5400,
          totalInvoiced: 15000,
          totalPaid: 9600,
          status: 'ACTIVE',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z'
        },
        {
          id: 'cust-102',
          name: 'Sultan Logistics',
          email: 'info@sultan.sa',
          phone: '+966 55 999 8888',
          currency: 'SAR',
          outstandingAmount: 0,
          totalInvoiced: 8000,
          totalPaid: 8000,
          status: 'ACTIVE',
          createdAt: '2026-02-01T00:00:00Z',
          updatedAt: '2026-02-01T00:00:00Z'
        }
      ];

      const { container } = render(
        <ThemeProvider>
          <DirectionProvider>
            <MemoryRouter>
              <CustomerList />
            </MemoryRouter>
          </DirectionProvider>
        </ThemeProvider>
      );

      // Verify directory KPI cards grid has 4 cards with h-[82px]
      const metricsGrid = screen.getByTestId('customer-metrics-grid');
      const kpiCards = metricsGrid.querySelectorAll('.h-\\[82px\\]');
      expect(kpiCards.length).toBe(4);

      // Verify customer directory card view: each customer card has h-[82px]
      const customerGrid = screen.getByTestId('customer-cards-grid');
      expect(customerGrid).toBeInTheDocument();

      const customerCards = customerGrid.querySelectorAll('.h-\\[82px\\]');
      expect(customerCards.length).toBe(2);

      // Verify truncation on long names to prevent vertical card blowout
      customerCards.forEach((card) => {
        expect(card.className).toContain('h-[82px]');
        expect(card.className).toContain('min-w-0');
        const textTruncated = card.querySelectorAll('.truncate');
        expect(textTruncated.length).toBeGreaterThanOrEqual(2);
      });

      // Verify no height classes in container exceed 90px
      const allDivs = container.querySelectorAll('div');
      allDivs.forEach((div) => {
        const heightMatch = div.className.match(/h-\[(\d+)px\]/);
        if (heightMatch) {
          const pxHeight = parseInt(heightMatch[1], 10);
          expect(pxHeight).toBeLessThan(90);
        }
      });
    });

    it('2.3 CustomerProfileSummary renders 3 compact KPI cards strictly with h-[82px] (< 90px)', () => {
      const mockCustomer: Customer = {
        id: 'cust-201',
        name: 'Riyadh Retailers',
        phone: '+966 54 321 0000',
        currency: 'SAR',
        outstandingAmount: 4200,
        totalInvoiced: 24000,
        totalPaid: 19800,
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      };

      const mockMetrics: CustomerFinancialMetrics = {
        totalInvoiced: 24000,
        totalPaid: 19800,
        outstandingBalance: 4200,
        invoiceCount: 6,
        paymentCount: 4,
        overdueCount: 1,
        overdueAmount: 4200,
        financialStatus: 'OVERDUE'
      };

      const { container } = render(
        <ThemeProvider>
          <DirectionProvider>
            <CustomerProfileSummary
              customer={mockCustomer}
              metrics={mockMetrics}
            />
          </DirectionProvider>
        </ThemeProvider>
      );

      // Verify 3 CompactMetricCards are rendered with h-[82px]
      const metricCards = container.querySelectorAll('.h-\\[82px\\]');
      expect(metricCards.length).toBe(3);

      metricCards.forEach((card) => {
        expect(card.className).toContain('h-[82px]');
        expect(card.className).toContain('min-w-0');
      });
    });

    it('2.4 CompactMetricCard component adheres strictly to h-[82px] (< 90px) and bidi isolation', () => {
      const { container } = render(
        <CompactMetricCard
          title="Revenue Metric"
          value="SAR 99,999.00"
          subtitle="All transactions"
          icon={TrendingUp}
          variant="brand"
        />
      );

      const card = container.firstElementChild as HTMLElement;
      expect(card).toBeInTheDocument();
      expect(card.className).toContain('h-[82px]');

      // Verify numeric height constraint: 82 < 90
      const match = card.className.match(/h-\[(\d+)px\]/);
      expect(match).not.toBeNull();
      if (match) {
        expect(parseInt(match[1], 10)).toBeLessThan(90);
      }

      // Verify BidiIsolate is present around value to prevent Arabic RTL scramble
      const bidiSpan = card.querySelector('span[dir="ltr"]');
      expect(bidiSpan).toBeInTheDocument();
      expect(bidiSpan?.textContent).toBe('SAR 99,999.00');
    });

    it('2.5 CompactCard component provides proper responsive boundary and overflow containment', () => {
      const { container } = render(
        <div style={{ width: '375px', maxWidth: '100%', overflowX: 'hidden' }}>
          <CompactCard className="test-card">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="truncate">Sample Content Inside Compact Mobile Card</span>
            </div>
          </CompactCard>
        </div>
      );

      const card = container.querySelector('.test-card') as HTMLElement;
      expect(card).toBeInTheDocument();
      expect(card.className).toContain('overflow-hidden');
      expect(card.className).toContain('min-w-0');
      expect(card.className).toContain('max-w-full');
    });
  });
});
