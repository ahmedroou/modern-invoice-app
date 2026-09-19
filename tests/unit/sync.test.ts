// tests/unit/sync.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import React from 'react';
import {
  useSyncStatus,
  syncRegistry,
  reportPendingWrites,
  trackSnapshotPendingWrites,
  unregisterPendingSource,
  trackPendingPromise
} from '@/hooks/useSyncStatus';
import { SyncBadge } from '@/components/common/SyncBadge';
import { offlineHarness, createMockSnapshotMetadata } from '../support/offline-harness';
import { DirectionProvider } from '@/context/DirectionContext';

// Helper component for testing useSyncStatus without JSX syntax in pure .ts
function TestSyncConsumer() {
  const { isOnline, pendingSyncCount, status } = useSyncStatus();
  return React.createElement(
    'div',
    null,
    React.createElement('span', { 'data-testid': 'is-online' }, String(isOnline)),
    React.createElement('span', { 'data-testid': 'pending-count' }, pendingSyncCount),
    React.createElement('span', { 'data-testid': 'status' }, status)
  );
}

describe('M2-3: Network Hook, Sync Indicator & Offline Simulation', () => {
  beforeEach(() => {
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
  // 1. useSyncStatus Hook Specification Tests
  // =========================================================================
  describe('useSyncStatus Hook & SyncRegistry', () => {
    it('initializes with online state, 0 pending writes, and "synced" status', () => {
      render(React.createElement(TestSyncConsumer));
      expect(screen.getByTestId('is-online')).toHaveTextContent('true');
      expect(screen.getByTestId('pending-count')).toHaveTextContent('0');
      expect(screen.getByTestId('status')).toHaveTextContent('synced');
    });

    it('transitions to "offline" when window dispatches offline event', () => {
      render(React.createElement(TestSyncConsumer));
      act(() => {
        window.dispatchEvent(new Event('offline'));
      });
      expect(screen.getByTestId('is-online')).toHaveTextContent('false');
      expect(screen.getByTestId('status')).toHaveTextContent('offline');
    });

    it('restores "synced" status when window dispatches online event', () => {
      render(React.createElement(TestSyncConsumer));
      act(() => {
        window.dispatchEvent(new Event('offline'));
      });
      expect(screen.getByTestId('status')).toHaveTextContent('offline');

      act(() => {
        window.dispatchEvent(new Event('online'));
      });
      expect(screen.getByTestId('is-online')).toHaveTextContent('true');
      expect(screen.getByTestId('status')).toHaveTextContent('synced');
    });

    it('transitions to "syncing" when a snapshot reports pending writes', () => {
      render(React.createElement(TestSyncConsumer));
      act(() => {
        reportPendingWrites('invoices-listener', true);
      });
      expect(screen.getByTestId('pending-count')).toHaveTextContent('1');
      expect(screen.getByTestId('status')).toHaveTextContent('syncing');
    });

    it('aggregates multiple concurrent snapshot sources with pending writes', () => {
      render(React.createElement(TestSyncConsumer));
      act(() => {
        reportPendingWrites('invoices-listener', true);
        reportPendingWrites('customers-listener', true);
        reportPendingWrites('payments-listener', true);
      });
      expect(screen.getByTestId('pending-count')).toHaveTextContent('3');
      expect(screen.getByTestId('status')).toHaveTextContent('syncing');

      // Resolve one source
      act(() => {
        reportPendingWrites('invoices-listener', false);
      });
      expect(screen.getByTestId('pending-count')).toHaveTextContent('2');
      expect(screen.getByTestId('status')).toHaveTextContent('syncing');

      // Resolve all sources
      act(() => {
        reportPendingWrites('customers-listener', false);
        reportPendingWrites('payments-listener', false);
      });
      expect(screen.getByTestId('pending-count')).toHaveTextContent('0');
      expect(screen.getByTestId('status')).toHaveTextContent('synced');
    });

    it('tracks snapshot metadata via trackSnapshotPendingWrites', () => {
      render(React.createElement(TestSyncConsumer));
      const mockSnapshot = {
        metadata: createMockSnapshotMetadata(true, true)
      };

      act(() => {
        trackSnapshotPendingWrites('invoices-query', mockSnapshot);
      });
      expect(screen.getByTestId('pending-count')).toHaveTextContent('1');
      expect(screen.getByTestId('status')).toHaveTextContent('syncing');

      act(() => {
        trackSnapshotPendingWrites('invoices-query', {
          metadata: createMockSnapshotMetadata(false, false)
        });
      });
      expect(screen.getByTestId('pending-count')).toHaveTextContent('0');
      expect(screen.getByTestId('status')).toHaveTextContent('synced');
    });

    it('prioritizes "offline" status over "syncing" when network is down with pending writes', () => {
      render(React.createElement(TestSyncConsumer));
      act(() => {
        reportPendingWrites('invoices-listener', true);
      });
      expect(screen.getByTestId('status')).toHaveTextContent('syncing');

      act(() => {
        window.dispatchEvent(new Event('offline'));
      });
      // Even with pendingSyncCount = 1, status must be 'offline'
      expect(screen.getByTestId('is-online')).toHaveTextContent('false');
      expect(screen.getByTestId('pending-count')).toHaveTextContent('1');
      expect(screen.getByTestId('status')).toHaveTextContent('offline');
    });

    it('clears stale pending count when source is unregistered', () => {
      render(React.createElement(TestSyncConsumer));
      act(() => {
        reportPendingWrites('transient-modal-listener', true);
      });
      expect(screen.getByTestId('pending-count')).toHaveTextContent('1');

      act(() => {
        unregisterPendingSource('transient-modal-listener');
      });
      expect(screen.getByTestId('pending-count')).toHaveTextContent('0');
      expect(screen.getByTestId('status')).toHaveTextContent('synced');
    });

    it('tracks in-flight mutation promises via trackPendingPromise', async () => {
      render(React.createElement(TestSyncConsumer));
      let resolvePromise: (val: string) => void;
      const deferred = new Promise<string>((res) => {
        resolvePromise = res;
      });

      act(() => {
        trackPendingPromise(deferred);
      });
      expect(screen.getByTestId('pending-count')).toHaveTextContent('1');
      expect(screen.getByTestId('status')).toHaveTextContent('syncing');

      await act(async () => {
        resolvePromise!('done');
        await deferred;
      });
      expect(screen.getByTestId('pending-count')).toHaveTextContent('0');
      expect(screen.getByTestId('status')).toHaveTextContent('synced');
    });
  });

  // =========================================================================
  // 2. SyncBadge Component Specification Tests
  // =========================================================================
  describe('SyncBadge SaaS Pill Component', () => {
    it('renders 🟢 Online (Synced) state accurately', () => {
      render(
        React.createElement(
          DirectionProvider,
          null,
          React.createElement(SyncBadge, { status: 'synced', isOnline: true, pendingSyncCount: 0 })
        )
      );
      const badge = screen.getByTestId('sync-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute('data-status', 'synced');
      expect(badge).toHaveTextContent(/Online \(Synced\)/i);
      expect(badge).toHaveClass('bg-emerald-50');
    });

    it('renders 🟡 Syncing... state with pending count badge', () => {
      render(
        React.createElement(
          DirectionProvider,
          null,
          React.createElement(SyncBadge, { status: 'syncing', isOnline: true, pendingSyncCount: 3 })
        )
      );
      const badge = screen.getByTestId('sync-badge');
      expect(badge).toHaveAttribute('data-status', 'syncing');
      expect(badge).toHaveTextContent(/Syncing\.\.\./i);
      expect(badge).toHaveClass('bg-amber-50');

      const countBadge = screen.getByTestId('sync-pending-count');
      expect(countBadge).toHaveTextContent('3');
    });

    it('renders 🔴 Offline (Saved locally) state accurately', () => {
      render(
        React.createElement(
          DirectionProvider,
          null,
          React.createElement(SyncBadge, { status: 'offline', isOnline: false, pendingSyncCount: 0 })
        )
      );
      const badge = screen.getByTestId('sync-badge');
      expect(badge).toHaveAttribute('data-status', 'offline');
      expect(badge).toHaveTextContent(/Offline \(Saved locally\)/i);
      expect(badge).toHaveClass('bg-rose-50');
    });

    it('renders bilingual translations in Arabic RTL mode', () => {
      localStorage.setItem('app_language', 'ar');
      render(
        React.createElement(
          DirectionProvider,
          null,
          React.createElement(SyncBadge, { status: 'synced', isOnline: true, pendingSyncCount: 0 })
        )
      );
      expect(screen.getByTestId('sync-badge')).toHaveTextContent(/متصل \(تمت المزامنة\)/);
      localStorage.removeItem('app_language');
    });

    it('applies compact layout styling when compact prop is provided', () => {
      render(
        React.createElement(
          DirectionProvider,
          null,
          React.createElement(SyncBadge, { status: 'synced', isOnline: true, pendingSyncCount: 0, compact: true })
        )
      );
      const badge = screen.getByTestId('sync-badge');
      expect(badge).toHaveClass('rounded-full');
      expect(badge).toHaveClass('text-[11px]');
    });

    it('includes accessibility attributes: role="status" and title tooltip', () => {
      render(
        React.createElement(
          DirectionProvider,
          null,
          React.createElement(SyncBadge, { status: 'offline', isOnline: false, pendingSyncCount: 2 })
        )
      );
      const badge = screen.getByTestId('sync-badge');
      expect(badge).toHaveAttribute('role', 'status');
      expect(badge).toHaveAttribute('aria-live', 'polite');
      expect(badge).toHaveAttribute('title');
      expect(badge.getAttribute('title')).toContain('Offline Mode');
    });
  });

  // =========================================================================
  // 3. Offline Harness Specification Tests
  // =========================================================================
  describe('Offline Simulation Harness', () => {
    it('simulates offline and online transitions with event dispatch', async () => {
      expect(offlineHarness.isOfflineSimulated()).toBe(false);

      await offlineHarness.simulateOffline();
      expect(offlineHarness.isOfflineSimulated()).toBe(true);
      expect(syncRegistry.getSnapshot().isOnline).toBe(false);

      await offlineHarness.simulateOnline();
      expect(offlineHarness.isOfflineSimulated()).toBe(false);
      expect(syncRegistry.getSnapshot().isOnline).toBe(true);
    });

    it('toggles network status using toggleNetwork()', async () => {
      const state1 = await offlineHarness.toggleNetwork();
      expect(state1).toBe(false); // went offline
      expect(offlineHarness.isOfflineSimulated()).toBe(true);

      const state2 = await offlineHarness.toggleNetwork();
      expect(state2).toBe(true); // restored online
      expect(offlineHarness.isOfflineSimulated()).toBe(false);
    });

    it('guarantees online restoration inside withOfflineScope even when callback throws', async () => {
      const mockDb: any = {};
      const failingAction = async () => {
        expect(offlineHarness.isOfflineSimulated()).toBe(true);
        throw new Error('Test intentional failure');
      };

      await expect(offlineHarness.withOfflineScope(mockDb, failingAction)).rejects.toThrow(
        'Test intentional failure'
      );

      // Must be restored back to online
      expect(offlineHarness.isOfflineSimulated()).toBe(false);
      expect(syncRegistry.getSnapshot().isOnline).toBe(true);
    });

    it('creates accurate mock snapshot metadata', () => {
      const meta = createMockSnapshotMetadata(true, true);
      expect(meta.hasPendingWrites).toBe(true);
      expect(meta.fromCache).toBe(true);
      expect(meta.isEqual(createMockSnapshotMetadata(true, true))).toBe(true);
      expect(meta.isEqual(createMockSnapshotMetadata(false, true))).toBe(false);
    });
  });
});
