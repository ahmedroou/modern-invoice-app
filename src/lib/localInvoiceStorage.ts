/**
 * Local Invoice Storage & Offline Queue
 * 
 * Target: src/lib/localInvoiceStorage.ts
 * Provides persistent offline storage and queue management for invoices.
 * Ensures zero-latency local persistence so newly created or edited invoices
 * are immediately saved to disk/storage before or during cloud sync.
 */

import type { Invoice } from '@/types/domain';
import { getActiveAccountId } from '@/lib/firebase';

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
function scopedKey(key: string, accountId = getActiveAccountId()): string {
  return accountId === 'default' ? key : `${key}_${accountId}`;
}
export const LOCAL_INVOICE_CHANGE_EVENT = 'app:local-invoices-changed';

export function migrateLegacyAccountInvoices(accountId: string): void {
  if (!isStorageAvailable() || accountId === 'default') return;
  try {
    const customers = JSON.parse(localStorage.getItem(`meezan_local_customers_${accountId}`) || '[]') as { id: string }[];
    const customerIds = new Set(customers.map(customer => customer.id));
    const cached = getCachedInvoices(accountId);
    const knownIds = new Set(cached.map(invoice => invoice.id));
    const legacy = getCachedInvoices('default').filter(invoice => customerIds.has(invoice.customerId) && !knownIds.has(invoice.id));
    if (legacy.length) setCachedInvoices([...cached, ...legacy], accountId);
    const pending = getLocalPendingInvoices(accountId);
    const pendingIds = new Set(pending.map(item => item.invoiceId));
    const legacyPending = getLocalPendingInvoices('default').filter(item => customerIds.has(item.invoice.customerId) && !pendingIds.has(item.invoiceId));
    if (legacyPending.length) {
      localStorage.setItem(scopedKey(PENDING_QUEUE_KEY, accountId), JSON.stringify([...pending, ...legacyPending]));
      // Preserve the legacy records as a backup, but migrate each operation once.
      const migrated = new Set(legacyPending.map(item => item.invoiceId));
      localStorage.setItem(`${PENDING_QUEUE_KEY}_legacy_backup`, localStorage.getItem(`${PENDING_QUEUE_KEY}_legacy_backup`) || localStorage.getItem(PENDING_QUEUE_KEY) || '[]');
      localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(getLocalPendingInvoices('default').filter(item => !migrated.has(item.invoiceId))));
    }
  } catch (error) { console.warn('[InvoiceStorage] Could not migrate legacy invoices:', error); }
}

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
export function getLocalPendingInvoices(accountId = getActiveAccountId()): PendingInvoiceItem[] {
  if (!isStorageAvailable()) return [];
  try {
    const raw = localStorage.getItem(scopedKey(PENDING_QUEUE_KEY, accountId));
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
  },
  accountId = getActiveAccountId()
): void {
  if (!isStorageAvailable()) return;
  try {
    const queue = getLocalPendingInvoices(accountId);
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

    localStorage.setItem(scopedKey(PENDING_QUEUE_KEY, accountId), JSON.stringify(queue));

    // Also update cached invoices so the invoice is available immediately on reload
    upsertCachedInvoice(pendingItem.invoice, accountId);

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
  error?: string,
  accountId = getActiveAccountId()
): void {
  if (!isStorageAvailable()) return;
  try {
    const queue = getLocalPendingInvoices(accountId);
    const index = queue.findIndex((q) => q.invoiceId === invoiceId);
    if (index >= 0) {
      queue[index].status = status;
      queue[index].lastAttempt = new Date().toISOString();
      if (status === 'error') {
        queue[index].retryCount = (queue[index].retryCount || 0) + 1;
        queue[index].error = error;
      }
      localStorage.setItem(scopedKey(PENDING_QUEUE_KEY, accountId), JSON.stringify(queue));
      notifyChange();
    }
  } catch (err) {
    console.warn('[LocalInvoiceStorage] Failed to mark sync status:', err);
  }
}

/**
 * Removes an invoice from the pending queue once it has successfully synced with Cloud Firestore.
 */
export function removeLocalPendingInvoice(invoiceId: string, accountId = getActiveAccountId()): void {
  if (!isStorageAvailable()) return;
  try {
    const queue = getLocalPendingInvoices(accountId);
    const filtered = queue.filter((q) => q.invoiceId !== invoiceId);
    if (filtered.length !== queue.length) {
      localStorage.setItem(scopedKey(PENDING_QUEUE_KEY, accountId), JSON.stringify(filtered));

      // Mark the cached invoice as synced
      const cached = getCachedInvoices(accountId);
      const cachedIndex = cached.findIndex((c) => c.id === invoiceId);
      if (cachedIndex >= 0) {
        cached[cachedIndex] = {
          ...cached[cachedIndex],
          syncStatus: 'synced'
        };
        setCachedInvoices(cached, accountId);
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
export function getCachedInvoices(accountId = getActiveAccountId()): Invoice[] {
  if (!isStorageAvailable()) return [];
  try {
    const raw = localStorage.getItem(scopedKey(LOCAL_CACHE_KEY, accountId));
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
export function setCachedInvoices(invoices: Invoice[], accountId = getActiveAccountId()): void {
  if (!isStorageAvailable()) return;
  try {
    const key = scopedKey(LOCAL_CACHE_KEY, accountId);
    const value = JSON.stringify(invoices);
    if (localStorage.getItem(key) === value) return;
    localStorage.setItem(key, value);
    notifyChange();
  } catch (err) {
    console.warn('[LocalInvoiceStorage] Failed to save cached invoices:', err);
  }
}

/**
 * Upserts a single invoice in the local cache.
 */
export function upsertCachedInvoice(invoice: Invoice, accountId = getActiveAccountId()): void {
  if (!isStorageAvailable()) return;
  try {
    const cached = getCachedInvoices(accountId);
    const index = cached.findIndex((c) => c.id === invoice.id);
    if (index >= 0) {
      cached[index] = invoice;
    } else {
      cached.unshift(invoice);
    }
    setCachedInvoices(cached, accountId);
  } catch (err) {
    console.warn('[LocalInvoiceStorage] Failed to upsert cached invoice:', err);
  }
}

/**
 * Removes a single invoice from local cache (e.g. after deletion).
 */
export function removeCachedInvoice(invoiceId: string, accountId = getActiveAccountId()): void {
  if (!isStorageAvailable()) return;
  try {
    const cached = getCachedInvoices(accountId);
    const filtered = cached.filter((c) => c.id !== invoiceId);
    setCachedInvoices(filtered, accountId);
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
    localStorage.removeItem(scopedKey(PENDING_QUEUE_KEY));
    localStorage.removeItem(scopedKey(LOCAL_CACHE_KEY));
  } catch {
    // Ignore in tests
  }
}
