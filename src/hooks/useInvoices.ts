/**
 * Invoice State Management Hook
 * 
 * Target: src/hooks/useInvoices.ts
 * Subscribes to Firestore invoices collection with offline IndexedDB caching,
 * instant local updates via includeMetadataChanges: true, client-side search/sort,
 * and optimistic atomic writeBatch CRUD operations.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, onSnapshot, query, Firestore, doc } from 'firebase/firestore';
import { db, getAccountCollection } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import type { Invoice, InvoiceStatus } from '@/types/domain';
import {
  trackSnapshotPendingWrites,
  unregisterPendingSource
} from '@/hooks/useSyncStatus';
import {
  getLocalPendingInvoices,
  removeLocalPendingInvoice,
  saveLocalPendingInvoice,
  getCachedInvoices,
  setCachedInvoices,
  removeCachedInvoice,
  upsertCachedInvoice,
  migrateLegacyAccountInvoices,
  LOCAL_INVOICE_CHANGE_EVENT
} from '@/lib/localInvoiceStorage';
import { triggerBackgroundSync, initBackgroundSyncWorker } from '@/lib/backgroundSyncService';
import { createInvoiceAtomic, updateInvoiceAtomic, cancelInvoiceAtomic } from '@/lib/atomicMutations';
import { trackPendingPromise } from '@/hooks/useSyncStatus';
import { normalizeSearchText } from '@/hooks/useCustomers';
import { subscribeAccountCache } from '@/lib/accountCache';

export type InvoiceStatusFilter = 'ALL' | InvoiceStatus;
export type InvoiceSortBy = 'issueDate' | 'dueDate' | 'invoiceNumber' | 'grandTotal' | 'amountDue';
export type SortOrder = 'asc' | 'desc';

export interface InvoiceMetrics {
  totalCount: number;
  unpaidCount: number;
  overdueCount: number;
  paidCount: number;
  partiallyPaidCount: number;
  draftCount: number;
  totalReceivables: number;
  totalRevenue: number;
}

export interface UseInvoicesReturn {
  // Reactive Data
  invoices: Invoice[];
  rawInvoices: Invoice[];
  loading: boolean;
  error: Error | null;

  // Search & Filters
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: InvoiceStatusFilter;
  setStatusFilter: (status: InvoiceStatusFilter) => void;
  customerFilter: string;
  setCustomerFilter: (customerId: string) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  clearFilters: () => void;

  // Sorting
  sortBy: InvoiceSortBy;
  setSortBy: (sort: InvoiceSortBy) => void;
  sortOrder: SortOrder;
  setSortOrder: (order: SortOrder) => void;
  toggleSortOrder: () => void;

  // Mutations
  createInvoice: (
    data: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt' | 'amountPaid' | 'amountDue' | 'status'> & {
      id?: string;
      status?: InvoiceStatus;
      amountPaid?: number;
    }
  ) => Promise<Invoice>;
  updateInvoice: (id: string, updates: Partial<Invoice>, oldInvoice?: Invoice) => Promise<void>;
  cancelInvoice: (id: string, oldInvoice?: Invoice, reason?: string) => Promise<void>;
  deleteInvoice: (id: string, oldInvoice?: Invoice) => Promise<void>;
  getInvoiceById: (id: string) => Invoice | undefined;
  getNextInvoiceNumber: () => string;

  // Aggregates
  metrics: InvoiceMetrics;
}

const SNAPSHOT_SOURCE_ID = 'invoices';

export function useInvoices(firestore: Firestore = db): UseInvoicesReturn {
  const { currentAccount } = useAuth();
  const accountId = currentAccount?.id || 'default';

  const [rawInvoices, setRawInvoices] = useState<Invoice[]>(() => {
    try {
      const cached = getCachedInvoices(accountId);
      const pending = getLocalPendingInvoices(accountId).map((p) => p.invoice);
      const map = new Map<string, Invoice>();
      cached.forEach((inv) => map.set(inv.id, inv));
      pending.forEach((inv) => map.set(inv.id, { ...inv, syncStatus: 'pending' }));
      return Array.from(map.values());
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Search, filter, and sort state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatusFilter>('ALL');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortBy, setSortBy] = useState<InvoiceSortBy>('issueDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Reactive subscription against Firestore IndexedDB local cache + background worker
  useEffect(() => {
    setLoading(true);
    migrateLegacyAccountInvoices(accountId);
    setRawInvoices(getCachedInvoices(accountId));
    const invoicesCol = getAccountCollection<Invoice>(firestore, 'invoices', accountId);
    const q = query(invoicesCol);

    const unsubscribe = onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot) => {
        trackSnapshotPendingWrites(SNAPSHOT_SOURCE_ID, snapshot);

        const loadedMap = new Map<string, Invoice>();
        snapshot.forEach((docSnap) => {
          const invData = docSnap.data() as Omit<Invoice, 'id'>;
          const isPending = Boolean(docSnap.metadata?.hasPendingWrites);
          loadedMap.set(docSnap.id, {
            id: docSnap.id,
            ...invData,
            syncStatus: isPending ? 'pending' : 'synced'
          } as Invoice);

          // If document is fully committed in Cloud Firestore without pending writes,
          // clear it from local offline queue
          const queued = getLocalPendingInvoices(accountId).find(item => item.invoiceId === docSnap.id);
          if (queued && (invData.updatedAt || '') >= (queued.invoice.updatedAt || '')) {
            removeLocalPendingInvoice(docSnap.id, accountId);
          }
        });

        // Retain any pending local invoices not yet reflected in Firestore snapshot
        const localPending = getLocalPendingInvoices(accountId);
        for (const item of localPending) {
          if (!loadedMap.has(item.invoiceId)) {
            loadedMap.set(item.invoiceId, {
              ...item.invoice,
              syncStatus: 'pending'
            });
          }
        }

        if (snapshot.metadata.fromCache) {
          for (const cached of getCachedInvoices(accountId)) {
            const loaded = loadedMap.get(cached.id);
            if (!loaded || (cached.updatedAt || '') > (loaded.updatedAt || '')) loadedMap.set(cached.id, cached);
          }
        }
        const merged = Array.from(loadedMap.values());
        setRawInvoices(merged);
        setCachedInvoices(merged, accountId);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[useInvoices] Snapshot listener error:', err);
        setError(err);
        setLoading(false);
      }
    );

    // Initialize background sync worker
    const cleanupWorker = initBackgroundSyncWorker(firestore);

    // Listen for local pending storage changes
    const handleLocalChange = () => {
      setRawInvoices(getCachedInvoices(accountId));
      setLoading(false);
    };
    const unsubscribeCustomerCache = subscribeAccountCache(`meezan_local_customers_${accountId}`, () => {
      migrateLegacyAccountInvoices(accountId);
      handleLocalChange();
    });

    if (typeof window !== 'undefined') {
      window.addEventListener(LOCAL_INVOICE_CHANGE_EVENT, handleLocalChange);
    }

    return () => {
      unsubscribe();
      unsubscribeCustomerCache();
      unregisterPendingSource(SNAPSHOT_SOURCE_ID);
      cleanupWorker();
      if (typeof window !== 'undefined') {
        window.removeEventListener(LOCAL_INVOICE_CHANGE_EVENT, handleLocalChange);
      }
    };
  }, [firestore, accountId]);

  // Aggregate metrics computed from raw dataset
  const metrics: InvoiceMetrics = useMemo(() => {
    let unpaidCount = 0;
    let overdueCount = 0;
    let paidCount = 0;
    let partiallyPaidCount = 0;
    let draftCount = 0;
    let totalReceivables = 0;
    let totalRevenue = 0;

    for (const inv of rawInvoices) {
      const status = inv.status;
      const due = Number(inv.amountDue) || 0;
      const paid = Number(inv.amountPaid) || 0;

      if (status === 'DRAFT') {
        draftCount++;
      } else if (status === 'PAID') {
        paidCount++;
      } else if (status === 'OVERDUE') {
        overdueCount++;
        totalReceivables += due;
      } else if (status === 'PARTIALLY_PAID') {
        partiallyPaidCount++;
        totalReceivables += due;
      } else if (status === 'UNPAID') {
        unpaidCount++;
        totalReceivables += due;
      }

      if (status !== 'CANCELLED') {
        totalRevenue += paid;
      }
    }

    return {
      totalCount: rawInvoices.length,
      unpaidCount,
      overdueCount,
      paidCount,
      partiallyPaidCount,
      draftCount,
      totalReceivables: Number(totalReceivables.toFixed(2)),
      totalRevenue: Number(totalRevenue.toFixed(2))
    };
  }, [rawInvoices]);

  // Filter and sort invoices client-side
  const filteredInvoices = useMemo(() => {
    const normalizedQuery = normalizeSearchText(searchQuery);

    return rawInvoices
      .filter((inv) => {
        // 1. Status filter
        if (statusFilter !== 'ALL' && inv.status !== statusFilter) {
          return false;
        }

        // 2. Customer filter
        if (customerFilter !== 'ALL' && inv.customerId !== customerFilter) {
          return false;
        }

        // 3. Date range filter
        if (startDate && inv.issueDate < startDate) {
          return false;
        }
        if (endDate && inv.issueDate > endDate) {
          return false;
        }

        // 4. Search query filter
        if (!normalizedQuery) return true;

        const numMatch = normalizeSearchText(inv.invoiceNumber || '').includes(normalizedQuery);
        const nameMatch = normalizeSearchText(inv.customerName || '').includes(normalizedQuery);
        const notesMatch = normalizeSearchText(inv.notes || '').includes(normalizedQuery);

        return numMatch || nameMatch || notesMatch;
      })
      .sort((a, b) => {
        let cmp = 0;
        switch (sortBy) {
          case 'issueDate':
            cmp = (a.issueDate || '').localeCompare(b.issueDate || '');
            break;
          case 'dueDate':
            cmp = (a.dueDate || '').localeCompare(b.dueDate || '');
            break;
          case 'invoiceNumber':
            cmp = (a.invoiceNumber || '').localeCompare(b.invoiceNumber || '', undefined, {
              numeric: true,
              sensitivity: 'base'
            });
            break;
          case 'grandTotal':
            cmp = (Number(a.grandTotal) || 0) - (Number(b.grandTotal) || 0);
            break;
          case 'amountDue':
            cmp = (Number(a.amountDue) || 0) - (Number(b.amountDue) || 0);
            break;
          default:
            cmp = 0;
        }

        return sortOrder === 'asc' ? cmp : -cmp;
      });
  }, [rawInvoices, searchQuery, statusFilter, customerFilter, startDate, endDate, sortBy, sortOrder]);

  const toggleSortOrder = useCallback(() => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setCustomerFilter('ALL');
    setStartDate('');
    setEndDate('');
  }, []);

  const getInvoiceById = useCallback(
    (id: string): Invoice | undefined => {
      return rawInvoices.find((inv) => inv.id === id);
    },
    [rawInvoices]
  );

  const getNextInvoiceNumber = useCallback((): string => {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    const matchingNumbers = rawInvoices
      .map((inv) => inv.invoiceNumber)
      .filter((num) => num && num.startsWith(prefix))
      .map((num) => parseInt(num.replace(prefix, ''), 10))
      .filter((n) => !isNaN(n));

    const nextSeq = matchingNumbers.length > 0 ? Math.max(...matchingNumbers) + 1 : 1;
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }, [rawInvoices]);

  // CRUD Actions (Zero-Latency Optimistic + Persistent Local Storage + Background Cloud Sync)
  const createInvoice = useCallback(
    async (
      data: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt' | 'amountPaid' | 'amountDue' | 'status'> & {
        id?: string;
        status?: InvoiceStatus;
        amountPaid?: number;
      }
    ): Promise<Invoice> => {
      const now = new Date().toISOString();
      const invoiceId = data.id || doc(collection(firestore, 'invoices')).id;
      const grandTotal = Number(data.grandTotal) || 0;
      const amountPaid = Number(data.amountPaid) || 0;
      const amountDue = Math.max(0, Number((grandTotal - amountPaid).toFixed(2)));
      const status: InvoiceStatus = data.status || (amountDue === 0 ? 'PAID' : 'UNPAID');

      const fullInvoice: Invoice = {
        ...data,
        id: invoiceId,
        amountPaid,
        amountDue,
        status,
        createdAt: now,
        updatedAt: now,
        syncStatus: 'pending'
      };

      await trackPendingPromise(createInvoiceAtomic({ invoice: fullInvoice }, firestore, accountId));
      upsertCachedInvoice(fullInvoice, accountId);
      setRawInvoices(getCachedInvoices(accountId));

      return fullInvoice;
    },
    [firestore, accountId]
  );

  const updateInvoice = useCallback(
    async (id: string, updates: Partial<Invoice>, oldInvoice?: Invoice): Promise<void> => {
      const targetOld = oldInvoice || rawInvoices.find((inv) => inv.id === id);
      if (!targetOld) {
        throw new Error(`Invoice with ID ${id} not found.`);
      }

      const result = await trackPendingPromise(updateInvoiceAtomic({ invoiceId: id, oldInvoice: targetOld, updates }, firestore, accountId));
      upsertCachedInvoice({ ...result.updatedInvoice, syncStatus: 'pending' }, accountId);
      setRawInvoices(getCachedInvoices(accountId));
    },
    [firestore, rawInvoices, accountId]
  );

  const cancelInvoice = useCallback(
    async (id: string, oldInvoice?: Invoice, reason?: string): Promise<void> => {
      const targetOld = oldInvoice || rawInvoices.find((inv) => inv.id === id);
      if (!targetOld) {
        throw new Error(`Invoice with ID ${id} not found.`);
      }

      await trackPendingPromise(cancelInvoiceAtomic({ invoiceId: id, currentInvoice: targetOld, reason }, firestore, accountId));
      upsertCachedInvoice({ ...targetOld, status: 'CANCELLED', amountDue: 0, updatedAt: new Date().toISOString(), syncStatus: 'pending' }, accountId);
      setRawInvoices(getCachedInvoices(accountId));
    },
    [firestore, rawInvoices, accountId]
  );

  const deleteInvoice = useCallback(
    async (id: string, oldInvoice?: Invoice): Promise<void> => {
      const targetOld = oldInvoice || rawInvoices.find((inv) => inv.id === id);
      if (!targetOld) {
        throw new Error(`Invoice with ID ${id} not found.`);
      }

      // 1. Instant UI & cache update
      setRawInvoices((prev) => prev.filter((inv) => inv.id !== id));
      removeCachedInvoice(id, accountId);

      // 2. Save pending delete mutation locally
      saveLocalPendingInvoice({
        invoiceId: id,
        invoice: targetOld,
        oldInvoice: targetOld,
        action: 'DELETE'
      }, accountId);

      // 3. Trigger background sync
      triggerBackgroundSync(firestore);
    },
    [firestore, rawInvoices, accountId]
  );

  return {
    invoices: filteredInvoices,
    rawInvoices,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    customerFilter,
    setCustomerFilter,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    clearFilters,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    toggleSortOrder,
    createInvoice,
    updateInvoice,
    cancelInvoice,
    deleteInvoice,
    getInvoiceById,
    getNextInvoiceNumber,
    metrics
  };
}
