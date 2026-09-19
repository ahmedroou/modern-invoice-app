# Investigation & Code Blueprints: Network Hook, Sync Indicator & Offline Simulation Harness

**Agent**: `teamwork_preview_explorer_m2_3_r2`  
**Working Directory**: `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m2_3_r2`  
**Role**: Network Hook, Sync Indicator & Offline Harness Specialist  
**Milestone**: Milestone 2 (Firebase Offline-First & Financial Calculation Engine)  
**Date**: 2026-09-19T12:33:00+03:00  

---

## 1. Observation

Direct observations from authoritative project documents, existing codebase, and execution environment:

1. **User Request & Acceptance Criteria (`ORIGINAL_REQUEST.md`)**:
   - **Requirement R3 (Offline-First Cloud Sync)**: *"Implement Firebase Firestore with offline persistence enabled. All CRUD operations must save locally immediately and sync to the cloud automatically in the background when the internet is available, ensuring a seamless offline experience."* (`ORIGINAL_REQUEST.md:24-25`)
   - **Acceptance Criterion AC6**: *"Data can be written and read when the network connection is disabled (verifying Firebase offline persistence)."* (`ORIGINAL_REQUEST.md:37`)
   - **User Global Directives**: *"Always prioritize mobile-first design... Ensure the UI/UX is fully optimized for mobile across all aspects..."* and *"Use compact card designs by default. Cards should occupy less vertical space, make efficient use of available width..."*

2. **Project Feature Inventory (`PROJECT.md`)**:
   - **Feature F-SYNC-03**: *"Network Status & Sync Indicator: Top-bar SaaS status pill indicating Online (Synced), Syncing, or Offline Mode."* (`PROJECT.md:85`)
   - **Feature F-SYNC-04**: *"Offline Test & Simulation Harness: Programmatic harness allowing offline disconnection and verification of local persistence."* (`PROJECT.md:86`)
   - **Milestone 2 Scope**: *"Firestore config with persistentMultipleTabManager, network detection hook, sync status indicator, offline simulation harness..."* (`PROJECT.md:117`)
   - **Component Layout**: `src/components/common/SyncBadge.tsx` and `src/hooks/useSyncStatus.ts` mapped in code layout (`PROJECT.md:302, 332`).

3. **Task Assignment (`DISPATCH.md:9-24`)**:
   - `src/hooks/useSyncStatus.ts`:
     - Listens to `window.addEventListener('online'/'offline')`.
     - Tracks pending writes across active Firestore snapshots (`snapshot.metadata.hasPendingWrites`).
     - Returns `{ isOnline: boolean, pendingSyncCount: number, status: 'synced' | 'syncing' | 'offline' }`.
   - `src/components/common/SyncBadge.tsx`:
     - Top-bar SaaS pill component displaying 3 distinct states:
       - 🟢 **Online (Synced)**: `online && pendingSyncCount === 0`
       - 🟡 **Syncing...**: `online && pendingSyncCount > 0`
       - 🔴 **Offline (Changes saved locally)**: `!online`
     - Bilingual (English & Arabic) and styled with compact pill geometry and tooltip.
   - Offline Simulation Harness (`tests/support/offline-harness.ts`):
     - Programmatically toggles Firestore network state via `disableNetwork(db)` and `enableNetwork(db)`.
     - Provides helper functions for integration tests to verify Acceptance Criterion AC6.
   - Unit tests: Design tests in `tests/unit/sync.test.ts`.

4. **Existing Codebase Analysis**:
   - **`src/context/DirectionContext.tsx`**:
     - Contains pre-configured bilingual strings for sync states:
       - English (`DirectionContext.tsx:50-52`):
         - `'sync.online'`: `'Online (Synced)'`
         - `'sync.syncing'`: `'Syncing...'`
         - `'sync.offline'`: `'Offline (Saved locally)'`
       - Arabic (`DirectionContext.tsx:100-102`):
         - `'sync.online'`: `'متصل (تمت المزامنة)'`
         - `'sync.syncing'`: `'جارٍ المزامنة...'`
         - `'sync.offline'`: `'غير متصل (محفوظ محلياً)'`
   - **`src/components/layout/TitleBar.tsx`**:
     - Includes a dedicated `children` slot at lines 9-10 and 93-102:
       ```tsx
       {/* Middle/Trailing Area: Slot for SaaS sync indicator, language/theme toggles */}
       <div className="flex items-center gap-2 pe-1 min-w-0">
         {children && (
           <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties} className="flex items-center gap-2">
             {children}
           </div>
         )}
       ```
     - Configured with `WebkitAppRegion: 'no-drag'` so interactive elements inside `children` receive mouse events.
   - **`src/components/layout/MobileNav.tsx`**:
     - Line 40 has mobile top header `header className="lg:hidden h-12 ..."` where compact sync pill can be rendered.
   - **Existing Tests**: Executing `npm test` runs 7 test files with 60 passing tests in 3.5s (`tests/unit/ThemeContext.test.tsx`, `DirectionContext.test.tsx`, `CompactCard.test.tsx`, `TitleBar.test.tsx`, etc.).
   - **Installed Packages (`package.json`)**:
     - `firebase`: `^11.4.0`
     - `lucide-react`: `^0.475.0`
     - `react` / `react-dom`: `^18.3.1`
     - `vitest`: `^3.0.5`
     - `@testing-library/react`: `^16.2.0`

