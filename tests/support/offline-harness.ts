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
    if (db && 'app' in db) {
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
    if (db && 'app' in db) {
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
