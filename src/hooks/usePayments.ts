/**
 * Payment State Management Hook
 * 
 * Target: src/hooks/usePayments.ts
 * Subscribes to Firestore payments collection with offline IndexedDB caching,
 * instant local updates via includeMetadataChanges: true, client-side search/sort,
 * and optimistic atomic writeBatch payment recording.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { onSnapshot, query, Firestore } from 'firebase/firestore';
import { db, getAccountCollection } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import type { Payment, PaymentMethod } from '@/types/domain';
import { readAccountCache, writeAccountCache, subscribeAccountCache } from '@/lib/accountCache';
import { getCachedInvoices, upsertCachedInvoice } from '@/lib/localInvoiceStorage';
import {
  trackSnapshotPendingWrites,
  unregisterPendingSource,
  trackPendingPromise
} from '@/hooks/useSyncStatus';
import {
  recordPaymentAtomic,
  type RecordPaymentAtomicParams,
  type RecordPaymentAtomicResult
} from '@/lib/atomicMutations';
import { normalizeSearchText } from '@/hooks/useCustomers';

export type PaymentMethodFilter = 'ALL' | PaymentMethod;
export type PaymentSortBy = 'paymentDate' | 'amount' | 'paymentNumber';
export type SortOrder = 'asc' | 'desc';

export interface PaymentMetrics {
  totalCollected: number;
  paymentCount: number;
  methodCounts: Record<PaymentMethod, number>;
}

export interface RecordPaymentInput {
  payment: Omit<Payment, 'id' | 'createdAt'> & { id?: string };
  currentInvoice: {
    id: string;
    invoiceNumber: string;
    grandTotal: number;
    amountPaid: number;
    amountDue: number;
    status: any;
    customerId: string;
    customerName: string;
    dueDate?: string;
  };
  customLogMessage?: string;
}

export interface UsePaymentsReturn {
  payments: Payment[];
  rawPayments: Payment[];
  loading: boolean;
  error: Error | null;

  // Search & Filters
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  methodFilter: PaymentMethodFilter;
  setMethodFilter: (method: PaymentMethodFilter) => void;
  customerFilter: string;
  setCustomerFilter: (customerId: string) => void;
  invoiceFilter: string;
  setInvoiceFilter: (invoiceId: string) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  clearFilters: () => void;

  // Sorting
  sortBy: PaymentSortBy;
  setSortBy: (sort: PaymentSortBy) => void;
  sortOrder: SortOrder;
  setSortOrder: (order: SortOrder) => void;
  toggleSortOrder: () => void;

  // Actions
  recordPayment: (input: RecordPaymentInput) => Promise<RecordPaymentAtomicResult>;
  getPaymentsForInvoice: (invoiceId: string) => Payment[];
  getPaymentsForCustomer: (customerId: string) => Payment[];
  getNextPaymentNumber: () => string;

  // Aggregates
  metrics: PaymentMetrics;
}

const SNAPSHOT_SOURCE_ID = 'payments';
const LOCAL_PAYMENTS_CACHE_PREFIX = 'meezan_local_payments_';

export function usePayments(firestore: Firestore = db): UsePaymentsReturn {
  const { currentAccount } = useAuth();
  const accountId = currentAccount?.id || 'default';
  const cacheKey = `${LOCAL_PAYMENTS_CACHE_PREFIX}${accountId}`;

  const [rawPayments, setRawPayments] = useState<Payment[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const cached = localStorage.getItem(cacheKey);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Search, filter, and sort state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [methodFilter, setMethodFilter] = useState<PaymentMethodFilter>('ALL');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
  const [invoiceFilter, setInvoiceFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortBy, setSortBy] = useState<PaymentSortBy>('paymentDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const persistCache = useCallback((items: Payment[]) => {
    if (typeof window === 'undefined') return;
    try {
      writeAccountCache(cacheKey, items);
    } catch {
      // Ignore quota errors
    }
  }, [cacheKey]);

  // Reactive subscription against Firestore IndexedDB local cache
  useEffect(() => {
    setLoading(true);
    setRawPayments(readAccountCache<Payment>(cacheKey));
    const unsubscribeCache = subscribeAccountCache(cacheKey, () => {
      setRawPayments(readAccountCache<Payment>(cacheKey));
    });

    // Initial load from localStorage
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setRawPayments(JSON.parse(cached));
      }
    } catch {
      // Ignore
    }

    const paymentsCol = getAccountCollection<Payment>(firestore, 'payments', accountId);
    const q = query(paymentsCol);

    const unsubscribe = onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot) => {
        trackSnapshotPendingWrites(SNAPSHOT_SOURCE_ID, snapshot);

        const loaded: Payment[] = [];
        snapshot.forEach((docSnap) => {
          loaded.push({
            id: docSnap.id,
            ...(docSnap.data() as Omit<Payment, 'id'>)
          });
        });

        setRawPayments((prev) => {
          if (loaded.length > 0) {
            persistCache(loaded);
            return loaded;
          }
          if (prev.length > 0) {
            return prev;
          }
          persistCache(loaded);
          return loaded;
        });

        setLoading(false);
        setError(null);
      },
      (err) => {
        console.warn('[usePayments] Snapshot listener warning (using local cache):', err);
        setLoading(false);
      }
    );

    return () => {
      unsubscribeCache();
      unsubscribe();
      unregisterPendingSource(SNAPSHOT_SOURCE_ID);
    };
  }, [firestore, accountId, cacheKey, persistCache]);

  // Aggregate metrics computed from raw dataset
  const metrics: PaymentMetrics = useMemo(() => {
    let totalCollected = 0;
    const methodCounts: Record<PaymentMethod, number> = {
      CASH: 0,
      BANK_TRANSFER: 0,
      CREDIT_CARD: 0,
      CHECK: 0,
      ONLINE_GATEWAY: 0,
      OTHER: 0
    };

    for (const p of rawPayments) {
      const amt = Number(p.amount) || 0;
      totalCollected += amt;
      if (p.paymentMethod && methodCounts[p.paymentMethod] !== undefined) {
        methodCounts[p.paymentMethod]++;
      } else {
        methodCounts.OTHER++;
      }
    }

    return {
      totalCollected: Number(totalCollected.toFixed(2)),
      paymentCount: rawPayments.length,
      methodCounts
    };
  }, [rawPayments]);

  // Filter and sort payments client-side
  const filteredPayments = useMemo(() => {
    const normalizedQuery = normalizeSearchText(searchQuery);

    return rawPayments
      .filter((p) => {
        // 1. Method filter
        if (methodFilter !== 'ALL' && p.paymentMethod !== methodFilter) {
          return false;
        }

        // 2. Customer filter
        if (customerFilter !== 'ALL' && p.customerId !== customerFilter) {
          return false;
        }

        // 3. Invoice filter
        if (invoiceFilter !== 'ALL' && p.invoiceId !== invoiceFilter) {
          return false;
        }

        // 4. Date range filter
        if (startDate && p.paymentDate < startDate) {
          return false;
        }
        if (endDate && p.paymentDate > endDate) {
          return false;
        }

        // 5. Search query filter
        if (!normalizedQuery) return true;

        const numMatch = normalizeSearchText(p.paymentNumber || '').includes(normalizedQuery);
        const invMatch = normalizeSearchText(p.invoiceNumber || '').includes(normalizedQuery);
        const custMatch = normalizeSearchText(p.customerName || '').includes(normalizedQuery);
        const refMatch = normalizeSearchText(p.referenceNumber || '').includes(normalizedQuery);
        const notesMatch = normalizeSearchText(p.notes || '').includes(normalizedQuery);

        return numMatch || invMatch || custMatch || refMatch || notesMatch;
      })
      .sort((a, b) => {
        let cmp = 0;
        switch (sortBy) {
          case 'paymentDate':
            cmp = (a.paymentDate || '').localeCompare(b.paymentDate || '');
            break;
          case 'amount':
            cmp = (Number(a.amount) || 0) - (Number(b.amount) || 0);
            break;
          case 'paymentNumber':
            cmp = (a.paymentNumber || '').localeCompare(b.paymentNumber || '', undefined, {
              numeric: true,
              sensitivity: 'base'
            });
            break;
          default:
            cmp = 0;
        }

        return sortOrder === 'asc' ? cmp : -cmp;
      });
  }, [rawPayments, searchQuery, methodFilter, customerFilter, invoiceFilter, startDate, endDate, sortBy, sortOrder]);

  const toggleSortOrder = useCallback(() => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setMethodFilter('ALL');
    setCustomerFilter('ALL');
    setInvoiceFilter('ALL');
    setStartDate('');
    setEndDate('');
  }, []);

  const getPaymentsForInvoice = useCallback(
    (invoiceId: string): Payment[] => {
      return rawPayments.filter((p) => p.invoiceId === invoiceId);
    },
    [rawPayments]
  );

  const getPaymentsForCustomer = useCallback(
    (customerId: string): Payment[] => {
      return rawPayments.filter((p) => p.customerId === customerId);
    },
    [rawPayments]
  );

  const getNextPaymentNumber = useCallback((): string => {
    const year = new Date().getFullYear();
    const prefix = `PAY-${year}-`;
    const matchingNumbers = rawPayments
      .map((p) => p.paymentNumber)
      .filter((num) => num && num.startsWith(prefix))
      .map((num) => parseInt(num.replace(prefix, ''), 10))
      .filter((n) => !isNaN(n));

    const nextSeq = matchingNumbers.length > 0 ? Math.max(...matchingNumbers) + 1 : 1;
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }, [rawPayments]);

  const recordPayment = useCallback(
    async (input: RecordPaymentInput): Promise<RecordPaymentAtomicResult> => {
      const params: RecordPaymentAtomicParams = {
        payment: input.payment,
        currentInvoice: input.currentInvoice,
        customLogMessage: input.customLogMessage
      };

      const result = await trackPendingPromise(recordPaymentAtomic(params, firestore));
      const invoice = getCachedInvoices(accountId).find(item => item.id === input.currentInvoice.id);
      if (invoice) {
        upsertCachedInvoice({
          ...invoice,
          amountPaid: result.newAmountPaid,
          amountDue: result.newAmountDue,
          status: result.newInvoiceStatus,
          updatedAt: new Date().toISOString(),
          syncStatus: 'pending'
        }, accountId);
      }

      // Optimistically add to state and local cache
      const newPayment: Payment = {
        ...input.payment,
        id: result.paymentId,
        createdAt: new Date().toISOString()
      };
      setRawPayments((prev) => {
        const next = [newPayment, ...prev.filter((p) => p.id !== result.paymentId)];
        persistCache(next);
        return next;
      });

      return result;
    },
    [firestore, persistCache, accountId]
  );

  return {
    payments: filteredPayments,
    rawPayments,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    methodFilter,
    setMethodFilter,
    customerFilter,
    setCustomerFilter,
    invoiceFilter,
    setInvoiceFilter,
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
    recordPayment,
    getPaymentsForInvoice,
    getPaymentsForCustomer,
    getNextPaymentNumber,
    metrics
  };
}
