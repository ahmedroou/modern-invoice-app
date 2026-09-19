/**
 * Customer State Management Hook
 * 
 * Subscribes to Firestore customers collection with offline IndexedDB caching,
 * instant local updates via includeMetadataChanges: true, client-side search/sort,
 * and optimistic atomic CRUD operations.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { onSnapshot, query, Firestore } from 'firebase/firestore';
import { db, getAccountCollection } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import type { Customer } from '@/types/domain';
import {
  trackSnapshotPendingWrites,
  unregisterPendingSource,
  trackPendingPromise
} from '@/hooks/useSyncStatus';
import {
  createCustomerAtomic,
  updateCustomerAtomic,
  archiveCustomerAtomic,
  deleteCustomerAtomic,
  type CreateCustomerAtomicParams,
  type CustomerUpdateInput
} from '@/lib/atomicMutations';

export type CustomerStatusFilter = 'ALL' | 'ACTIVE' | 'ARCHIVED';
export type CustomerBalanceFilter = 'ALL' | 'WITH_BALANCE' | 'ZERO_BALANCE';
export type CustomerSortBy = 'name' | 'outstandingAmount' | 'totalInvoiced' | 'createdAt';
export type SortOrder = 'asc' | 'desc';

export interface CustomerMetrics {
  totalCount: number;
  activeCount: number;
  archivedCount: number;
  totalOutstanding: number;
  withDebtCount: number;
}

export interface UseCustomersReturn {
  // Data
  customers: Customer[];
  rawCustomers: Customer[];
  loading: boolean;
  error: Error | null;
  
  // Search & Filters
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: CustomerStatusFilter;
  setStatusFilter: (status: CustomerStatusFilter) => void;
  balanceFilter: CustomerBalanceFilter;
  setBalanceFilter: (balance: CustomerBalanceFilter) => void;
  
  // Sorting
  sortBy: CustomerSortBy;
  setSortBy: (sort: CustomerSortBy) => void;
  sortOrder: SortOrder;
  setSortOrder: (order: SortOrder) => void;
  toggleSortOrder: () => void;
  
  // CRUD Actions
  createCustomer: (data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'outstandingAmount' | 'totalInvoiced' | 'totalPaid'>) => Promise<Customer>;
  updateCustomer: (id: string, updates: CustomerUpdateInput) => Promise<void>;
  archiveCustomer: (id: string) => Promise<void>;
  restoreCustomer: (id: string) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  getCustomerById: (id: string) => Customer | undefined;
  
  // Aggregates
  metrics: CustomerMetrics;
}

/**
 * Normalizes text for insensitive searching in both Arabic and English.
 * Strips Arabic diacritics (harakat/tashkeel), normalizes Alef forms (أ/إ/آ -> ا),
 * Teh Marbuta (ة -> ه), and Alef Maksura (ى -> ي).
 */
export function normalizeSearchText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove Arabic diacritics
    .replace(/\u0640/g, '')                 // remove Arabic Tatweel / Kashida (ـ)
    .replace(/[أإآءئؤ]/g, 'ا')            // normalize Arabic Hamza & Alef variants
    .replace(/ة/g, 'ه')                    // normalize Teh Marbuta
    .replace(/ى/g, 'ي')                    // normalize Alef Maksura
    .trim();
}

/**
 * Evaluates whether a customer record matches a search query across
 * name, phone, email, and tax ID, tolerating whitespace formatting in phone and tax numbers.
 */
export function customerMatchesSearch(c: Customer, searchQuery: string): boolean {
  const normalizedQuery = normalizeSearchText(searchQuery);
  if (!normalizedQuery) return true;

  const queryCompact = normalizedQuery.replace(/\s+/g, '');
  const normalizedName = normalizeSearchText(c.name || '');
  const phone = (c.phone || '').replace(/\s+/g, '');
  const email = (c.email || '').toLowerCase();
  const taxNumber = (c.taxNumber || '').replace(/\s+/g, '');

  const nameMatch = normalizedName.includes(normalizedQuery);
  const phoneMatch = Boolean(phone && queryCompact && phone.includes(queryCompact));
  const emailMatch = Boolean(email && email.includes(normalizedQuery));
  const taxMatch = Boolean(taxNumber && queryCompact && taxNumber.includes(queryCompact));

  return nameMatch || phoneMatch || emailMatch || taxMatch;
}

