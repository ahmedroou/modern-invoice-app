/**
 * Background Cloud Synchronization Service for Invoices
 * 
 * Target: src/lib/backgroundSyncService.ts
 * Asynchronously synchronizes locally saved pending invoices with Cloud Firestore
 * without blocking UI rendering or modal interactions.
 */

import { Firestore, doc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  getLocalPendingInvoices,
  removeLocalPendingInvoice,
  markInvoiceSyncStatus,
  PendingInvoiceItem
} from '@/lib/localInvoiceStorage';
import {
  createInvoiceAtomic,
  updateInvoiceAtomic,
  cancelInvoiceAtomic
} from '@/lib/atomicMutations';
import { trackPendingPromise } from '@/hooks/useSyncStatus';

let isSyncInProgress = false;
let syncWorkerTimer: any = null;

/**
 * Executes cloud sync for all currently queued pending invoices.
 */
export async function syncPendingInvoices(
  firestore: Firestore = db
): Promise<{ syncedCount: number; errorCount: number }> {
  if (isSyncInProgress) {
    return { syncedCount: 0, errorCount: 0 };
  }

  // Check if browser is online
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { syncedCount: 0, errorCount: 0 };
  }

  const pendingItems = getLocalPendingInvoices();
  if (pendingItems.length === 0) {
    return { syncedCount: 0, errorCount: 0 };
  }

  isSyncInProgress = true;
  let syncedCount = 0;
  let errorCount = 0;

  try {
    for (const item of pendingItems) {
      markInvoiceSyncStatus(item.invoiceId, 'syncing');

      try {
        await trackPendingPromise(processSinglePendingItem(item, firestore));
        removeLocalPendingInvoice(item.invoiceId);
        syncedCount++;
      } catch (err: any) {
        console.warn(`[BackgroundSync] Failed to sync invoice ${item.invoiceId}:`, err);
        markInvoiceSyncStatus(item.invoiceId, 'error', err?.message || 'Cloud sync failed');
        errorCount++;
      }
    }
  } finally {
    isSyncInProgress = false;
  }

  return { syncedCount, errorCount };
}

/**
 * Processes a single pending invoice item according to its action.
 */
async function processSinglePendingItem(
  item: PendingInvoiceItem,
  firestore: Firestore
): Promise<void> {
  switch (item.action) {
    case 'CREATE': {
      await createInvoiceAtomic(
        {
          invoice: item.invoice
        },
        firestore
      );
      break;
    }
    case 'UPDATE': {
      if (item.oldInvoice) {
        await updateInvoiceAtomic(
          {
            invoiceId: item.invoiceId,
            oldInvoice: item.oldInvoice,
            updates: item.invoice
          },
          firestore
        );
      } else {
        // Fallback: update document directly
        const batch = writeBatch(firestore);
        const invRef = doc(firestore, 'invoices', item.invoiceId);
        batch.update(invRef, {
          ...item.invoice,
          updatedAt: new Date().toISOString()
        });
        await batch.commit();
      }
      break;
    }
    case 'CANCEL': {
      await cancelInvoiceAtomic(
        {
          invoiceId: item.invoiceId,
          currentInvoice: item.oldInvoice || item.invoice,
          reason: item.reason
        },
        firestore
      );
      break;
    }
    case 'DELETE': {
      const batch = writeBatch(firestore);
      const invRef = doc(firestore, 'invoices', item.invoiceId);
      batch.delete(invRef);
      await batch.commit();
      break;
    }
  }
}

/**
 * Triggers an immediate background synchronization attempt without awaiting.
 */
export function triggerBackgroundSync(firestore: Firestore = db): void {
  // Run asynchronously detached from caller callstack
  setTimeout(() => {
    syncPendingInvoices(firestore).catch((err) => {
      console.warn('[BackgroundSync] Background sync exception:', err);
    });
  }, 10);
}

/**
 * Initializes listeners for online reconnection and automatic periodic sync retries.
 */
export function initBackgroundSyncWorker(
  firestore: Firestore = db,
  intervalMs = 15000
): () => void {
  const handleOnline = () => {
    console.info('[BackgroundSync] Network online detected, initiating sync...');
    triggerBackgroundSync(firestore);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
  }

  // Periodic retry for pending items
  if (!syncWorkerTimer && typeof setInterval !== 'undefined') {
    syncWorkerTimer = setInterval(() => {
      const pending = getLocalPendingInvoices();
      if (pending.length > 0) {
        syncPendingInvoices(firestore).catch(() => {});
      }
    }, intervalMs);
  }

  // Run an initial sync check
  triggerBackgroundSync(firestore);

  // Teardown cleanup
  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline);
    }
    if (syncWorkerTimer) {
      clearInterval(syncWorkerTimer);
      syncWorkerTimer = null;
    }
  };
}
