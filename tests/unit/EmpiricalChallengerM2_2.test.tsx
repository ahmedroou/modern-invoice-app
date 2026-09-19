// tests/unit/EmpiricalChallengerM2_2.test.tsx
import { render, screen, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Domain and core library imports
import {
  createInvoiceAtomic,
  recordPaymentAtomic,
  createCustomerAtomic,
  type CreateInvoiceAtomicParams,
  type RecordPaymentAtomicParams
} from '@/lib/atomicMutations';
import {
  useSyncStatus,
  syncRegistry,
  reportPendingWrites,
  trackSnapshotPendingWrites,
  unregisterPendingSource,
  trackPendingPromise
} from '@/hooks/useSyncStatus';
import { offlineHarness, createMockSnapshotMetadata } from '../support/offline-harness';
import { SyncBadge } from '@/components/common/SyncBadge';
import { DirectionProvider } from '@/context/DirectionContext';
import {
  roundFinancial,
  calculateLineItem,
  calculateInvoiceTotals,
  formatCurrency
} from '@/lib/calculations';
import { db } from '@/lib/firebase';

// Helper component for testing useSyncStatus hook reactively
function HookSyncObserver() {
  const { isOnline, pendingSyncCount, status } = useSyncStatus();
  return (
    <div data-testid="sync-observer">
      <span data-testid="hook-online">{String(isOnline)}</span>
      <span data-testid="hook-pending">{pendingSyncCount}</span>
      <span data-testid="hook-status">{status}</span>
    </div>
  );
}

// Mock Firestore batch for empirical atomic mutation tests
const mockCommit = vi.fn().mockResolvedValue(undefined);
const mockSet = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    writeBatch: () => ({
      set: mockSet,
      update: mockUpdate,
      delete: mockDelete,
      commit: mockCommit
    })
  };
});