---

## 2. Logic Chain

### 2.1 Network State Detection & Firestore Pending Writes Architecture (`useSyncStatus.ts`)

1. **The Firestore Pending Writes Challenge**:
   - Unlike legacy Firebase v8, Firebase Modular v10/v11 does not have a monolithic `db.onPendingWritesCountChanged()` API.
   - Firestore tracks pending mutations per query/document snapshot via `snapshot.metadata.hasPendingWrites`:
     - `true` when a document has been written to local IndexedDB but not yet acknowledged by Cloud Firestore.
     - `false` when local cache is completely in sync with remote cloud.
   - In addition, client writes can be tracked in-flight when invoking asynchronous mutations (`writeBatch().commit()`, `setDoc()`, etc.).

2. **Decoupled Observer Pattern (`SyncRegistry`)**:
   - To avoid re-binding window event listeners across multiple components or hooks, we implement a lightweight singleton `SyncRegistry`.
   - Responsibilities of `SyncRegistry`:
     - **OS / Browser Connectivity**: Tracks `window.addEventListener('online')` and `'offline'`. Defaults to `navigator.onLine`.
     - **Snapshot Sources**: Maintains a map `sources: Map<string, boolean>` where each key represents an active Firestore listener (e.g. `'invoices'`, `'customers'`, `'payments'`) and value indicates whether that query has pending writes.
     - **In-Flight Write Promises**: Tracks active mutation promises via `trackPendingPromise(promise)`.
     - **Calculated State**:
       - `pendingSyncCount = (count of sources with hasPendingWrites === true) + inFlightMutations`
       - Status State Machine:
         $$\text{status} = \begin{cases} \text{'offline'} & \text{if } \neg\text{isOnline} \\ \text{'syncing'} & \text{if } \text{isOnline} \land \text{pendingSyncCount} > 0 \\ \text{'synced'} & \text{if } \text{isOnline} \land \text{pendingSyncCount} == 0 \end{cases}$$
     - **Reactivity**: Emits notifications via a subscriber set (`Set<() => void>`).
     - **Testing Hooks**: Provides `setOnlineForTesting(boolean)` and `resetForTesting()` for deterministic, zero-flake test execution.

3. **Hook Contract (`useSyncStatus`)**:
   - Binds to `SyncRegistry` via `useEffect`.
   - Returns `{ isOnline: boolean, pendingSyncCount: number, status: 'synced' | 'syncing' | 'offline' }`.
   - Zero overhead when state is idle.

---

### 2.2 SaaS Compact Sync Pill Component Architecture (`SyncBadge.tsx`)

1. **Visual States & Design Requirements**:
   - **🟢 Synced (`status === 'synced'`)**:
     - Background: `bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60`
     - Indicator: Pulsing emerald dot (`w-1.5 h-1.5 rounded-full bg-emerald-500`) + Checkmark icon (`Check`).
     - Label: `t('sync.online')` ("Online (Synced)" in EN / "متصل (تمت المزامنة)" in AR).
   - **🟡 Syncing (`status === 'syncing'`)**:
     - Background: `bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60`
     - Indicator: Spinning sync icon (`Loader2` or `RefreshCw` with `animate-spin`).
     - Label: `t('sync.syncing')` ("Syncing..." in EN / "جارٍ المزامنة..." in AR) + count badge (`(1)` or `(N)`).
   - **🔴 Offline (`status === 'offline'`)**:
     - Background: `bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60`
     - Indicator: Solid rose dot (`w-1.5 h-1.5 rounded-full bg-rose-500`) + Disconnected icon (`WifiOff` or `CloudOff`).
     - Label: `t('sync.offline')` ("Offline (Saved locally)" in EN / "غير متصل (محفوظ محلياً)" in AR).

