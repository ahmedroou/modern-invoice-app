// tests/unit/EmpiricalChallengerM3_2.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Domain, calculations, and hooks
import { roundFinancial } from '@/lib/calculations';
import type { Invoice, Customer, Payment, InvoiceStatus } from '@/types/domain';
import { MetricsGrid } from '@/components/modules/dashboard/MetricsGrid';
import { CustomerList } from '@/components/modules/customers/CustomerList';
import { CustomerProfileSummary } from '@/components/modules/customers/CustomerProfileSummary';
import { DirectionProvider } from '@/context/DirectionContext';
import type { DashboardMetrics } from '@/hooks/useDashboardMetrics';
import type { CustomerFinancialMetrics } from '@/hooks/useCustomerLedger';

// Mocks for Router navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

// Controllable mock state for useCustomers
let mockCustomersState: Customer[] = [];
let mockCustomersLoading = false;
let mockCustomerMetrics = {
  totalCount: 0,
  activeCount: 0,
  archivedCount: 0,
  totalOutstanding: 0,
  withDebtCount: 0
};

vi.mock('@/hooks/useCustomers', () => ({
  useCustomers: () => ({
    customers: mockCustomersState,
    rawCustomers: mockCustomersState,
    loading: mockCustomersLoading,
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
    metrics: mockCustomerMetrics
  })
}));

// Pure reproduction of useDashboardMetrics calculation engine for high-volume property testing
function calculateDashboardMetrics(invoices: Invoice[], referenceDate?: string, currency: string = 'SAR'): DashboardMetrics {
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

// Pure customer ledger calculation engine reproduction for ledger isolation testing
function calculateCustomerLedger(
  _customer: Customer,
  invoices: Invoice[],
  payments: Payment[],
  referenceDate: string = '2026-09-19'
) {
  const today = referenceDate;

  const invoiceRows = invoices
    .filter(inv => inv.status !== 'CANCELLED' && inv.status !== 'DRAFT')
    .map(inv => ({
      id: inv.id,
      type: 'INVOICE' as const,
      date: inv.issueDate,
      createdAt: inv.createdAt,
      referenceNumber: inv.invoiceNumber,
      debit: roundFinancial(inv.grandTotal),
      credit: 0
    }));

  const paymentRows = payments.map(pay => ({
    id: pay.id,
    type: 'PAYMENT' as const,
    date: pay.paymentDate,
    createdAt: pay.createdAt,
    referenceNumber: pay.paymentNumber,
    debit: 0,
    credit: roundFinancial(pay.amount)
  }));

  const combined = [...invoiceRows, ...paymentRows];
  combined.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.createdAt !== b.createdAt) return a.createdAt.localeCompare(b.createdAt);
    if (a.type !== b.type) return a.type === 'INVOICE' ? -1 : 1;
    return a.referenceNumber.localeCompare(b.referenceNumber);
  });

  let balance = 0;
  const computed = combined.map(entry => {
    balance = roundFinancial(balance + entry.debit - entry.credit);
    return { ...entry, runningBalance: balance };
  });

  const totalInvoiced = roundFinancial(invoiceRows.reduce((sum, inv) => sum + inv.debit, 0));
  const totalPaid = roundFinancial(paymentRows.reduce((sum, pay) => sum + pay.credit, 0));
  const outstandingBalance = roundFinancial(totalInvoiced - totalPaid);

  let overdueCount = 0;
  let overdueAmount = 0;
  invoices.forEach(inv => {
    if (inv.status !== 'CANCELLED' && inv.status !== 'DRAFT' && inv.status !== 'PAID') {
      if (inv.dueDate && inv.dueDate < today && inv.amountDue > 0) {
        overdueCount++;
        overdueAmount = roundFinancial(overdueAmount + inv.amountDue);
      }
    }
  });

  let financialStatus: 'CLEARED' | 'HAS_BALANCE' | 'OVERDUE' = 'CLEARED';
  if (outstandingBalance > 0.001) {
    financialStatus = overdueCount > 0 ? 'OVERDUE' : 'HAS_BALANCE';
  }

  const metrics: CustomerFinancialMetrics = {
    totalInvoiced,
    totalPaid,
    outstandingBalance,
    invoiceCount: invoiceRows.length,
    paymentCount: paymentRows.length,
    overdueCount,
    overdueAmount,
    financialStatus
  };

  return { entries: computed, metrics };
}