describe('Empirical Challenger M2-2: Offline Persistence, Network Transitions & Atomic Mutations', () => {
  beforeEach(() => {
    mockCommit.mockClear();
    mockSet.mockClear();
    mockUpdate.mockClear();
    mockDelete.mockClear();
    act(() => {
      offlineHarness.reset();
      syncRegistry.resetForTesting();
    });
  });

  afterEach(() => {
    cleanup();
    act(() => {
      offlineHarness.reset();
    });
  });

  // =========================================================================
  // SECTION 1: Offline Mutation Persistence via writeBatch()
  // =========================================================================
  describe('1. Offline Mutation Persistence (atomicMutations.ts)', () => {
    it('commits createInvoiceAtomic atomically into a single batch without network calls', async () => {
      const params: CreateInvoiceAtomicParams = {
        invoice: {
          id: 'inv-adversarial-101',
          invoiceNumber: 'INV-2026-ADV1',
          customerId: 'cust-adv-100',
          customerName: 'Gulf Construction Co',
          issueDate: '2026-09-19',
          dueDate: '2026-10-19',
          currency: 'SAR',
          items: [
            {
              id: 'item-1',
              description: 'Structural Engineering Review',
              quantity: 5,
              unitPrice: 2000,
              discount: 500,
              discountType: 'FIXED',
              taxRate: 15,
              lineDiscount: 500,
              lineTax: 1425,
              lineTotal: 10925
            }
          ],
          subtotal: 10000,
          totalDiscount: 500,
          totalTax: 1425,
          grandTotal: 10925,
          amountPaid: 0
        }
      };

      const result = await createInvoiceAtomic(params, db);

      // Verify batch commit was called exactly once (atomic execution)
      expect(mockCommit).toHaveBeenCalledTimes(1);

      // Verify return result structure
      expect(result.invoiceId).toBe('inv-adversarial-101');
      expect(result.invoice.grandTotal).toBe(10925);
      expect(result.invoice.amountPaid).toBe(0);
      expect(result.invoice.amountDue).toBe(10925);
      expect(result.invoice.status).toBe('UNPAID');

      // Verify 3 bundled atomic operations:
      // 1. Invoice document set
      expect(mockSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          id: 'inv-adversarial-101',
          grandTotal: 10925,
          amountDue: 10925,
          status: 'UNPAID'
        })
      );

      // 2. Customer balance incremented
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          outstandingAmount: expect.anything(),
          totalInvoiced: expect.anything()
        })
      );

      // 3. Activity log document set
      expect(mockSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: 'INVOICE_CREATED',
          entityType: 'INVOICE',
          entityId: 'inv-adversarial-101'
        })
      );
    });

    it('auto-transitions invoice status to PAID if amountPaid equals grandTotal at creation', async () => {
      const params: CreateInvoiceAtomicParams = {
        invoice: {
          id: 'inv-adv-paid-zero',
          invoiceNumber: 'INV-ZERO-DUE',
          customerId: 'cust-adv-100',
          customerName: 'Gulf Construction Co',
          issueDate: '2026-09-19',
          dueDate: '2026-10-19',
          currency: 'SAR',
          items: [],
          subtotal: 500,
          totalDiscount: 0,
          totalTax: 0,
          grandTotal: 500,
          amountPaid: 500
        }
      };

      const result = await createInvoiceAtomic(params, db);
      expect(result.invoice.amountDue).toBe(0);
      expect(result.invoice.status).toBe('PAID');
    });

    it('records full payment atomically and updates invoice, customer balance, and activity log', async () => {
      const params: RecordPaymentAtomicParams = {
        payment: {
          id: 'pay-adv-101',
          paymentNumber: 'PAY-ADV-001',
          invoiceId: 'inv-adv-101',
          invoiceNumber: 'INV-2026-ADV1',
          customerId: 'cust-adv-100',
          customerName: 'Gulf Construction Co',
          amount: 10925,
          paymentDate: '2026-09-19',
          paymentMethod: 'BANK_TRANSFER',
          referenceNumber: 'TXN-998877'
        },
        currentInvoice: {
          id: 'inv-adv-101',
          invoiceNumber: 'INV-2026-ADV1',
          grandTotal: 10925,
          amountPaid: 0,
          amountDue: 10925,
          status: 'UNPAID',
          customerId: 'cust-adv-100',
          customerName: 'Gulf Construction Co'
        }
      };

      const result = await recordPaymentAtomic(params, db);

      expect(mockCommit).toHaveBeenCalledTimes(1);
      expect(result.paymentId).toBe('pay-adv-101');
      expect(result.newInvoiceStatus).toBe('PAID');
      expect(result.newAmountDue).toBe(0);
      expect(result.newAmountPaid).toBe(10925);

      // Verify invoice update has status PAID
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'PAID'
        })
      );

      // Verify activity log registered
      expect(mockSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: 'PAYMENT_RECORDED',
          entityType: 'PAYMENT',
          entityId: 'pay-adv-101'
        })
      );
    });

    it('records partial payment atomically, leaving positive amountDue and status PARTIALLY_PAID', async () => {
      const params: RecordPaymentAtomicParams = {
        payment: {
          id: 'pay-adv-partial',
          paymentNumber: 'PAY-ADV-PART',
          invoiceId: 'inv-adv-101',
          invoiceNumber: 'INV-2026-ADV1',
          customerId: 'cust-adv-100',
          customerName: 'Gulf Construction Co',
          amount: 4000,
          paymentDate: '2026-09-19',
          paymentMethod: 'CASH'
        },
        currentInvoice: {
          id: 'inv-adv-101',
          invoiceNumber: 'INV-2026-ADV1',
          grandTotal: 10000,
          amountPaid: 1000,
          amountDue: 9000,
          status: 'PARTIALLY_PAID',
          customerId: 'cust-adv-100',
          customerName: 'Gulf Construction Co'
        }
      };

      const result = await recordPaymentAtomic(params, db);

      expect(result.newInvoiceStatus).toBe('PARTIALLY_PAID');
      expect(result.newAmountPaid).toBe(5000);
      expect(result.newAmountDue).toBe(5000);
    });

    it('handles overpayment gracefully by clamping amountDue to 0 and marking PAID', async () => {
      const params: RecordPaymentAtomicParams = {
        payment: {
          id: 'pay-adv-overpay',
          paymentNumber: 'PAY-ADV-OVER',
          invoiceId: 'inv-adv-101',
          invoiceNumber: 'INV-2026-ADV1',
          customerId: 'cust-adv-100',
          customerName: 'Gulf Construction Co',
          amount: 600,
          paymentDate: '2026-09-19',
          paymentMethod: 'CREDIT_CARD'
        },
        currentInvoice: {
          id: 'inv-adv-101',
          invoiceNumber: 'INV-2026-ADV1',
          grandTotal: 500,
          amountPaid: 0,
          amountDue: 500,
          status: 'UNPAID',
          customerId: 'cust-adv-100',
          customerName: 'Gulf Construction Co'
        }
      };

      const result = await recordPaymentAtomic(params, db);

      // Amount due must be clamped to 0, not negative
      expect(result.newAmountDue).toBe(0);
      expect(result.newInvoiceStatus).toBe('PAID');
      expect(result.newAmountPaid).toBe(600);
    });

    it('rejects invalid non-positive payment amounts with a descriptive error', async () => {
      const baseParams = {
        payment: {
          paymentNumber: 'PAY-ZERO',
          invoiceId: 'inv-1',
          invoiceNumber: 'INV-1',
          customerId: 'cust-1',
          customerName: 'Cust',
          amount: 0,
          paymentDate: '2026-09-19',
          paymentMethod: 'CASH' as const
        },
        currentInvoice: {
          id: 'inv-1',
          invoiceNumber: 'INV-1',
          grandTotal: 100,
          amountPaid: 0,
          amountDue: 100,
          status: 'UNPAID' as const,
          customerId: 'cust-1',
          customerName: 'Cust'
        }
      };

      await expect(recordPaymentAtomic(baseParams, db)).rejects.toThrow('Payment amount must be greater than 0');

      await expect(
        recordPaymentAtomic({ ...baseParams, payment: { ...baseParams.payment, amount: -50 } }, db)
      ).rejects.toThrow('Payment amount must be greater than 0');

      // Batch commit should never have been invoked
      expect(mockCommit).not.toHaveBeenCalled();
    });

    it('creates customer atomically with 0 initial balances and registers activity log', async () => {
      const result = await createCustomerAtomic(
        {
          customer: {
            id: 'cust-saudi-tech',
            name: 'Saudi Tech Systems',
            currency: 'SAR',
            email: 'info@sauditech.sa',
            status: 'ACTIVE'
          }
        },
        db
      );

      expect(result.customerId).toBe('cust-saudi-tech');
      expect(result.customer.outstandingAmount).toBe(0);
      expect(result.customer.totalInvoiced).toBe(0);
      expect(result.customer.totalPaid).toBe(0);
      expect(mockCommit).toHaveBeenCalledTimes(1);

      expect(mockSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          id: 'cust-saudi-tech',
          outstandingAmount: 0,
          totalInvoiced: 0,
          totalPaid: 0
        })
      );
    });
  });

  // =========================================================================
  // SECTION 2: Network State Reactive Sync & useSyncStatus Hook
  // =========================================================================
  describe('2. Network State Reactive Sync (useSyncStatus & SyncRegistry)', () => {
    it('empirically verifies reactive state transitions across offline, syncing, and synced', () => {
      render(<HookSyncObserver />);

      // Initial state
      expect(screen.getByTestId('hook-online')).toHaveTextContent('true');
      expect(screen.getByTestId('hook-pending')).toHaveTextContent('0');
      expect(screen.getByTestId('hook-status')).toHaveTextContent('synced');

      // 1. Transition to offline via window event
      act(() => {
        window.dispatchEvent(new Event('offline'));
      });
      expect(screen.getByTestId('hook-online')).toHaveTextContent('false');
      expect(screen.getByTestId('hook-status')).toHaveTextContent('offline');

      // 2. Add pending writes while offline -> status MUST remain 'offline'
      act(() => {
        reportPendingWrites('source-invoices', true);
      });
      expect(screen.getByTestId('hook-online')).toHaveTextContent('false');
      expect(screen.getByTestId('hook-pending')).toHaveTextContent('1');
      expect(screen.getByTestId('hook-status')).toHaveTextContent('offline');

      // 3. Dispatch online event with pending writes -> MUST immediately transition to 'syncing'
      act(() => {
        window.dispatchEvent(new Event('online'));
      });
      expect(screen.getByTestId('hook-online')).toHaveTextContent('true');
      expect(screen.getByTestId('hook-pending')).toHaveTextContent('1');
      expect(screen.getByTestId('hook-status')).toHaveTextContent('syncing');

      // 4. Resolve pending writes while online -> transitions to 'synced'
      act(() => {
        reportPendingWrites('source-invoices', false);
      });
      expect(screen.getByTestId('hook-online')).toHaveTextContent('true');
      expect(screen.getByTestId('hook-pending')).toHaveTextContent('0');
      expect(screen.getByTestId('hook-status')).toHaveTextContent('synced');
    });

    it('handles an adversarial storm of rapid alternating online/offline events without desynchronization', () => {
      render(<HookSyncObserver />);

      // Dispatch 50 rapid alternating network events in a microtask cycle
      act(() => {
        for (let i = 0; i < 50; i++) {
          window.dispatchEvent(new Event(i % 2 === 0 ? 'offline' : 'online'));
        }
      });

      // 50 iterations: 0 is offline, 1 is online ... 49 is online.
      expect(screen.getByTestId('hook-online')).toHaveTextContent('true');
      expect(screen.getByTestId('hook-status')).toHaveTextContent('synced');

      // Now dispatch one final offline event
      act(() => {
        window.dispatchEvent(new Event('offline'));
      });
      expect(screen.getByTestId('hook-online')).toHaveTextContent('false');
      expect(screen.getByTestId('hook-status')).toHaveTextContent('offline');
    });

    it('empirically verifies trackPendingPromise cleanup even when promises REJECT', async () => {
      render(<HookSyncObserver />);

      let rejectFn: (err: Error) => void;
      const failingPromise = new Promise((_, rej) => {
        rejectFn = rej;
      });

      // Track the failing promise
      act(() => {
        trackPendingPromise(failingPromise).catch(() => {
          // Expected test rejection caught
        });
      });

      // While in-flight, pending count should be 1 and status 'syncing'
      expect(screen.getByTestId('hook-pending')).toHaveTextContent('1');
      expect(screen.getByTestId('hook-status')).toHaveTextContent('syncing');

      // Reject the promise
      await act(async () => {
        rejectFn!(new Error('Simulated network commit timeout'));
        try {
          await failingPromise;
        } catch {
          // Handled
        }
      });

      // Crucial verification: pending count MUST decrement back to 0 without leaking!
      expect(screen.getByTestId('hook-pending')).toHaveTextContent('0');
      expect(screen.getByTestId('hook-status')).toHaveTextContent('synced');
    });

    it('tracks multiple concurrent promises resolving at different times', async () => {
      render(<HookSyncObserver />);

      let resolveP1: () => void;
      let resolveP2: () => void;
      let resolveP3: () => void;

      const p1 = new Promise<void>((r) => { resolveP1 = r; });
      const p2 = new Promise<void>((r) => { resolveP2 = r; });
      const p3 = new Promise<void>((r) => { resolveP3 = r; });

      act(() => {
        trackPendingPromise(p1);
        trackPendingPromise(p2);
        trackPendingPromise(p3);
      });

      expect(screen.getByTestId('hook-pending')).toHaveTextContent('3');
      expect(screen.getByTestId('hook-status')).toHaveTextContent('syncing');

      await act(async () => {
        resolveP2!();
        await p2;
      });
      expect(screen.getByTestId('hook-pending')).toHaveTextContent('2');

      await act(async () => {
        resolveP1!();
        resolveP3!();
        await Promise.all([p1, p3]);
      });
      expect(screen.getByTestId('hook-pending')).toHaveTextContent('0');
      expect(screen.getByTestId('hook-status')).toHaveTextContent('synced');
    });

    it('safely handles unregisterPendingSource for non-existent sources', () => {
      render(<HookSyncObserver />);
      expect(() => {
        act(() => {
          unregisterPendingSource('non-existent-source-key');
        });
      }).not.toThrow();
      expect(screen.getByTestId('hook-pending')).toHaveTextContent('0');
    });

    it('tracks snapshot pending writes via trackSnapshotPendingWrites and mock metadata', () => {
      render(<HookSyncObserver />);
      const mockMeta = createMockSnapshotMetadata(true, false);

      act(() => {
        trackSnapshotPendingWrites('invoices-realtime-sub', { metadata: mockMeta });
      });

      expect(screen.getByTestId('hook-pending')).toHaveTextContent('1');
      expect(screen.getByTestId('hook-status')).toHaveTextContent('syncing');

      act(() => {
        trackSnapshotPendingWrites('invoices-realtime-sub', {
          metadata: createMockSnapshotMetadata(false, false)
        });
      });

      expect(screen.getByTestId('hook-pending')).toHaveTextContent('0');
      expect(screen.getByTestId('hook-status')).toHaveTextContent('synced');
    });
  });

  // =========================================================================
  // SECTION 3: Offline Simulation Harness (withOfflineScope)
  // =========================================================================
  describe('3. Offline Simulation Harness (offlineHarness)', () => {
    it('restores online state when withOfflineScope callback completes successfully', async () => {
      expect(offlineHarness.isOfflineSimulated()).toBe(false);

      const result = await offlineHarness.withOfflineScope(db, async () => {
        // Assert that inside the scope, network is simulated offline
        expect(offlineHarness.isOfflineSimulated()).toBe(true);
        expect(syncRegistry.getSnapshot().isOnline).toBe(false);
        return 'success_payload';
      });

      expect(result).toBe('success_payload');
      // Assert network is restored to online after scope exits
      expect(offlineHarness.isOfflineSimulated()).toBe(false);
      expect(syncRegistry.getSnapshot().isOnline).toBe(true);
    });

    it('guarantees network restoration when withOfflineScope throws a SYNCHRONOUS error', async () => {
      expect(offlineHarness.isOfflineSimulated()).toBe(false);

      await expect(
        offlineHarness.withOfflineScope(db, () => {
          expect(offlineHarness.isOfflineSimulated()).toBe(true);
          throw new Error('Adversarial synchronous fault');
        })
      ).rejects.toThrow('Adversarial synchronous fault');

      // Network MUST be restored to online despite the thrown exception
      expect(offlineHarness.isOfflineSimulated()).toBe(false);
      expect(syncRegistry.getSnapshot().isOnline).toBe(true);
    });

    it('guarantees network restoration when withOfflineScope throws an ASYNCHRONOUS rejection', async () => {
      expect(offlineHarness.isOfflineSimulated()).toBe(false);

      await expect(
        offlineHarness.withOfflineScope(db, async () => {
          expect(offlineHarness.isOfflineSimulated()).toBe(true);
          await new Promise((_, rej) => setTimeout(() => rej(new Error('Adversarial async network drop')), 10));
        })
      ).rejects.toThrow('Adversarial async network drop');

      // Network MUST be restored to online despite async rejection
      expect(offlineHarness.isOfflineSimulated()).toBe(false);
      expect(syncRegistry.getSnapshot().isOnline).toBe(true);
    });

    it('handles nested withOfflineScope invocations without corruption', async () => {
      expect(offlineHarness.isOfflineSimulated()).toBe(false);

      await offlineHarness.withOfflineScope(db, async () => {
        expect(offlineHarness.isOfflineSimulated()).toBe(true);

        await offlineHarness.withOfflineScope(db, async () => {
          expect(offlineHarness.isOfflineSimulated()).toBe(true);
        });

        // After inner scope exits, outer scope should still have harness in working condition
      });

      expect(offlineHarness.isOfflineSimulated()).toBe(false);
      expect(syncRegistry.getSnapshot().isOnline).toBe(true);
    });

    it('returns false immediately from waitForPendingWritesWithTimeout when offline', async () => {
      await offlineHarness.simulateOffline();
      const result = await offlineHarness.waitForPendingWritesWithTimeout(db, 500);
      expect(result).toBe(false);
      await offlineHarness.simulateOnline();
    });

    it('increments toggleCount monotonically on toggleNetwork', async () => {
      offlineHarness.reset();
      expect(offlineHarness.getState().toggleCount).toBe(0);

      const toOffline = await offlineHarness.toggleNetwork();
      expect(toOffline).toBe(false);
      expect(offlineHarness.getState().toggleCount).toBe(1);

      const toOnline = await offlineHarness.toggleNetwork();
      expect(toOnline).toBe(true);
      expect(offlineHarness.getState().toggleCount).toBe(2);
    });
  });

  // =========================================================================
  // SECTION 4: Financial Math Engine Precision & Bidi Protection
  // =========================================================================
  describe('4. Financial Calculation Engine Stress Tests (calculations.ts)', () => {
    it('correctly rounds classic IEEE-754 floating point representation edge cases', () => {
      expect(roundFinancial(0.1 + 0.2)).toBe(0.3);
      expect(roundFinancial(1.005)).toBe(1.01);
      expect(roundFinancial(35.855)).toBe(35.86);
      expect(roundFinancial(1.05 * 3)).toBe(3.15);
      expect(roundFinancial(0.1 * 0.2)).toBe(0.02);
      expect(roundFinancial(-0)).toBe(0);
    });

    it('caps line discount when fixed discount exceeds gross amount', () => {
      const item = calculateLineItem({
        quantity: 2,
        unitPrice: 50,
        discount: 150, // Exceeds 100 gross
        discountType: 'FIXED',
        taxRate: 15
      });

      expect(item.grossAmount).toBe(100);
      expect(item.lineDiscount).toBe(100); // Capped at gross
      expect(item.taxableAmount).toBe(0);
      expect(item.lineTax).toBe(0);
      expect(item.lineTotal).toBe(0);
    });

    it('calculates aggregate invoice totals with multiple taxes and discounts accurately', () => {
      const items = [
        {
          quantity: 2,
          unitPrice: 100,
          discount: 10,
          discountType: 'PERCENTAGE' as const,
          taxRate: 15
        },
        {
          quantity: 1,
          unitPrice: 300,
          discount: 50,
          discountType: 'FIXED' as const,
          taxRate: 15
        }
      ];

      // Item 1: gross 200, discount 20, taxable 180, tax 27, total 207
      // Item 2: gross 300, discount 50, taxable 250, tax 37.5, total 287.5
      // Totals: subtotal 500, discount 70, tax 64.5, grandTotal 494.5
      const totals = calculateInvoiceTotals(items, 200);

      expect(totals.subtotal).toBe(500);
      expect(totals.totalDiscount).toBe(70);
      expect(totals.totalTax).toBe(64.5);
      expect(totals.grandTotal).toBe(494.5);
      expect(totals.amountDue).toBe(294.5);
    });

    it('applies Latin digits and bidirectional protection for Arabic RTL currency formatting', () => {
      const formattedAr = formatCurrency(1250.5, 'SAR', 'ar');
      // Must contain standard Western digits '1,250.50' rather than Eastern Arabic-Indic numerals
      expect(formattedAr).toContain('1,250.50');
      expect(formattedAr).not.toContain('١٬٢٥٠');
      expect(formattedAr.includes('ر.س') || formattedAr.includes('SAR')).toBe(true);

      // Custom currency fallback explicitly injects Unicode \u200E Left-to-Right mark
      const customAr = formatCurrency(1250.5, 'UNKNOWN_CURRENCY_CODE', 'ar');
      expect(customAr).toContain('\u200E');
      expect(customAr).toContain('1,250.50 UNKNOWN_CURRENCY_CODE');
    });
  });

  // =========================================================================
  // SECTION 5: SyncBadge UI Status Representation
  // =========================================================================
  describe('5. SyncBadge UI Visual & Accessibility Verification', () => {
    it('renders correct DOM attributes and color styles for synced, syncing, and offline states', () => {
      const { rerender } = render(
        <DirectionProvider>
          <SyncBadge status="synced" isOnline={true} pendingSyncCount={0} />
        </DirectionProvider>
      );
      let badge = screen.getByTestId('sync-badge');
      expect(badge).toHaveAttribute('data-status', 'synced');
      expect(badge).toHaveClass('bg-emerald-50');

      rerender(
        <DirectionProvider>
          <SyncBadge status="syncing" isOnline={true} pendingSyncCount={4} />
        </DirectionProvider>
      );
      badge = screen.getByTestId('sync-badge');
      expect(badge).toHaveAttribute('data-status', 'syncing');
      expect(badge).toHaveClass('bg-amber-50');
      expect(screen.getByTestId('sync-pending-count')).toHaveTextContent('4');

      rerender(
        <DirectionProvider>
          <SyncBadge status="offline" isOnline={false} pendingSyncCount={2} />
        </DirectionProvider>
      );
      badge = screen.getByTestId('sync-badge');
      expect(badge).toHaveAttribute('data-status', 'offline');
      expect(badge).toHaveClass('bg-rose-50');
    });
  });
});