2. **Mobile-First Geometry & Compact Density**:
   - Height: `h-6` (24px), preserving titlebar vertical budget (<36px total titlebar).
   - Border radius: `rounded-full` for a sleek modern SaaS pill appearance.
   - Padding: `px-2 py-0.5` (compact, responsive).
   - Font: `text-[11px] font-medium leading-none`.
   - Compact Mode: Accepts `compact?: boolean` prop for narrow mobile headers where only the dot/icon and pending count are shown, hiding long text to avoid header overflow.
   - Bidi Safety: Pending numbers wrapped with `<BidiIsolate>` to prevent inversion in Arabic mode.

3. **Accessibility & Diagnostics**:
   - `role="status"`
   - `aria-live="polite"`
   - `data-testid="sync-badge"`
   - `data-status={status}`
   - `data-online={isOnline}`
   - `data-pending-count={pendingSyncCount}`
   - Dynamic `title` tooltip displaying descriptive context in the active language.

---

### 2.3 Programmatic Offline Simulation Test Harness Architecture (`tests/support/offline-harness.ts`)

1. **Acceptance Criterion AC6 Mandate**:
   - *"Data can be written and read when the network connection is disabled (verifying Firebase offline persistence)."*
2. **Network Control Mechanism**:
   - Firebase Firestore Web SDK provides:
     - `disableNetwork(db: Firestore): Promise<void>`: Immediately severs TCP/WebSocket communication with Cloud Firestore. Forces all queries to resolve from local IndexedDB and write operations to queue in IndexedDB.
     - `enableNetwork(db: Firestore): Promise<void>`: Re-establishes network connection and initiates cloud synchronization.
     - `waitForPendingWrites(db: Firestore): Promise<void>`: Resolves when all queued writes are acknowledged by the cloud.
3. **Offline Harness Capabilities**:
   - **Simulation Functions**:
     - `simulateOffline(db?: Firestore)`: Calls `disableNetwork(db)`, updates `syncRegistry`, and dispatches `window.dispatchEvent(new Event('offline'))`.
     - `simulateOnline(db?: Firestore)`: Calls `enableNetwork(db)`, updates `syncRegistry`, and dispatches `window.dispatchEvent(new Event('online'))`.
     - `toggleNetwork(db?: Firestore)`: Inverts current network state.
   - **Scoped Execution (`withOfflineScope`)**:
     - Disables network $\to$ executes test callback $\to$ re-enables network in a guaranteed `finally` block, preventing test contamination.
   - **AC6 Verification Runner (`verifyOfflineReadWrite`)**:
     - Disables network $\to$ writes document to test collection $\to$ reads back document $\to$ asserts `fromCache === true` and `hasPendingWrites === true` $\to$ re-enables network $\to$ returns diagnostic report.
   - **Mock Utilities**:
     - `createMockSnapshotMetadata(hasPendingWrites, fromCache)`: Allows unit testing Firestore snapshots without requiring an active IndexedDB connection.

---

### 2.4 Unit Test Specifications (`tests/unit/sync.test.ts`)

A 3-part Vitest test suite executing in <1 second:
1. **Hook Suite (`useSyncStatus`)**:
   - Initial state resolution (`isOnline: true`, `pendingSyncCount: 0`, `status: 'synced'`).
   - Browser offline event handling (`isOnline: false`, `status: 'offline'`).
   - Browser online event restoration (`isOnline: true`, `status: 'synced'`).
   - Reporting pending writes from snapshot listener (`status: 'syncing'`, `pendingSyncCount: 1`).
   - Multiple concurrent pending write sources aggregating properly.
   - Resolving pending writes returning status to `'synced'`.
   - Offline precedence: When offline with pending writes, `status` is `'offline'` while `pendingSyncCount` is preserved.
   - Unregistering sources upon component unmount.
   - Tracking mutation promises via `trackPendingPromise`.
2. **Component Suite (`SyncBadge`)**:
   - Renders 🟢 Synced state with correct classes and "Online (Synced)".
   - Renders 🟡 Syncing state with spinner and count badge.
   - Renders 🔴 Offline state with "Offline (Saved locally)".
   - Arabic RTL localization inside `DirectionProvider` ("متصل (تمت المزامنة)", "جارٍ المزامنة...", "غير متصل (محفوظ محلياً)").
   - Compact mode rendering (`compact={true}`).
   - Controlled override props (`status`, `isOnline`, `pendingSyncCount`).
   - Accessibility attributes (`role="status"`, `aria-live="polite"`, `title`).
3. **Harness Suite (`offline-harness`)**:
   - `simulateOffline` / `simulateOnline` state toggling.
   - `withOfflineScope` execution and guaranteed recovery.
   - `createMockSnapshotMetadata` helper verification.

---

## 3. Caveats

1. **`waitForPendingWrites` Offline Behavior**:
   - Calling `waitForPendingWrites(db)` while Firestore network is disabled causes the returned promise to stall indefinitely until the network is re-enabled. In the offline harness, we implement `waitForPendingWritesWithTimeout(db, timeoutMs)` using `Promise.race()` to prevent test hangs.
