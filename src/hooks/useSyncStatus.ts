import { useSyncExternalStore } from 'react';

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
  private cachedSnapshot: SyncStatusResult;

  constructor() {
    this.isOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' 
      ? navigator.onLine 
      : true;
    this.cachedSnapshot = this.computeSnapshot();

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
  }

  private computeSnapshot(): SyncStatusResult {
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

  public getSnapshot = (): SyncStatusResult => {
    return this.cachedSnapshot;
  };

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
  public subscribe = (callback: () => void): () => void => {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  };

  private notify(): void {
    this.cachedSnapshot = this.computeSnapshot();
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
 * Uses React 18 useSyncExternalStore to prevent tearing and extra renders.
 *
 * @returns {SyncStatusResult} { isOnline, pendingSyncCount, status }
 */
export function useSyncStatus(): SyncStatusResult {
  return useSyncExternalStore(
    syncRegistry.subscribe,
    syncRegistry.getSnapshot,
    syncRegistry.getSnapshot
  );
}