const SNAPSHOT_SOURCE_ID = 'customers';

export function useCustomers(firestore: Firestore = db): UseCustomersReturn {
  const { currentAccount } = useAuth();
  const accountId = currentAccount?.id;

  const [rawCustomers, setRawCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Search, filter, and sort state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<CustomerStatusFilter>('ACTIVE');
  const [balanceFilter, setBalanceFilter] = useState<CustomerBalanceFilter>('ALL');
  const [sortBy, setSortBy] = useState<CustomerSortBy>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Reactive subscription against Firestore IndexedDB local cache
  useEffect(() => {
    setLoading(true);
    const customersCol = getAccountCollection<Customer>(firestore, 'customers', accountId);
    const q = query(customersCol);

    const unsubscribe = onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot) => {
        // Report pending writes to global sync registry
        trackSnapshotPendingWrites(SNAPSHOT_SOURCE_ID, snapshot);

        const loaded: Customer[] = [];
        snapshot.forEach((docSnap) => {
          loaded.push({
            id: docSnap.id,
            ...(docSnap.data() as Omit<Customer, 'id'>)
          });
        });

        setRawCustomers(loaded);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[useCustomers] Snapshot listener error:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
      unregisterPendingSource(SNAPSHOT_SOURCE_ID);
    };
  }, [firestore, accountId]);

  // Aggregate metrics computed from raw dataset
  const metrics: CustomerMetrics = useMemo(() => {
    let totalOutstanding = 0;
    let withDebtCount = 0;
    let activeCount = 0;
    let archivedCount = 0;

    for (const c of rawCustomers) {
      if (c.status === 'ARCHIVED') {
        archivedCount++;
      } else {
        activeCount++;
      }

      const balance = Number(c.outstandingAmount) || 0;
      if (balance > 0) {
        totalOutstanding += balance;
        withDebtCount++;
      }
    }

    return {
      totalCount: rawCustomers.length,
      activeCount,
      archivedCount,
      totalOutstanding: Number(totalOutstanding.toFixed(2)),
      withDebtCount
    };
  }, [rawCustomers]);

  // Filter and sort raw customers client-side for 0ms responsiveness
  const filteredCustomers = useMemo(() => {
    const normalizedQuery = normalizeSearchText(searchQuery);
    const queryCompact = normalizedQuery.replace(/\s+/g, '');

    return rawCustomers
      .filter((c) => {
        // 1. Status Filter
        if (statusFilter !== 'ALL') {
          const currentStatus = c.status || 'ACTIVE';
          if (currentStatus !== statusFilter) return false;
        }

        // 2. Balance Filter
        const balance = Number(c.outstandingAmount) || 0;
        if (balanceFilter === 'WITH_BALANCE' && balance <= 0) return false;
        if (balanceFilter === 'ZERO_BALANCE' && balance > 0) return false;

        // 3. Search Query Filter
        if (!normalizedQuery) return true;

        const normalizedName = normalizeSearchText(c.name || '');
        const phone = (c.phone || '').replace(/\s+/g, '');
        const email = (c.email || '').toLowerCase();
        const taxNumber = (c.taxNumber || '').replace(/\s+/g, '');

        const nameMatch = normalizedName.includes(normalizedQuery);
        const phoneMatch = Boolean(phone && queryCompact && phone.includes(queryCompact));
        const emailMatch = Boolean(email && email.includes(normalizedQuery));
        const taxMatch = Boolean(taxNumber && queryCompact && taxNumber.includes(queryCompact));

        return nameMatch || phoneMatch || emailMatch || taxMatch;
      })
      .sort((a, b) => {
        let cmp = 0;
        switch (sortBy) {
          case 'name':
            cmp = (a.name || '').localeCompare(b.name || '', undefined, {
              sensitivity: 'base',
              numeric: true
            });
            break;
          case 'outstandingAmount':
            cmp = (Number(a.outstandingAmount) || 0) - (Number(b.outstandingAmount) || 0);
            break;
          case 'totalInvoiced':
            cmp = (Number(a.totalInvoiced) || 0) - (Number(b.totalInvoiced) || 0);
            break;
          case 'createdAt':
            cmp = (a.createdAt || '').localeCompare(b.createdAt || '');
            break;
          default:
            cmp = 0;
        }

        return sortOrder === 'asc' ? cmp : -cmp;
      });
  }, [rawCustomers, searchQuery, statusFilter, balanceFilter, sortBy, sortOrder]);

  const toggleSortOrder = useCallback(() => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  }, []);

  // CRUD Implementations wrapped with trackPendingPromise
  const createCustomer = useCallback(
    async (
      data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'outstandingAmount' | 'totalInvoiced' | 'totalPaid'>
    ): Promise<Customer> => {
      const trimmedName = data.name ? data.name.trim() : '';
      if (!trimmedName) {
        throw new Error('Customer name is required.');
      }

      const customerObj: any = {
        name: trimmedName,
        currency: data.currency || 'SAR',
        status: data.status || 'ACTIVE'
      };
      if (data.email?.trim()) customerObj.email = data.email.trim();
      if (data.phone?.trim()) customerObj.phone = data.phone.trim();
      if (data.address?.trim()) customerObj.address = data.address.trim();
      if (data.taxNumber?.trim()) customerObj.taxNumber = data.taxNumber.trim();
      if (data.notes?.trim()) customerObj.notes = data.notes.trim();

      const params: CreateCustomerAtomicParams = {
        customer: customerObj
      };

      const result = await trackPendingPromise(createCustomerAtomic(params, firestore));
      return result.customer;
    },
    [firestore]
  );

  const updateCustomer = useCallback(
    async (id: string, updates: CustomerUpdateInput): Promise<void> => {
      if (!id) throw new Error('Customer ID is required for update.');
      await trackPendingPromise(
        updateCustomerAtomic(
          {
            customerId: id,
            updates
          },
          firestore
        )
      );
    },
    [firestore]
  );

  const archiveCustomer = useCallback(
    async (id: string): Promise<void> => {
      const existing = rawCustomers.find((c) => c.id === id);
      await trackPendingPromise(
        archiveCustomerAtomic(
          {
            customerId: id,
            customerName: existing?.name
          },
          firestore
        )
      );
    },
    [firestore, rawCustomers]
  );

  const restoreCustomer = useCallback(
    async (id: string): Promise<void> => {
      await updateCustomer(id, { status: 'ACTIVE' });
    },
    [updateCustomer]
  );

  const deleteCustomer = useCallback(
    async (id: string): Promise<void> => {
      const existing = rawCustomers.find((c) => c.id === id);
      if (!existing) throw new Error('Customer not found.');

      await trackPendingPromise(
        deleteCustomerAtomic(
          {
            customerId: id,
            customerName: existing.name,
            totalInvoiced: existing.totalInvoiced || 0,
            totalPaid: existing.totalPaid || 0,
            outstandingAmount: existing.outstandingAmount || 0
          },
          firestore
        )
      );
    },
    [firestore, rawCustomers]
  );

  const getCustomerById = useCallback(
    (id: string): Customer | undefined => {
      return rawCustomers.find((c) => c.id === id);
    },
    [rawCustomers]
  );

  return {
    customers: filteredCustomers,
    rawCustomers,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    balanceFilter,
    setBalanceFilter,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    toggleSortOrder,
    createCustomer,
    updateCustomer,
    archiveCustomer,
    restoreCustomer,
    deleteCustomer,
    getCustomerById,
    metrics
  };
}