2. **Jsdom `navigator.onLine` Immutability**:
   - In standard jsdom environments, `navigator.onLine` is a read-only getter. The `SyncRegistry` and `offline-harness` use `syncRegistry.setOnlineForTesting()` and `window.dispatchEvent(new Event('online'|'offline'))` rather than attempting to mutate `navigator.onLine` directly.
3. **IndexedDB Multi-Tab Locking in Electron**:
   - Handled by Explorer M2-1 via `persistentMultipleTabManager()`. `useSyncStatus` and `offline-harness` are fully compatible with both single and multi-tab persistent managers.
4. **Mobile Titlebar Spatial Budget**:
   - On screens `<400px`, titlebar real estate is constrained. The `SyncBadge` provides an automatic responsive breakpoint (`hidden sm:inline` for long text) and an explicit `compact` prop for tight mobile navigation bars.

---

## 4. Conclusion & Actionable Code Blueprints

### 4.1 Blueprint 1: `src/hooks/useSyncStatus.ts`

```typescript
// src/hooks/useSyncStatus.ts
import { useState, useEffect } from 'react';

export type SyncStatusState = 'synced' | 'syncing' | 'offline';

export interface SyncStatusResult {
  /** Whether the device currently has an active network connection */
  isOnline: boolean;
  /** Total number of pending writes waiting to be committed to the cloud */
  pendingSyncCount: number;
  /** Tri-state sync indicator status */
  status: SyncStatusState;
}

/**
 * Global registry tracking network connectivity and active pending writes
 * across all Firestore snapshot listeners and mutation promises.
 */
export class SyncRegistry {
  private sources = new Map<string, boolean>();
  private inFlightMutations = 0;
  private listeners = new Set<() => void>();
  private isOnline: boolean;

  constructor() {
    this.isOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' 
      ? navigator.onLine 
      : true;

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
  }

  private handleOnline = () => {
    this.isOnline = true;
    this.notify();
  };

  private handleOffline = () => {
    this.isOnline = false;
    this.notify();
  };

  public getPendingCount(): number {
    let activeSnapshotCount = 0;
    for (const hasPending of this.sources.values()) {
      if (hasPending) activeSnapshotCount++;
    }
    return activeSnapshotCount + this.inFlightMutations;
  }

  public getSnapshot(): SyncStatusResult {
    const pendingSyncCount = this.getPendingCount();
    let status: SyncStatusState = 'synced';

    if (!this.isOnline) {
      status = 'offline';
    } else if (pendingSyncCount > 0) {
      status = 'syncing';
    } else {
      status = 'synced';
    }

    return {
      isOnline: this.isOnline,
      pendingSyncCount,
      status
    };
  }

  /**
   * Update pending write status for a specific named snapshot listener.
   */
  public reportPendingWrites(sourceId: string, hasPendingWrites: boolean): void {
    const prev = this.sources.get(sourceId);
    if (prev !== hasPendingWrites) {
      this.sources.set(sourceId, hasPendingWrites);
      this.notify();
    }
  }

  /**
   * Unregister a snapshot source when a component unmounts.
   */
  public unregisterSource(sourceId: string): void {
    if (this.sources.has(sourceId)) {
      this.sources.delete(sourceId);
      this.notify();
    }
  }

  /**
   * Track an asynchronous write mutation promise (e.g. batch.commit()).
   */
  public trackPromise<T>(promise: Promise<T>): Promise<T> {
    this.inFlightMutations++;
    this.notify();

    return promise.finally(() => {
      this.inFlightMutations = Math.max(0, this.inFlightMutations - 1);
      this.notify();
    });
  }

  /**
   * Subscribe to status changes.
   */
  public subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify(): void {
    this.listeners.forEach(callback => callback());
  }

  /**
   * Test helper to override online status programmatically.
   */
  public setOnlineForTesting(online: boolean): void {
    this.isOnline = online;
    this.notify();
  }

  /**
   * Test helper to reset internal registry state.
   */
  public resetForTesting(): void {
    this.sources.clear();
    this.inFlightMutations = 0;
    this.isOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' 
      ? navigator.onLine 
      : true;
    this.notify();
  }
}

/** Global singleton instance */
export const syncRegistry = new SyncRegistry();

/**
 * Report pending writes for a named Firestore snapshot listener.
 */
export function reportPendingWrites(sourceId: string, hasPendingWrites: boolean): void {
  syncRegistry.reportPendingWrites(sourceId, hasPendingWrites);
}

/**
 * Convenience helper to track snapshot metadata directly from onSnapshot.
 */
export function trackSnapshotPendingWrites(
  sourceId: string,
  snapshot: { metadata: { hasPendingWrites: boolean } }
): void {
  syncRegistry.reportPendingWrites(sourceId, snapshot.metadata.hasPendingWrites);
}

/**
 * Unregister a source listener when a component unmounts.
 */
export function unregisterPendingSource(sourceId: string): void {
  syncRegistry.unregisterSource(sourceId);
}

/**
 * Wrap a Firestore write mutation promise (e.g. batch.commit() or setDoc())
 * to increment the pending sync count while waiting for execution.
 */
export function trackPendingPromise<T>(promise: Promise<T>): Promise<T> {
  return syncRegistry.trackPromise(promise);
}

/**
 * React hook to observe real-time network and Firestore sync status.
 *
 * @returns {SyncStatusResult} { isOnline, pendingSyncCount, status }
 */
export function useSyncStatus(): SyncStatusResult {
  const [state, setState] = useState<SyncStatusResult>(() => syncRegistry.getSnapshot());

  useEffect(() => {
    setState(syncRegistry.getSnapshot());
    return syncRegistry.subscribe(() => {
      setState(syncRegistry.getSnapshot());
    });
  }, []);

  return state;
}
```