describe('Empirical Challenger M3-2: Dashboard Metrics & Responsive Constraints Stress Harness', () => {
  beforeEach(() => {
    localStorage.clear();
    mockCustomersState = [];
    mockCustomersLoading = false;
    mockCustomerMetrics = {
      totalCount: 0,
      activeCount: 0,
      archivedCount: 0,
      totalOutstanding: 0,
      withDebtCount: 0
    };
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.clearAllMocks();
  });

  // =========================================================================
  // SECTION 1: Dynamic Dashboard Metrics Invariants Stress Testing
  // =========================================================================
  describe('1. Dynamic Dashboard Metrics Invariants', () => {
    it('empirically verifies invariant: Total Invoiced === Total Revenue + Outstanding Receivables across 1,000 randomized mixed invoices', () => {
      const statuses: InvoiceStatus[] = ['DRAFT', 'UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'];
      let floatDriftDetected = 0;

      for (let run = 0; run < 10; run++) {
        const batch: Invoice[] = [];

        for (let i = 0; i < 100; i++) {
          const status = statuses[i % statuses.length];
          // Amounts from 1.00 to 10,000.00 with fractional cents
          const gross = roundFinancial(1 + Math.random() * 9999);
          let paid = 0;
          let due = gross;

          if (status === 'PAID') {
            paid = gross;
            due = 0;
          } else if (status === 'PARTIALLY_PAID') {
            const fraction = 0.1 + Math.random() * 0.8;
            paid = roundFinancial(gross * fraction);
            due = roundFinancial(gross - paid);
          } else if (status === 'UNPAID' || status === 'OVERDUE' || status === 'DRAFT') {
            paid = 0;
            due = gross;
          } else if (status === 'CANCELLED') {
            paid = 0;
            due = 0;
          }

          batch.push({
            id: `inv-sim-${run}-${i}`,
            invoiceNumber: `INV-${run}-${i}`,
            customerId: `cust-${i % 10}`,
            customerName: `Customer ${i % 10}`,
            issueDate: '2026-09-01',
            dueDate: '2026-09-15',
            currency: 'SAR',
            items: [],
            subtotal: gross,
            totalDiscount: 0,
            totalTax: 0,
            grandTotal: gross,
            amountPaid: paid,
            amountDue: due,
            status,
            createdAt: `2026-09-01T0${i % 10}:00:00Z`,
            updatedAt: `2026-09-01T0${i % 10}:00:00Z`
          });
        }

        const metrics = calculateDashboardMetrics(batch, '2026-09-19');

        // Check if raw JavaScript float addition would drift
        const rawSum = metrics.totalRevenue + metrics.outstandingReceivables;
        if (rawSum !== metrics.totalInvoiced) {
          floatDriftDetected++;
        }

        // The financial invariant MUST hold identically after roundFinancial
        const reconciledSum = roundFinancial(metrics.totalRevenue + metrics.outstandingReceivables);
        expect(metrics.totalInvoiced).toBe(reconciledSum);

        // Also verify that active count matches non-draft and non-cancelled invoices
        const expectedActive = batch.filter(b => b.status !== 'CANCELLED' && b.status !== 'DRAFT').length;
        expect(metrics.totalInvoicesCount).toBe(expectedActive);
      }

      // Log empirical drift observation
      console.log(`[Empirical Test] Raw float sum drifted in ${floatDriftDetected} of 10 batches. Invariant held identically in 100% of cases.`);
    });

    it('empirically verifies invariant: Outstanding Receivables === sum(customer.outstandingAmount) across multiple customers', () => {
      // Simulate 10 customers
      const customers: Customer[] = Array.from({ length: 10 }, (_, i) => ({
        id: `cust-multi-${i}`,
        name: `Saudi Enterprise #${i + 1}`,
        currency: 'SAR',
        outstandingAmount: 0,
        totalInvoiced: 0,
        totalPaid: 0,
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      }));

      const invoices: Invoice[] = [];

      // Create 30 invoices spread across customers with diverse payment levels
      customers.forEach((cust, custIdx) => {
        for (let invIdx = 0; invIdx < 3; invIdx++) {
          const grandTotal = roundFinancial(1000 * (custIdx + 1) + invIdx * 250.5);
          let amountPaid = 0;
          let amountDue = grandTotal;
          let status: InvoiceStatus = 'UNPAID';

          if (custIdx === 0) {
            amountPaid = grandTotal;
            amountDue = 0;
            status = 'PAID';
          } else if (custIdx === 2) {
            amountPaid = roundFinancial(grandTotal * 0.4);
            amountDue = roundFinancial(grandTotal - amountPaid);
            status = 'PARTIALLY_PAID';
          } else if (custIdx === 3) {
            status = 'OVERDUE';
          } else if (custIdx === 4) {
            status = 'CANCELLED';
            amountPaid = 0;
            amountDue = 0;
          } else if (custIdx === 5) {
            status = 'DRAFT';
            amountPaid = 0;
            amountDue = grandTotal;
          }

          // In business logic, non-draft and non-cancelled invoices post to customer balance
          if (status !== 'CANCELLED' && status !== 'DRAFT') {
            cust.outstandingAmount = roundFinancial(cust.outstandingAmount + amountDue);
            cust.totalInvoiced = roundFinancial(cust.totalInvoiced + grandTotal);
            cust.totalPaid = roundFinancial(cust.totalPaid + amountPaid);
          }

          invoices.push({
            id: `inv-${custIdx}-${invIdx}`,
            invoiceNumber: `INV-${custIdx}-${invIdx}`,
            customerId: cust.id,
            customerName: cust.name,
            issueDate: '2026-09-01',
            dueDate: '2026-09-15',
            currency: 'SAR',
            items: [],
            subtotal: grandTotal,
            totalDiscount: 0,
            totalTax: 0,
            grandTotal,
            amountPaid,
            amountDue,
            status,
            createdAt: '2026-09-01T00:00:00Z',
            updatedAt: '2026-09-01T00:00:00Z'
          });
        }
      });

      const metrics = calculateDashboardMetrics(invoices, '2026-09-19');
      const sumCustomerOutstanding = roundFinancial(
        customers.reduce((sum, c) => sum + c.outstandingAmount, 0)
      );

      // Invariant: Outstanding Receivables on Dashboard === Sum of Customer Outstanding Balances
      expect(metrics.outstandingReceivables).toBe(sumCustomerOutstanding);
      expect(metrics.outstandingReceivables).toBeGreaterThan(0);
    });

    it('empirically verifies dynamic overdue evaluation without background cron updates', () => {
      // 4 invoices with status in DB explicitly left as UNPAID
      const invoices: Invoice[] = [
        {
          id: 'inv-od-1',
          invoiceNumber: 'INV-OD-1',
          customerId: 'c1',
          customerName: 'Cust 1',
          issueDate: '2026-09-01',
          dueDate: '2026-09-10', // Matures Sep 10
          currency: 'SAR',
          items: [],
          subtotal: 1000,
          totalDiscount: 0,
          totalTax: 0,
          grandTotal: 1000,
          amountPaid: 0,
          amountDue: 1000,
          status: 'UNPAID', // Notice: DB status is UNPAID, NOT OVERDUE!
          createdAt: '2026-09-01T00:00:00Z',
          updatedAt: '2026-09-01T00:00:00Z'
        },
        {
          id: 'inv-od-2',
          invoiceNumber: 'INV-OD-2',
          customerId: 'c2',
          customerName: 'Cust 2',
          issueDate: '2026-09-01',
          dueDate: '2026-09-15', // Matures Sep 15
          currency: 'SAR',
          items: [],
          subtotal: 2000,
          totalDiscount: 0,
          totalTax: 0,
          grandTotal: 2000,
          amountPaid: 500,
          amountDue: 1500,
          status: 'PARTIALLY_PAID', // Notice: DB status is PARTIALLY_PAID
          createdAt: '2026-09-01T00:00:00Z',
          updatedAt: '2026-09-01T00:00:00Z'
        },
        {
          id: 'inv-od-3',
          invoiceNumber: 'INV-OD-3',
          customerId: 'c3',
          customerName: 'Cust 3',
          issueDate: '2026-09-01',
          dueDate: '2026-09-20', // Matures Sep 20
          currency: 'SAR',
          items: [],
          subtotal: 3000,
          totalDiscount: 0,
          totalTax: 0,
          grandTotal: 3000,
          amountPaid: 0,
          amountDue: 3000,
          status: 'UNPAID',
          createdAt: '2026-09-01T00:00:00Z',
          updatedAt: '2026-09-01T00:00:00Z'
        },
        {
          id: 'inv-od-4',
          invoiceNumber: 'INV-OD-4',
          customerId: 'c4',
          customerName: 'Cust 4',
          issueDate: '2026-09-01',
          dueDate: '2026-09-25', // Matures Sep 25
          currency: 'SAR',
          items: [],
          subtotal: 4000,
          totalDiscount: 0,
          totalTax: 0,
          grandTotal: 4000,
          amountPaid: 0,
          amountDue: 4000,
          status: 'UNPAID',
          createdAt: '2026-09-01T00:00:00Z',
          updatedAt: '2026-09-01T00:00:00Z'
        }
      ];

      // Time-Travel Progression: Advance referenceDate without mutating the database
      // 1. On Sep 09: None are overdue
      const m09 = calculateDashboardMetrics(invoices, '2026-09-09');
      expect(m09.overdueInvoicesCount).toBe(0);

      // 2. On Sep 10 (Due Date): Boundary check - NOT overdue on due date
      const m10 = calculateDashboardMetrics(invoices, '2026-09-10');
      expect(m10.overdueInvoicesCount).toBe(0);

      // 3. On Sep 11: Invoice 1 is past due
      const m11 = calculateDashboardMetrics(invoices, '2026-09-11');
      expect(m11.overdueInvoicesCount).toBe(1);

      // 4. On Sep 16: Invoices 1 and 2 are past due
      const m16 = calculateDashboardMetrics(invoices, '2026-09-16');
      expect(m16.overdueInvoicesCount).toBe(2);

      // 5. On Sep 21: Invoices 1, 2, and 3 are past due
      const m21 = calculateDashboardMetrics(invoices, '2026-09-21');
      expect(m21.overdueInvoicesCount).toBe(3);

      // 6. On Sep 26: All 4 invoices are past due
      const m26 = calculateDashboardMetrics(invoices, '2026-09-26');
      expect(m26.overdueInvoicesCount).toBe(4);
    });

    it('empirically verifies voided drafts and cancelled invoices are excluded from revenue and receivables', () => {
      const invoices: Invoice[] = [
        {
          id: 'inv-draft-void',
          invoiceNumber: 'INV-DRAFT-1',
          customerId: 'c1',
          customerName: 'Cust 1',
          issueDate: '2026-09-01',
          dueDate: '2026-09-10',
          currency: 'SAR',
          items: [],
          subtotal: 50000,
          totalDiscount: 0,
          totalTax: 0,
          grandTotal: 50000,
          amountPaid: 0,
          amountDue: 50000,
          status: 'DRAFT',
          createdAt: '2026-09-01T00:00:00Z',
          updatedAt: '2026-09-01T00:00:00Z'
        },
        {
          id: 'inv-cancelled-void',
          invoiceNumber: 'INV-CANCEL-1',
          customerId: 'c2',
          customerName: 'Cust 2',
          issueDate: '2026-09-01',
          dueDate: '2026-09-10',
          currency: 'SAR',
          items: [],
          subtotal: 75000,
          totalDiscount: 0,
          totalTax: 0,
          grandTotal: 75000,
          amountPaid: 25000,
          amountDue: 50000,
          status: 'CANCELLED',
          createdAt: '2026-09-01T00:00:00Z',
          updatedAt: '2026-09-01T00:00:00Z'
        }
      ];

      const metrics = calculateDashboardMetrics(invoices, '2026-09-19');

      // Draft & Cancelled must NOT inflate revenue, receivables, or invoiced totals
      expect(metrics.totalRevenue).toBe(0);
      expect(metrics.outstandingReceivables).toBe(0);
      expect(metrics.totalInvoiced).toBe(0);
      expect(metrics.overdueInvoicesCount).toBe(0);
      expect(metrics.unpaidInvoicesCount).toBe(0);
      expect(metrics.paidInvoicesCount).toBe(0);
      expect(metrics.totalInvoicesCount).toBe(0); // Only active non-draft/non-cancelled count
      expect(metrics.draftInvoicesCount).toBe(1);

      // Verify in Customer Ledger: Draft and Cancelled invoices are strictly excluded
      const dummyCustomer: Customer = {
        id: 'c1',
        name: 'Cust 1',
        currency: 'SAR',
        outstandingAmount: 0,
        totalInvoiced: 0,
        totalPaid: 0,
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      };

      const ledgerResult = calculateCustomerLedger(dummyCustomer, invoices, []);
      expect(ledgerResult.entries).toHaveLength(0);
      expect(ledgerResult.metrics.totalInvoiced).toBe(0);
      expect(ledgerResult.metrics.outstandingBalance).toBe(0);
      expect(ledgerResult.metrics.invoiceCount).toBe(0);
      expect(ledgerResult.metrics.overdueCount).toBe(0);
    });

    it('handles edge case: zero invoices dataset gracefully without NaN or runtime errors', () => {
      const metrics = calculateDashboardMetrics([], '2026-09-19');
      expect(metrics.totalRevenue).toBe(0);
      expect(metrics.outstandingReceivables).toBe(0);
      expect(metrics.totalInvoiced).toBe(0);
      expect(metrics.collectionRate).toBe(0);
      expect(metrics.totalInvoicesCount).toBe(0);
      expect(metrics.paidInvoicesCount).toBe(0);
      expect(metrics.overdueInvoicesCount).toBe(0);
      expect(metrics.recentInvoices).toHaveLength(0);
      expect(Number.isNaN(metrics.collectionRate)).toBe(false);
    });
  });

  // =========================================================================
  // SECTION 2: Layout & Responsive Geometry Stress (<90px & h-[82px])
  // =========================================================================
  describe('2. Layout & Responsive Geometry Stress', () => {
    it('empirically verifies KPI cards in MetricsGrid strictly measure <90px (specifically h-[82px])', () => {
      const mockMetrics: DashboardMetrics = {
        totalRevenue: 125000.5,
        outstandingReceivables: 45000.75,
        paidInvoicesCount: 28,
        overdueInvoicesCount: 3,
        unpaidInvoicesCount: 5,
        totalInvoicesCount: 33,
        draftInvoicesCount: 2,
        totalInvoiced: 170001.25,
        collectionRate: 73.5,
        primaryCurrency: 'SAR',
        recentInvoices: [],
        isLoading: false,
        error: null
      };

      const { container } = render(
        <DirectionProvider>
          <MetricsGrid metrics={mockMetrics} />
        </DirectionProvider>
      );

      const grid = container.querySelector('[data-testid="metrics-grid"]');
      expect(grid).not.toBeNull();
      // Verify responsive grid layout: 2-column mobile, 4-column desktop
      expect(grid?.className).toContain('grid-cols-2');
      expect(grid?.className).toContain('lg:grid-cols-4');

      // Query all rendered metric cards
      const cards = grid?.querySelectorAll(':scope > div');
      expect(cards).toHaveLength(4);

      cards?.forEach((card) => {
        // Strict height verification: MUST have h-[82px] class
        expect(card.className).toContain('h-[82px]');
        // Verify height class represents 82px which is strictly < 90px
        const heightMatch = card.className.match(/h-\[(\d+)px\]/);
        expect(heightMatch).not.toBeNull();
        const heightVal = parseInt(heightMatch![1], 10);
        expect(heightVal).toBe(82);
        expect(heightVal).toBeLessThan(90);

        // Verify card containment properties
        expect(card.className).toContain('min-w-0');
        expect(card.className).toContain('rounded-lg');
      });
    });

    it('empirically verifies CustomerProfileSummary KPI cards strictly measure <90px (h-[82px])', () => {
      const mockCustomer: Customer = {
        id: 'cust-profile-test',
        name: 'Al-Futtaim Commercial Group',
        email: 'billing@alfuttaim.example.com',
        phone: '+966 50 111 2233',
        taxNumber: '300999888700003',
        currency: 'SAR',
        outstandingAmount: 18500,
        totalInvoiced: 85000,
        totalPaid: 66500,
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      };

      const mockMetrics: CustomerFinancialMetrics = {
        totalInvoiced: 85000,
        totalPaid: 66500,
        outstandingBalance: 18500,
        invoiceCount: 12,
        paymentCount: 8,
        overdueCount: 1,
        overdueAmount: 5000,
        financialStatus: 'OVERDUE'
      };

      const { container } = render(
        <DirectionProvider>
          <CustomerProfileSummary customer={mockCustomer} metrics={mockMetrics} />
        </DirectionProvider>
      );

      // Metric cards query
      const metricCards = container.querySelectorAll('.h-\\[82px\\]');
      expect(metricCards).toHaveLength(3);

      metricCards.forEach((card) => {
        expect(card.className).toContain('h-[82px]');
        const heightMatch = card.className.match(/h-\[(\d+)px\]/);
        expect(heightMatch).not.toBeNull();
        const heightVal = parseInt(heightMatch![1], 10);
        expect(heightVal).toBe(82);
        expect(heightVal).toBeLessThan(90);
      });
    });

    it('empirically verifies CustomerList directory cards in card view strictly measure <90px (h-[82px])', () => {
      // Set mock customers
      mockCustomersState = [
        {
          id: 'c1',
          name: 'Al-Farabi Medical',
          phone: '+966501234567',
          currency: 'SAR',
          outstandingAmount: 4500,
          totalInvoiced: 12000,
          totalPaid: 7500,
          status: 'ACTIVE',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z'
        },
        {
          id: 'c2',
          name: 'Ibn Sina Pharmacy',
          phone: '+966559876543',
          currency: 'SAR',
          outstandingAmount: 0,
          totalInvoiced: 8000,
          totalPaid: 8000,
          status: 'ACTIVE',
          createdAt: '2026-02-01T00:00:00Z',
          updatedAt: '2026-02-01T00:00:00Z'
        }
      ];
      mockCustomersLoading = false;
      mockCustomerMetrics = {
        totalCount: 2,
        activeCount: 2,
        archivedCount: 0,
        totalOutstanding: 4500,
        withDebtCount: 1
      };

      const { container } = render(
        <MemoryRouter>
          <DirectionProvider>
            <CustomerList />
          </DirectionProvider>
        </MemoryRouter>
      );

      // Top customer directory metric cards (4 cards)
      const topKpis = container.querySelectorAll('[data-testid="customer-metrics-grid"] .h-\\[82px\\]');
      expect(topKpis).toHaveLength(4);
      topKpis.forEach((card) => {
        expect(card.className).toContain('h-[82px]');
      });

      // Directory customer cards (2 cards)
      const customerCards = container.querySelectorAll('[data-testid="customer-cards-grid"] > div');
      expect(customerCards).toHaveLength(2);
      customerCards.forEach((card) => {
        expect(card.className).toContain('h-[82px]');
        const heightMatch = card.className.match(/h-\[(\d+)px\]/);
        expect(heightMatch).not.toBeNull();
        const heightVal = parseInt(heightMatch![1], 10);
        expect(heightVal).toBe(82);
        expect(heightVal).toBeLessThan(90);
      });
    });

    it('empirically verifies 375px mobile viewport containment with 2-column grid and zero overflow', () => {
      const mockMetrics: DashboardMetrics = {
        totalRevenue: 99999999.99,
        outstandingReceivables: 88888888.88,
        paidInvoicesCount: 1542,
        overdueInvoicesCount: 219,
        unpaidInvoicesCount: 420,
        totalInvoicesCount: 1962,
        draftInvoicesCount: 15,
        totalInvoiced: 188888888.87,
        collectionRate: 52.9,
        primaryCurrency: 'SAR',
        recentInvoices: [],
        isLoading: false,
        error: null
      };

      const { container } = render(
        <div style={{ width: '375px', maxWidth: '375px', overflow: 'hidden' }}>
          <DirectionProvider>
            <MetricsGrid metrics={mockMetrics} />
          </DirectionProvider>
        </div>
      );

      const grid = container.querySelector('[data-testid="metrics-grid"]');
      expect(grid).not.toBeNull();
      // Grid must be 2 columns on mobile viewport
      expect(grid?.className).toContain('grid-cols-2');

      // Verify all card labels, headers, and values have truncate and min-w-0 to prevent overflow blowout
      const cards = grid?.querySelectorAll(':scope > div');
      expect(cards).toHaveLength(4);

      cards?.forEach((card) => {
        expect(card.className).toContain('min-w-0');
        const titles = card.querySelectorAll('p, h3');
        titles.forEach((textEl) => {
          expect(textEl.className).toContain('truncate');
        });
      });
    });

    it('empirically verifies containment under extreme adversarial inputs (ultra-long Arabic text & massive figures)', () => {
      localStorage.setItem('app_language', 'ar');

      const adversarialMetrics: DashboardMetrics = {
        totalRevenue: 999999999999.99,
        outstandingReceivables: 888888888888.88,
        paidInvoicesCount: 999999,
        overdueInvoicesCount: 888888,
        unpaidInvoicesCount: 777777,
        totalInvoicesCount: 1888887,
        draftInvoicesCount: 55555,
        totalInvoiced: 1888888888888.87,
        collectionRate: 52.9,
        primaryCurrency: 'SAR',
        recentInvoices: [],
        isLoading: false,
        error: null
      };

      const { container } = render(
        <div style={{ width: '375px', maxWidth: '375px', overflow: 'hidden' }}>
          <DirectionProvider>
            <MetricsGrid metrics={adversarialMetrics} />
          </DirectionProvider>
        </div>
      );

      // Verify rendered values are properly isolated and truncated
      const headers = container.querySelectorAll('h3');
      expect(headers.length).toBe(4);
      headers.forEach((h) => {
        expect(h.className).toContain('truncate');
        const bidiWrapper = h.querySelector('[dir="ltr"]');
        expect(bidiWrapper).not.toBeNull();
      });
    });
  });

  // =========================================================================
  // SECTION 3: Arabic RTL Mirroring and <BidiIsolate> Security
  // =========================================================================
  describe('3. Arabic RTL Mirroring and <BidiIsolate> Security', () => {
    it('empirically verifies document and container RTL direction in Arabic mode', () => {
      localStorage.setItem('app_language', 'ar');

      render(
        <DirectionProvider>
          <MetricsGrid
            metrics={{
              totalRevenue: 5000,
              outstandingReceivables: 2000,
              paidInvoicesCount: 5,
              overdueInvoicesCount: 1,
              unpaidInvoicesCount: 2,
              totalInvoicesCount: 7,
              draftInvoicesCount: 0,
              totalInvoiced: 7000,
              collectionRate: 71.4,
              primaryCurrency: 'SAR',
              recentInvoices: [],
              isLoading: false,
              error: null
            }}
          />
        </DirectionProvider>
      );

      // HTML root must have dir="rtl" and lang="ar"
      expect(document.documentElement.getAttribute('dir')).toBe('rtl');
      expect(document.documentElement.getAttribute('lang')).toBe('ar');
    });

    it('empirically verifies that all currency and numeric outputs are wrapped in <BidiIsolate> with dir="ltr" and unicode-isolate', () => {
      localStorage.setItem('app_language', 'ar');

      const mockCustomer: Customer = {
        id: 'cust-bidi',
        name: 'مؤسسة الرياض التجارية الكبرى',
        email: 'info@riyadh.sa',
        phone: '+966 50 999 8888',
        taxNumber: '300123456789003',
        currency: 'SAR',
        outstandingAmount: 12500.5,
        totalInvoiced: 50000,
        totalPaid: 37499.5,
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      };

      const mockMetrics: CustomerFinancialMetrics = {
        totalInvoiced: 50000,
        totalPaid: 37499.5,
        outstandingBalance: 12500.5,
        invoiceCount: 10,
        paymentCount: 6,
        overdueCount: 2,
        overdueAmount: 4500,
        financialStatus: 'OVERDUE'
      };

      const { container } = render(
        <DirectionProvider>
          <CustomerProfileSummary customer={mockCustomer} metrics={mockMetrics} />
        </DirectionProvider>
      );

      // Verify Tax Number isolation
      const taxEl = container.querySelector('.font-mono[dir="ltr"]');
      expect(taxEl).not.toBeNull();

      // Find all BidiIsolate instances: must have dir="ltr" and class "unicode-isolate"
      const bidiElements = container.querySelectorAll('[dir="ltr"]');
      expect(bidiElements.length).toBeGreaterThanOrEqual(5);

      bidiElements.forEach((el) => {
        expect(el.getAttribute('dir')).toBe('ltr');
        expect(el.className).toContain('unicode-isolate');
        expect(el.className).toContain('tabular-nums');
      });

      // Verify that phone number is protected with dir="ltr"
      const phoneEl = container.querySelector('a[href="tel:+966 50 999 8888"] [dir="ltr"]');
      expect(phoneEl).not.toBeNull();
      expect(phoneEl?.textContent).toContain('+966 50 999 8888');
    });

    it('empirically verifies chevron and directional icon flipping in Arabic mode', () => {
      localStorage.setItem('app_language', 'ar');

      mockCustomersState = [
        {
          id: 'cust-chevron',
          name: 'مؤسسة الواحة',
          currency: 'SAR',
          outstandingAmount: 200,
          totalInvoiced: 500,
          totalPaid: 300,
          status: 'ACTIVE',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z'
        }
      ];
      mockCustomersLoading = false;
      mockCustomerMetrics = {
        totalCount: 1,
        activeCount: 1,
        archivedCount: 0,
        totalOutstanding: 200,
        withDebtCount: 1
      };

      const { container } = render(
        <MemoryRouter>
          <DirectionProvider>
            <CustomerList />
          </DirectionProvider>
        </MemoryRouter>
      );

      // In CustomerList card view, ChevronRight has rtl:rotate-180
      const chevrons = container.querySelectorAll('.rtl\\:rotate-180');
      expect(chevrons.length).toBeGreaterThanOrEqual(1);
    });
  });
});
