import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, render, screen } from '@testing-library/react';
import { roundFinancial } from '@/lib/calculations';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { MetricsGrid } from '@/components/modules/dashboard/MetricsGrid';
import { DirectionProvider } from '@/context/DirectionContext';
import { ThemeProvider } from '@/context/ThemeContext';
import type { Invoice } from '@/types/domain';

// Controllable onSnapshot callback capture for useDashboardMetrics testing
type SnapshotCb = (snapshot: { docs: Array<{ id: string; data: () => Partial<Invoice> }> }) => void;
type SnapshotErrCb = (err: Error) => void;

let capturedSnapshotSuccess: SnapshotCb | null = null;
let capturedSnapshotError: SnapshotErrCb | null = null;
const mockUnsubscribe = vi.fn();

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    onSnapshot: vi.fn((_ref, _opts, onNext, onError) => {
      capturedSnapshotSuccess = (snap: any) => {
        onNext({
          metadata: { hasPendingWrites: false },
          ...snap
        });
      };
      capturedSnapshotError = onError;
      return mockUnsubscribe;
    })
  };
});

describe('Empirical Challenger M3-6: Dashboard Metrics Calculation & Stress Harness', () => {
  beforeEach(() => {
    capturedSnapshotSuccess = null;
    capturedSnapshotError = null;
    mockUnsubscribe.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Direct Hook Lifecycle & Real-Time Snapshot Ingestion', () => {
    it('1.1 mounts in loading state with zeroed metrics before initial snapshot', () => {
      const { result } = renderHook(() => useDashboardMetrics({ referenceDate: '2026-09-19' }));

      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBeNull();
      expect(result.current.totalRevenue).toBe(0);
      expect(result.current.outstandingReceivables).toBe(0);
      expect(result.current.totalInvoiced).toBe(0);
      expect(result.current.paidInvoicesCount).toBe(0);
      expect(result.current.overdueInvoicesCount).toBe(0);
      expect(result.current.collectionRate).toBe(0);
      expect(result.current.recentInvoices).toEqual([]);
    });

    it('1.2 ingests empty collection snapshot without NaN, crash, or division by zero', () => {
      const { result } = renderHook(() => useDashboardMetrics({ referenceDate: '2026-09-19' }));

      act(() => {
        if (capturedSnapshotSuccess) {
          capturedSnapshotSuccess({ docs: [] });
        }
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.totalInvoicesCount).toBe(0);
      expect(result.current.collectionRate).toBe(0);
      expect(Number.isNaN(result.current.collectionRate)).toBe(false);
      expect(Number.isFinite(result.current.collectionRate)).toBe(true);
    });

    it('1.3 ingests live Firestore snapshot documents and updates reactive state', () => {
      const { result } = renderHook(() => useDashboardMetrics({ referenceDate: '2026-09-19', currency: 'SAR' }));

      const mockDocs = [
        {
          id: 'inv-live-1',
          data: () => ({
            id: 'inv-live-1',
            invoiceNumber: 'INV-100',
            customerName: 'Al-Madinah Tech',
            grandTotal: 5000,
            amountPaid: 5000,
            amountDue: 0,
            status: 'PAID',
            issueDate: '2026-09-01',
            dueDate: '2026-09-30',
            createdAt: '2026-09-01T10:00:00Z'
          } as Invoice)
        },
        {
          id: 'inv-live-2',
          data: () => ({
            id: 'inv-live-2',
            invoiceNumber: 'INV-101',
            customerName: 'Najd Corp',
            grandTotal: 3000,
            amountPaid: 1000,
            amountDue: 2000,
            status: 'PARTIALLY_PAID',
            issueDate: '2026-09-10',
            dueDate: '2026-09-25',
            createdAt: '2026-09-10T10:00:00Z'
          } as Invoice)
        }
      ];

      act(() => {
        if (capturedSnapshotSuccess) {
          capturedSnapshotSuccess({ docs: mockDocs });
        }
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.totalInvoiced).toBe(8000);
      expect(result.current.totalRevenue).toBe(6000);
      expect(result.current.outstandingReceivables).toBe(2000);
      expect(result.current.paidInvoicesCount).toBe(1);
      expect(result.current.unpaidInvoicesCount).toBe(1);
      expect(result.current.totalInvoicesCount).toBe(2);
      expect(result.current.collectionRate).toBe(75);
    });

    it('1.4 cleanly unregisters Firestore listener and pending source on unmount', () => {
      const { unmount } = renderHook(() => useDashboardMetrics());

      expect(mockUnsubscribe).not.toHaveBeenCalled();
      unmount();
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it('1.5 captures and propagates snapshot errors gracefully', () => {
      const { result } = renderHook(() => useDashboardMetrics());

      const testError = new Error('Permission denied or network failure');
      act(() => {
        if (capturedSnapshotError) {
          capturedSnapshotError(testError);
        }
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(testError);
    });
  });

  describe('2. Boundary Values, Zero States, and Overpayments', () => {
    it('2.1 handles 0.00 grand total invoices (100% complimentary/discount) without polluting metrics', () => {
      const { result } = renderHook(() => useDashboardMetrics({ referenceDate: '2026-09-19' }));

      act(() => {
        if (capturedSnapshotSuccess) {
          capturedSnapshotSuccess({
            docs: [
              {
                id: 'inv-free',
                data: () => ({
                  id: 'inv-free',
                  invoiceNumber: 'INV-FREE',
                  customerName: 'Free Tier Client',
                  grandTotal: 0,
                  amountPaid: 0,
                  amountDue: 0,
                  status: 'PAID',
                  issueDate: '2026-09-01',
                  dueDate: '2026-09-30'
                } as Invoice)
              }
            ]
          });
        }
      });

      expect(result.current.totalInvoiced).toBe(0);
      expect(result.current.totalRevenue).toBe(0);
      expect(result.current.outstandingReceivables).toBe(0);
      expect(result.current.totalInvoicesCount).toBe(1);
      expect(result.current.paidInvoicesCount).toBe(1); // Explicitly PAID status
      expect(result.current.collectionRate).toBe(0);
    });

    it('2.2 handles customer overpayment (amountPaid > grandTotal, negative amountDue) safely', () => {
      const { result } = renderHook(() => useDashboardMetrics({ referenceDate: '2026-09-19' }));

      act(() => {
        if (capturedSnapshotSuccess) {
          capturedSnapshotSuccess({
            docs: [
              {
                id: 'inv-overpaid',
                data: () => ({
                  id: 'inv-overpaid',
                  invoiceNumber: 'INV-OVER',
                  customerName: 'Overpaying Customer',
                  grandTotal: 1000,
                  amountPaid: 1250, // 250 overpayment / credit
                  amountDue: -250,
                  status: 'PAID',
                  issueDate: '2026-09-01',
                  dueDate: '2026-09-15'
                } as Invoice)
              }
            ]
          });
        }
      });

      expect(result.current.totalInvoiced).toBe(1000);
      expect(result.current.totalRevenue).toBe(1250);
      // Outstanding receivables must NOT decrement into negative territory for overpayments
      expect(result.current.outstandingReceivables).toBe(0);
      expect(result.current.unpaidInvoicesCount).toBe(0);
      expect(result.current.paidInvoicesCount).toBe(1);
      // Collection rate: 1250 / 1000 * 100 = 125.0%
      expect(result.current.collectionRate).toBe(125);
    });

    it('2.3 converts string-coerced numbers safely without string concatenation bugs', () => {
      const { result } = renderHook(() => useDashboardMetrics({ referenceDate: '2026-09-19' }));

      act(() => {
        if (capturedSnapshotSuccess) {
          capturedSnapshotSuccess({
            docs: [
              {
                id: 'inv-str-1',
                data: () => ({
                  id: 'inv-str-1',
                  invoiceNumber: 'INV-STR1',
                  customerName: 'String Formats',
                  // Simulating string data stored in Firestore
                  grandTotal: '1500.50' as unknown as number,
                  amountPaid: '500.25' as unknown as number,
                  amountDue: '1000.25' as unknown as number,
                  status: 'PARTIALLY_PAID',
                  issueDate: '2026-09-10',
                  dueDate: '2026-09-30'
                } as Invoice)
              },
              {
                id: 'inv-str-2',
                data: () => ({
                  id: 'inv-str-2',
                  invoiceNumber: 'INV-STR2',
                  customerName: 'String Formats 2',
                  grandTotal: '2499.50' as unknown as number,
                  amountPaid: '1499.75' as unknown as number,
                  amountDue: '999.75' as unknown as number,
                  status: 'PARTIALLY_PAID',
                  issueDate: '2026-09-11',
                  dueDate: '2026-09-30'
                } as Invoice)
              }
            ]
          });
        }
      });

      // 1500.50 + 2499.50 = 4000.00
      expect(result.current.totalInvoiced).toBe(4000);
      // 500.25 + 1499.75 = 2000.00
      expect(result.current.totalRevenue).toBe(2000);
      // 1000.25 + 999.75 = 2000.00
      expect(result.current.outstandingReceivables).toBe(2000);
      expect(result.current.collectionRate).toBe(50);
    });

    it('2.4 gracefully handles corrupt documents with null, undefined, or NaN financial fields', () => {
      const { result } = renderHook(() => useDashboardMetrics({ referenceDate: '2026-09-19' }));

      act(() => {
        if (capturedSnapshotSuccess) {
          capturedSnapshotSuccess({
            docs: [
              {
                id: 'inv-corrupt',
                data: () => ({
                  id: 'inv-corrupt',
                  invoiceNumber: 'INV-CORRUPT',
                  customerName: 'Corrupted Doc',
                  grandTotal: undefined,
                  amountPaid: null as unknown as number,
                  amountDue: NaN,
                  status: 'UNPAID',
                  dueDate: null as unknown as string
                } as unknown as Invoice)
              }
            ]
          });
        }
      });

      expect(result.current.totalInvoiced).toBe(0);
      expect(result.current.totalRevenue).toBe(0);
      expect(result.current.outstandingReceivables).toBe(0);
      expect(result.current.collectionRate).toBe(0);
      expect(result.current.overdueInvoicesCount).toBe(0);
      expect(Number.isNaN(result.current.totalInvoiced)).toBe(false);
    });
  });

  describe('3. Due Date Temporal Boundaries & Overdue Classification', () => {
    it('3.1 invoices due on the reference date itself are NOT overdue', () => {
      const { result } = renderHook(() => useDashboardMetrics({ referenceDate: '2026-09-19' }));

      act(() => {
        if (capturedSnapshotSuccess) {
          capturedSnapshotSuccess({
            docs: [
              {
                id: 'inv-due-today',
                data: () => ({
                  id: 'inv-due-today',
                  invoiceNumber: 'INV-TODAY',
                  customerName: 'Due Today',
                  grandTotal: 1000,
                  amountPaid: 0,
                  amountDue: 1000,
                  status: 'UNPAID',
                  issueDate: '2026-09-01',
                  dueDate: '2026-09-19' // Exactly today
                } as Invoice)
              }
            ]
          });
        }
      });

      expect(result.current.overdueInvoicesCount).toBe(0);
      expect(result.current.unpaidInvoicesCount).toBe(1);
    });

    it('3.2 invoices due 1 day prior with amountDue > 0 ARE classified as overdue', () => {
      const { result } = renderHook(() => useDashboardMetrics({ referenceDate: '2026-09-19' }));

      act(() => {
        if (capturedSnapshotSuccess) {
          capturedSnapshotSuccess({
            docs: [
              {
                id: 'inv-due-yesterday',
                data: () => ({
                  id: 'inv-due-yesterday',
                  invoiceNumber: 'INV-YEST',
                  customerName: 'Due Yesterday',
                  grandTotal: 1000,
                  amountPaid: 0,
                  amountDue: 1000,
                  status: 'UNPAID',
                  issueDate: '2026-09-01',
                  dueDate: '2026-09-18' // Yesterday
                } as Invoice)
              }
            ]
          });
        }
      });

      expect(result.current.overdueInvoicesCount).toBe(1);
    });

    it('3.3 invoices past due date but with amountDue === 0 are NOT overdue', () => {
      const { result } = renderHook(() => useDashboardMetrics({ referenceDate: '2026-09-19' }));

      act(() => {
        if (capturedSnapshotSuccess) {
          capturedSnapshotSuccess({
            docs: [
              {
                id: 'inv-past-cleared',
                data: () => ({
                  id: 'inv-past-cleared',
                  invoiceNumber: 'INV-CLEARED',
                  customerName: 'Past Cleared',
                  grandTotal: 2000,
                  amountPaid: 2000,
                  amountDue: 0,
                  status: 'UNPAID', // Notice status is UNPAID in DB, but balance is 0
                  issueDate: '2026-08-01',
                  dueDate: '2026-08-20'
                } as Invoice)
              }
            ]
          });
        }
      });

      expect(result.current.overdueInvoicesCount).toBe(0);
      expect(result.current.paidInvoicesCount).toBe(1); // amountDue <= 0.0001 && grandTotal > 0
    });

    it('3.4 invoices with empty or missing dueDate do not throw and are NOT classified as overdue', () => {
      const { result } = renderHook(() => useDashboardMetrics({ referenceDate: '2026-09-19' }));

      act(() => {
        if (capturedSnapshotSuccess) {
          capturedSnapshotSuccess({
            docs: [
              {
                id: 'inv-no-due-date',
                data: () => ({
                  id: 'inv-no-due-date',
                  invoiceNumber: 'INV-NODUE',
                  customerName: 'No Due Date',
                  grandTotal: 500,
                  amountPaid: 0,
                  amountDue: 500,
                  status: 'UNPAID',
                  issueDate: '2026-09-01',
                  dueDate: ''
                } as Invoice)
              }
            ]
          });
        }
      });

      expect(result.current.overdueInvoicesCount).toBe(0);
      expect(result.current.unpaidInvoicesCount).toBe(1);
    });
  });

  describe('4. Status Isolation & Accounting Invariants', () => {
    it('4.1 strictly isolates CANCELLED and DRAFT invoices from active financial metrics', () => {
      const { result } = renderHook(() => useDashboardMetrics({ referenceDate: '2026-09-19' }));

      act(() => {
        if (capturedSnapshotSuccess) {
          capturedSnapshotSuccess({
            docs: [
              {
                id: 'inv-can',
                data: () => ({
                  id: 'inv-can',
                  invoiceNumber: 'INV-CAN',
                  customerName: 'Cancelled',
                  grandTotal: 10000,
                  amountPaid: 4000,
                  amountDue: 6000,
                  status: 'CANCELLED',
                  issueDate: '2026-08-01',
                  dueDate: '2026-08-15'
                } as Invoice)
              },
              {
                id: 'inv-draft',
                data: () => ({
                  id: 'inv-draft',
                  invoiceNumber: 'INV-DRF',
                  customerName: 'Draft Invoice',
                  grandTotal: 7500,
                  amountPaid: 0,
                  amountDue: 7500,
                  status: 'DRAFT',
                  issueDate: '2026-09-15',
                  dueDate: '2026-09-30'
                } as Invoice)
              },
              {
                id: 'inv-act',
                data: () => ({
                  id: 'inv-act',
                  invoiceNumber: 'INV-ACT',
                  customerName: 'Active Invoice',
                  grandTotal: 2500,
                  amountPaid: 1000,
                  amountDue: 1500,
                  status: 'PARTIALLY_PAID',
                  issueDate: '2026-09-10',
                  dueDate: '2026-09-25'
                } as Invoice)
              }
            ]
          });
        }
      });

      expect(result.current.totalInvoiced).toBe(2500);
      expect(result.current.totalRevenue).toBe(1000);
      expect(result.current.outstandingReceivables).toBe(1500);
      expect(result.current.totalInvoicesCount).toBe(1);
      expect(result.current.draftInvoicesCount).toBe(1);
      expect(result.current.collectionRate).toBe(40.0);
    });

    it('4.2 correctly orders top 5 recent invoices by date descending', () => {
      const { result } = renderHook(() => useDashboardMetrics({ referenceDate: '2026-09-19' }));

      const dates = [
        '2026-09-01T08:00:00Z',
        '2026-09-05T08:00:00Z',
        '2026-09-18T08:00:00Z',
        '2026-09-12T08:00:00Z',
        '2026-09-19T08:00:00Z',
        '2026-09-08T08:00:00Z',
        '2026-09-15T08:00:00Z'
      ];

      const docs = dates.map((date, idx) => ({
        id: `inv-${idx}`,
        data: () => ({
          id: `inv-${idx}`,
          invoiceNumber: `INV-${idx}`,
          customerName: `Customer ${idx}`,
          grandTotal: 100 * (idx + 1),
          amountPaid: 0,
          amountDue: 100 * (idx + 1),
          status: 'UNPAID',
          issueDate: date.split('T')[0],
          createdAt: date
        } as Invoice)
      }));

      act(() => {
        if (capturedSnapshotSuccess) {
          capturedSnapshotSuccess({ docs });
        }
      });

      expect(result.current.recentInvoices.length).toBe(5);
      // Most recent should be 2026-09-19 (inv-4)
      expect(result.current.recentInvoices[0].id).toBe('inv-4');
      // Second most recent should be 2026-09-18 (inv-2)
      expect(result.current.recentInvoices[1].id).toBe('inv-2');
      // Third most recent should be 2026-09-15 (inv-6)
      expect(result.current.recentInvoices[2].id).toBe('inv-6');
    });
  });

  describe('5. IEEE-754 Precision Stress Test Across 2,000 Randomized Invoices', () => {
    it('5.1 verifies zero mantissa drift and invariant: totalInvoiced === totalRevenue + outstandingReceivables', () => {
      const { result } = renderHook(() => useDashboardMetrics({ referenceDate: '2026-09-19' }));

      const testInvoicesCount = 2000;
      let expectedRawRevenue = 0;
      let expectedRawReceivables = 0;
      let expectedRawInvoiced = 0;

      const docs: Array<{ id: string; data: () => Partial<Invoice> }> = [];
      for (let i = 0; i < testInvoicesCount; i++) {
        // Generate fractional amounts susceptible to floating point errors (e.g. .33, .67, .19, .01)
        const subtotal = roundFinancial(10 + (i % 100) * 0.33);
        const amountPaid = roundFinancial(subtotal * ((i % 5) * 0.25)); // 0%, 25%, 50%, 75%, 100%
        const amountDue = roundFinancial(subtotal - amountPaid);
        const status = amountDue <= 0.0001 ? 'PAID' : (amountPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID');

        expectedRawRevenue += amountPaid;
        expectedRawReceivables += amountDue;
        expectedRawInvoiced += subtotal;

        docs.push({
          id: `stress-inv-${i}`,
          data: () => ({
            id: `stress-inv-${i}`,
            invoiceNumber: `STR-${i}`,
            customerName: `Customer ${i % 50}`,
            grandTotal: subtotal,
            amountPaid,
            amountDue,
            status,
            issueDate: '2026-09-01',
            dueDate: i % 3 === 0 ? '2026-09-10' : '2026-09-25' // 1/3 overdue
          } as Invoice)
        });
      }

      act(() => {
        if (capturedSnapshotSuccess) {
          capturedSnapshotSuccess({ docs });
        }
      });

      const metrics = result.current;

      // Invariant: totalInvoiced === roundFinancial(totalRevenue + outstandingReceivables)
      expect(metrics.totalInvoiced).toBe(roundFinancial(metrics.totalRevenue + metrics.outstandingReceivables));
      expect(metrics.totalRevenue).toBe(roundFinancial(expectedRawRevenue));
      expect(metrics.outstandingReceivables).toBe(roundFinancial(expectedRawReceivables));
      expect(metrics.totalInvoiced).toBe(roundFinancial(expectedRawInvoiced));

      // Collection rate should be bounded between 0 and 100%
      expect(metrics.collectionRate).toBeGreaterThanOrEqual(0);
      expect(metrics.collectionRate).toBeLessThanOrEqual(100);
      expect(Number.isFinite(metrics.collectionRate)).toBe(true);
    });
  });

  describe('6. MetricsGrid Component Under Extreme & Adversarial Conditions', () => {
    it('6.1 renders trillion-SAR metrics without visual distortion or overflow', () => {
      const trillionMetrics = {
        totalRevenue: 999999999999.99,
        outstandingReceivables: 123456789012.34,
        paidInvoicesCount: 999999,
        overdueInvoicesCount: 8888,
        unpaidInvoicesCount: 15000,
        totalInvoicesCount: 1000000,
        draftInvoicesCount: 50,
        totalInvoiced: 1123456789012.33,
        collectionRate: 89.0,
        primaryCurrency: 'SAR',
        recentInvoices: [],
        isLoading: false,
        error: null
      };

      const { container } = render(
        <ThemeProvider>
          <DirectionProvider>
            <MetricsGrid metrics={trillionMetrics} />
          </DirectionProvider>
        </ThemeProvider>
      );

      const grid = screen.getByTestId('metrics-grid');
      expect(grid).toBeInTheDocument();

      // Ensure all 4 KPI cards strictly adhere to h-[82px] (<90px height)
      const cards = container.querySelectorAll('.h-\\[82px\\]');
      expect(cards.length).toBe(4);

      cards.forEach((card) => {
        expect(card.className).toContain('h-[82px]');
        expect(card.className).toContain('min-w-0');
        const truncatedElements = card.querySelectorAll('.truncate');
        expect(truncatedElements.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('6.2 renders zeroed metrics with appropriate "All accounts up to date" & "Zero Overdue" badges', () => {
      const zeroMetrics = {
        totalRevenue: 0,
        outstandingReceivables: 0,
        paidInvoicesCount: 0,
        overdueInvoicesCount: 0,
        unpaidInvoicesCount: 0,
        totalInvoicesCount: 0,
        draftInvoicesCount: 0,
        totalInvoiced: 0,
        collectionRate: 0,
        primaryCurrency: 'SAR',
        recentInvoices: [],
        isLoading: false,
        error: null
      };

      render(
        <ThemeProvider>
          <DirectionProvider>
            <MetricsGrid metrics={zeroMetrics} />
          </DirectionProvider>
        </ThemeProvider>
      );

      expect(screen.getByText('0 invoices paid')).toBeInTheDocument();
      expect(screen.getByText('0 unpaid invoices')).toBeInTheDocument();
      expect(screen.getByText('0 invoices')).toBeInTheDocument();
      expect(screen.getByText('All accounts up to date')).toBeInTheDocument();
      expect(screen.getByText('Zero Overdue')).toBeInTheDocument();
      expect(screen.getByText('All Clear')).toBeInTheDocument();
    });
  });
});