---

### 4.2 Blueprint 2: `src/components/common/SyncBadge.tsx`

```tsx
// src/components/common/SyncBadge.tsx
import React from 'react';
import { Loader2, WifiOff, Check } from 'lucide-react';
import { useSyncStatus, SyncStatusState } from '@/hooks/useSyncStatus';
import { useDirection } from '@/context/DirectionContext';
import { BidiIsolate } from '@/components/common/BidiIsolate';

export interface SyncBadgeProps {
  /** Optional status override (for testing or controlled usage) */
  status?: SyncStatusState;
  /** Optional online status override */
  isOnline?: boolean;
  /** Optional pending sync count override */
  pendingSyncCount?: number;
  /** Optional custom CSS classes */
  className?: string;
  /** Compact mode: hides long text, shows dot/icon and pending count (mobile-friendly) */
  compact?: boolean;
  /** Show/hide label text */
  showLabel?: boolean;
}

export const SyncBadge: React.FC<SyncBadgeProps> = ({
  status: controlledStatus,
  isOnline: controlledIsOnline,
  pendingSyncCount: controlledPendingCount,
  className = '',
  compact = false,
  showLabel = true
}) => {
  const hookStatus = useSyncStatus();
  const { t, language } = useDirection();

  const isOnline = controlledIsOnline !== undefined ? controlledIsOnline : hookStatus.isOnline;
  const pendingSyncCount = controlledPendingCount !== undefined ? controlledPendingCount : hookStatus.pendingSyncCount;
  const status = controlledStatus !== undefined ? controlledStatus : hookStatus.status;

  // Bilingual tooltips
  const tooltipText = React.useMemo(() => {
    if (status === 'offline') {
      return language === 'ar'
        ? 'وضع عدم الاتصال — التغييرات محفوظة محلياً وسيتم مزامنتها تلقائياً عند استعادة الاتصال'
        : 'Offline Mode — Changes saved locally to IndexedDB and will sync automatically when reconnected';
    }
    if (status === 'syncing') {
      return language === 'ar'
        ? `جارٍ مزامنة ${pendingSyncCount} من التغييرات مع السحابة...`
        : `Synchronizing ${pendingSyncCount} pending change(s) with Cloud Firestore...`;
    }
    return language === 'ar'
      ? 'المزامنة نشطة — تم حفظ ومزامنة جميع التغييرات مع السحابة'
      : 'Cloud Synced — All local changes are committed to Cloud Firestore';
  }, [status, pendingSyncCount, language]);

  // Label text matching DirectionContext dictionary
  const labelText = React.useMemo(() => {
    if (status === 'offline') {
      return t('sync.offline', 'Offline (Saved locally)');
    }
    if (status === 'syncing') {
      return t('sync.syncing', 'Syncing...');
    }
    return t('sync.online', 'Online (Synced)');
  }, [status, t]);

  // State-specific styling
  const stateStyles = {
    synced: {
      container: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60',
      dot: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]',
      icon: <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
    },
    syncing: {
      container: 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60',
      dot: 'bg-amber-500 animate-pulse',
      icon: <Loader2 className="w-3 h-3 text-amber-600 dark:text-amber-400 animate-spin shrink-0" />
    },
    offline: {
      container: 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/60',
      dot: 'bg-rose-500',
      icon: <WifiOff className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
    }
  }[status];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={labelText}
      title={tooltipText}
      data-testid="sync-badge"
      data-status={status}
      data-online={isOnline}
      data-pending-count={pendingSyncCount}
      className={`
        inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border
        select-none transition-all duration-150 shrink-0 cursor-default
        ${stateStyles.container}
        ${className}
      `}
    >
      {/* Visual Dot & Icon */}
      <span className="flex items-center gap-1 shrink-0">
        <span className={`w-1.5 h-1.5 rounded-full ${stateStyles.dot}`} aria-hidden="true" />
        {stateStyles.icon}
      </span>

      {/* Label Text */}
      {showLabel && (
        <span className={`truncate max-w-[160px] ${compact ? 'hidden sm:inline' : 'inline'}`}>
          {labelText}
        </span>
      )}

      {/* Pending Sync Count Badge (Visible when syncing or offline with pending changes) */}
      {pendingSyncCount > 0 && (
        <span
          data-testid="sync-pending-count"
          className="inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono bg-amber-200/70 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 shrink-0"
        >
          <BidiIsolate>{pendingSyncCount}</BidiIsolate>
        </span>
      )}
    </div>
  );
};

export default SyncBadge;
```

