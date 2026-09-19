/**
 * Local Invoice Storage & Offline Queue
 * 
 * Target: src/lib/localInvoiceStorage.ts
 * Provides persistent offline storage and queue management for invoices.
 * Ensures zero-latency local persistence so newly created or edited invoices
 * are immediately saved to disk/storage before or during cloud sync.
 */

import type { Invoice } from '@/types/domain';

export type PendingSyncAction = 'CREATE' | 'UPDATE' | 'CANCEL' | 'DELETE';
export type SyncItemStatus = 'pending' | 'syncing' | 'synced' | 'error';

export interface PendingInvoiceItem {
  invoiceId: string;
  invoice: Invoice;
  action: PendingSyncAction;
  status: SyncItemStatus;
  createdAt: string;
  lastAttempt?: string;
  retryCount: number;
  error?: string;
  oldInvoice?: Invoice;
  reason?: string;
}

const PENDING_QUEUE_KEY = 'app_offline_invoices_queue_v1';
const LOCAL_CACHE_KEY = 'app_local_invoices_cache_v1';
export const LOCAL_INVOICE_CHANGE_EVENT = 'app:local-invoices-changed';

function isStorageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function notifyChange(): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(new CustomEvent(LOCAL_INVOICE_CHANGE_EVENT));
    } catch {
      // Ignore if CustomEvent is not supported in some test envs
    }
  }
}

/**
 * Retrieves all pending invoice mutations awaiting cloud synchronization.
 */
export function getLocalPendingInvoices(): PendingInvoiceItem[] {
  if (!isStorageAvailable()) return [];
  try {
    const raw = localStorage.getItem(PENDING_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[LocalInvoiceStorage] Failed to read pending queue:', err);
    return [];
  }
}

/**
 * Saves a pending invoice mutation to the offline queue and updates the local cache.
 */
export function saveLocalPendingInvoice(
  item: {
    invoiceId: string;
    invoice: Invoice;
    action: PendingSyncAction;
    status?: SyncItemStatus;
    oldInvoice?: Invoice;
    reason?: string;
  }
): void {
  if (!isStorageAvailable()) return;
  try {
    const queue = getLocalPendingInvoices();
    const existingIndex = queue.findIndex((q) => q.invoiceId === item.invoiceId);
    const now = new Date().toISOString();

    const pendingItem: PendingInvoiceItem = {
      invoiceId: item.invoiceId,
      invoice: {
        ...item.invoice,
        syncStatus: 'pending'
      },
      action: item.action,
      status: item.status || 'pending',
      createdAt: existingIndex >= 0 ? queue[existingIndex].createdAt : now,
      lastAttempt: existingIndex >= 0 ? queue[existingIndex].lastAttempt : undefined,
      retryCount: existingIndex >= 0 ? queue[existingIndex].retryCount : 0,
      oldInvoice: item.oldInvoice,
      reason: item.reason
    };

    if (existingIndex >= 0) {
      queue[existingIndex] = pendingItem;
    } else {
      queue.unshift(pendingItem);
    }

    localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue));

    // Also update cached invoices so the invoice is available immediately on reload
    upsertCachedInvoice(pendingItem.invoice);

    notifyChange();
  } catch (err) {
    console.error('[LocalInvoiceStorage] Failed to save pending invoice:', err);
  }
}

/**
 * Updates the sync status or error message of a pending item.
 */
export function markInvoiceSyncStatus(
  invoiceId: string,
  status: SyncItemStatus,
  error?: string
): void {
  if (!isStorageAvailable()) return;
  try {
    const queue = getLocalPendingInvoices();
    const index = queue.findIndex((q) => q.invoiceId === invoiceId);
    if (index >= 0) {
      queue[index].status = status;
      queue[index].lastAttempt = new Date().toISOString();
      if (status === 'error') {
        queue[index].retryCount = (queue[index].retryCount || 0) + 1;
        queue[index].error = error;
      }
      localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue));
      notifyChange();
    }
  } catch (err) {
    console.warn('[LocalInvoiceStorage] Failed to mark sync status:', err);
  }
}

/**
 * Removes an invoice from the pending queue once it has successfully synced with Cloud Firestore.
 */
export function removeLocalPendingInvoice(invoiceId: string): void {
  if (!isStorageAvailable()) return;
  try {
    const queue = getLocalPendingInvoices();
    const filtered = queue.filter((q) => q.invoiceId !== invoiceId);
    if (filtered.length !== queue.length) {
      localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(filtered));

      // Mark the cached invoice as synced
      const cached = getCachedInvoices();
      const cachedIndex = cached.findIndex((c) => c.id === invoiceId);
      if (cachedIndex >= 0) {
        cached[cachedIndex] = {
          ...cached[cachedIndex],
          syncStatus: 'synced'
        };
        setCachedInvoices(cached);
      }

      notifyChange();
    }
  } catch (err) {
    console.warn('[LocalInvoiceStorage] Failed to remove pending invoice:', err);
  }
}

/**
 * Gets the number of pending items awaiting synchronization.
 */
export function getPendingSyncCount(): number {
  return getLocalPendingInvoices().filter((q) => q.status !== 'synced').length;
}

/**
 * Retrieves the locally cached invoices list.
 */
export function getCachedInvoices(): Invoice[] {
  if (!isStorageAvailable()) return [];
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[LocalInvoiceStorage] Failed to read cached invoices:', err);
    return [];
  }
}

/**
 * Sets the full cached invoices list.
 */
export function setCachedInvoices(invoices: Invoice[]): void {
  if (!isStorageAvailable()) return;
  try {
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(invoices));
  } catch (err) {
    console.warn('[LocalInvoiceStorage] Failed to save cached invoices:', err);
  }
}

/**
 * Upserts a single invoice in the local cache.
 */
export function upsertCachedInvoice(invoice: Invoice): void {
  if (!isStorageAvailable()) return;
  try {
    const cached = getCachedInvoices();
    const index = cached.findIndex((c) => c.id === invoice.id);
    if (index >= 0) {
      cached[index] = invoice;
    } else {
      cached.unshift(invoice);
    }
    setCachedInvoices(cached);
  } catch (err) {
    console.warn('[LocalInvoiceStorage] Failed to upsert cached invoice:', err);
  }
}

/**
 * Removes a single invoice from local cache (e.g. after deletion).
 */
export function removeCachedInvoice(invoiceId: string): void {
  if (!isStorageAvailable()) return;
  try {
    const cached = getCachedInvoices();
    const filtered = cached.filter((c) => c.id !== invoiceId);
    setCachedInvoices(filtered);
  } catch (err) {
    console.warn('[LocalInvoiceStorage] Failed to remove cached invoice:', err);
  }
}

/**
 * Clears storage (used in test teardown).
 */
export function clearLocalInvoiceStorageForTesting(): void {
  if (!isStorageAvailable()) return;
  try {
    localStorage.removeItem(PENDING_QUEUE_KEY);
    localStorage.removeItem(LOCAL_CACHE_KEY);
  } catch {
    // Ignore in tests
  }
}