---

### 4.3 Blueprint 3: `tests/support/offline-harness.ts`

```typescript
// tests/support/offline-harness.ts
import {
  Firestore,
  disableNetwork,
  enableNetwork,
  waitForPendingWrites,
  doc,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { syncRegistry } from '@/hooks/useSyncStatus';

export interface OfflineHarnessState {
  isNetworkDisabled: boolean;
  offlineSince: number | null;
  toggleCount: number;
}

export interface OfflineVerificationOptions {
  collectionName?: string;
  testDocId?: string;
  payload?: Record<string, any>;
  timeoutMs?: number;
}

export interface OfflineVerificationResult {
  success: boolean;
  readFromCache: boolean;
  hasPendingWrites: boolean;
  offlineWriteLatencyMs: number;
  offlineReadLatencyMs: number;
  error?: string;
}

class OfflineHarness {
  private state: OfflineHarnessState = {
    isNetworkDisabled: false,
    offlineSince: null,
    toggleCount: 0
  };

  /**
   * Programmatically simulate network disconnection.
   * Disables Firestore network socket and notifies browser window listeners.
   */
  public async simulateOffline(db?: Firestore, triggerWindowEvent: boolean = true): Promise<void> {
    if (db) {
      try {
        await disableNetwork(db);
      } catch (err) {
        console.warn('offlineHarness.simulateOffline disableNetwork warning:', err);
      }
    }

    this.state.isNetworkDisabled = true;
    this.state.offlineSince = Date.now();
    this.state.toggleCount++;

    syncRegistry.setOnlineForTesting(false);

    if (triggerWindowEvent && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('offline'));
    }
  }

  /**
   * Programmatically simulate network reconnection.
   * Enables Firestore network socket and notifies browser window listeners.
   */
  public async simulateOnline(db?: Firestore, triggerWindowEvent: boolean = true): Promise<void> {
    if (db) {
      try {
        await enableNetwork(db);
      } catch (err) {
        console.warn('offlineHarness.simulateOnline enableNetwork warning:', err);
      }
    }

    this.state.isNetworkDisabled = false;
    this.state.offlineSince = null;
    this.state.toggleCount++;

    syncRegistry.setOnlineForTesting(true);

    if (triggerWindowEvent && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('online'));
    }
  }

  /**
   * Toggle network between online and offline states.
   */
  public async toggleNetwork(db?: Firestore): Promise<boolean> {
    if (this.state.isNetworkDisabled) {
      await this.simulateOnline(db);
      return true;
    } else {
      await this.simulateOffline(db);
      return false;
    }
  }

  /**
   * Check if simulated offline mode is currently active.
   */
  public isOfflineSimulated(): boolean {
    return this.state.isNetworkDisabled;
  }

  public getState(): Readonly<OfflineHarnessState> {
    return { ...this.state };
  }

  /**
   * Execute an operation in an isolated offline scope, guaranteeing that
   * online status is restored in the finally block.
   */
  public async withOfflineScope<T>(db: Firestore, callback: () => Promise<T>): Promise<T> {
    await this.simulateOffline(db);
    try {
      return await callback();
    } finally {
      await this.simulateOnline(db);
    }
  }

  /**
   * Await pending writes with a safe timeout to prevent test hanging.
   */
  public async waitForPendingWritesWithTimeout(db: Firestore, timeoutMs: number = 3000): Promise<boolean> {
    if (this.state.isNetworkDisabled) {
      // If offline, pending writes cannot sync to server
      return false;
    }

    try {
      const timeoutPromise = new Promise<boolean>((resolve) => {
        setTimeout(() => resolve(false), timeoutMs);
      });
      const writePromise = waitForPendingWrites(db).then(() => true);
      return await Promise.race([writePromise, timeoutPromise]);
    } catch {
      return false;
    }
  }

  /**
   * Programmatic verification runner for Acceptance Criterion AC6:
   * "Data can be written and read when the network connection is disabled".
   */
  public async verifyOfflineReadWrite(
    db: Firestore,
    options: OfflineVerificationOptions = {}
  ): Promise<OfflineVerificationResult> {
    const collectionName = options.collectionName || '_harness_offline_tests';
    const testDocId = options.testDocId || `ac6_test_${Date.now()}`;
    const payload = options.payload || {
      test: true,
      timestamp: new Date().toISOString(),
      note: 'AC6 Offline Verification'
    };

    const docRef = doc(db, collectionName, testDocId);

    // 1. Force offline network state
    await this.simulateOffline(db);

    try {
      // 2. Perform local write while offline
      const tWriteStart = performance.now();
      await setDoc(docRef, payload);
      const offlineWriteLatencyMs = performance.now() - tWriteStart;

      // 3. Perform local read while offline
      const tReadStart = performance.now();
      const snapshot = await getDoc(docRef);
      const offlineReadLatencyMs = performance.now() - tReadStart;

      if (!snapshot.exists()) {
        throw new Error('Offline write succeeded but document does not exist in local cache');
      }

      const readFromCache = snapshot.metadata.fromCache;
      const hasPendingWrites = snapshot.metadata.hasPendingWrites;

      return {
        success: true,
        readFromCache,
        hasPendingWrites,
        offlineWriteLatencyMs,
        offlineReadLatencyMs
      };
    } catch (err: any) {
      return {
        success: false,
        readFromCache: false,
        hasPendingWrites: false,
        offlineWriteLatencyMs: -1,
        offlineReadLatencyMs: -1,
        error: err?.message || String(err)
      };
    } finally {
      // 4. Restore online network state
      await this.simulateOnline(db);
    }
  }

  /**
   * Reset the harness state.
   */
  public reset(): void {
    this.state = {
      isNetworkDisabled: false,
      offlineSince: null,
      toggleCount: 0
    };
    syncRegistry.resetForTesting();
  }
}

export const offlineHarness = new OfflineHarness();

/**
 * Creates a mock Firestore snapshot metadata object for unit tests.
 */
export function createMockSnapshotMetadata(hasPendingWrites: boolean = false, fromCache: boolean = false) {
  return {
    hasPendingWrites,
    fromCache,
    isEqual: (other: any) =>
      other?.hasPendingWrites === hasPendingWrites && other?.fromCache === fromCache
  };
}
```

---

### 4.4 Blueprint 4: `tests/unit/sync.test.ts`

```typescript
// tests/unit/sync.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
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

// Helper component for testing useSyncStatus
function TestSyncConsumer() {
  const { isOnline, pendingSyncCount, status } = useSyncStatus();
  return (
    <div>
      <span data-testid="is-online">{String(isOnline)}</span>
      <span data-testid="pending-count">{pendingSyncCount}</span>
      <span data-testid="status">{status}</span>
    </div>
  );
}

describe('M2-3: Network Hook, Sync Indicator & Offline Simulation', () => {
  beforeEach(() => {
    offlineHarness.reset();
    syncRegistry.resetForTesting();
  });

  afterEach(() => {
    offlineHarness.reset();
  });

  // =========================================================================
  // 1. useSyncStatus Hook Specification Tests
  // =========================================================================
  describe('useSyncStatus Hook & SyncRegistry', () => {
    it('initializes with online state, 0 pending writes, and "synced" status', () => {
      render(<TestSyncConsumer />);
      expect(screen.getByTestId('is-online')).toHaveTextContent('true');
      expect(screen.getByTestId('pending-count')).toHaveTextContent('0');
      expect(screen.getByTestId('status')).toHaveTextContent('synced');
    });

    it('transitions to "offline" when window dispatches offline event', () => {
      render(<TestSyncConsumer />);
      act(() => {
        window.dispatchEvent(new Event('offline'));
      });
      expect(screen.getByTestId('is-online')).toHaveTextContent('false');
      expect(screen.getByTestId('status')).toHaveTextContent('offline');
    });

    it('restores "synced" status when window dispatches online event', () => {
      render(<TestSyncConsumer />);
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
      render(<TestSyncConsumer />);
      act(() => {
        reportPendingWrites('invoices-listener', true);
      });
      expect(screen.getByTestId('pending-count')).toHaveTextContent('1');
      expect(screen.getByTestId('status')).toHaveTextContent('syncing');
    });

    it('aggregates multiple concurrent snapshot sources with pending writes', () => {
      render(<TestSyncConsumer />);
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
      render(<TestSyncConsumer />);
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
      render(<TestSyncConsumer />);
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
      render(<TestSyncConsumer />);
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
      render(<TestSyncConsumer />);
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
        <DirectionProvider>
          <SyncBadge status="synced" isOnline={true} pendingSyncCount={0} />
        </DirectionProvider>
      );
      const badge = screen.getByTestId('sync-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute('data-status', 'synced');
      expect(badge).toHaveTextContent(/Online \(Synced\)/i);
      expect(badge).toHaveClass('bg-emerald-50');
    });

    it('renders 🟡 Syncing... state with pending count badge', () => {
      render(
        <DirectionProvider>
          <SyncBadge status="syncing" isOnline={true} pendingSyncCount={3} />
        </DirectionProvider>
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
        <DirectionProvider>
          <SyncBadge status="offline" isOnline={false} pendingSyncCount={0} />
        </DirectionProvider>
      );
      const badge = screen.getByTestId('sync-badge');
      expect(badge).toHaveAttribute('data-status', 'offline');
      expect(badge).toHaveTextContent(/Offline \(Saved locally\)/i);
      expect(badge).toHaveClass('bg-rose-50');
    });

    it('renders bilingual translations in Arabic RTL mode', () => {
      localStorage.setItem('app_language', 'ar');
      render(
        <DirectionProvider>
          <SyncBadge status="synced" isOnline={true} pendingSyncCount={0} />
        </DirectionProvider>
      );
      expect(screen.getByTestId('sync-badge')).toHaveTextContent(/متصل \(تمت المزامنة\)/);
      localStorage.removeItem('app_language');
    });

    it('applies compact layout styling when compact prop is provided', () => {
      render(
        <DirectionProvider>
          <SyncBadge status="synced" isOnline={true} pendingSyncCount={0} compact={true} />
        </DirectionProvider>
      );
      const badge = screen.getByTestId('sync-badge');
      expect(badge).toHaveClass('rounded-full');
      expect(badge).toHaveClass('text-[11px]');
    });

    it('includes accessibility attributes: role="status" and title tooltip', () => {
      render(
        <DirectionProvider>
          <SyncBadge status="offline" isOnline={false} pendingSyncCount={2} />
        </DirectionProvider>
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
```

---

### 4.5 Recommended Integration: Mounting `SyncBadge` in Layout

To wire `SyncBadge` cleanly into the application shell:

1. **In `src/components/layout/AppLayout.tsx`**:
   Mount `<SyncBadge />` directly inside `<TitleBar>`'s `children` slot:
   ```tsx
   import { SyncBadge } from '@/components/common/SyncBadge';
   // ...
   <TitleBar>
     <SyncBadge />
   </TitleBar>
   ```

2. **In `src/components/layout/MobileNav.tsx`**:
   Add compact `<SyncBadge compact />` into the mobile header (`header className="lg:hidden h-12 ..."`):
   ```tsx
   import { SyncBadge } from '@/components/common/SyncBadge';
   // ...
   <div className="flex items-center gap-1.5">
     <SyncBadge compact />
     {/* Language & Theme toggles */}
   </div>
   ```

---

## 5. Verification Method

To independently verify the blueprints and test specifications:

1. **Verify Implementation Against Interface Contracts**:
   - Inspect `src/hooks/useSyncStatus.ts` exports: `{ useSyncStatus, syncRegistry, reportPendingWrites, trackSnapshotPendingWrites, unregisterPendingSource, trackPendingPromise }`.
   - Inspect `src/components/common/SyncBadge.tsx` exports: `{ SyncBadge }` with support for `status`, `isOnline`, `pendingSyncCount`, `compact`.
   - Inspect `tests/support/offline-harness.ts` exports: `{ offlineHarness, createMockSnapshotMetadata }`.

2. **Execute Automated Vitest Test Suite**:
   ```bash
   npm test -- tests/unit/sync.test.ts
   ```
   *Expected result*: All 18 unit tests across `useSyncStatus`, `SyncBadge`, and `offline-harness` pass in <1 second with 0 errors.

3. **Verify Full Existing Test Suite Regression**:
   ```bash
   npm test
   ```
   *Expected result*: All 7 existing test suites (60 tests) continue to pass with 0 regressions.

4. **Invalidation Conditions**:
   - If `navigator.onLine` is directly assigned in jsdom without using `syncRegistry.setOnlineForTesting()` or `window.dispatchEvent`, tests will throw a TypeError in jsdom.
   - If `withOfflineScope` does not wrap restoration in a `finally` block, unhandled exceptions in integration tests will leave subsequent tests running in a disabled network state.
   - If `TitleBar`'s children container lacks `-webkit-app-region: no-drag`, mouse clicks or tooltips on `SyncBadge` will be captured by Electron's native window drag handler.
