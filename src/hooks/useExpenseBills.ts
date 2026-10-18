/**
 * Expense Bills Management Hook (Offline-First)
 * 
 * Target: src/hooks/useExpenseBills.ts
 * Manages accounts payable, purchase bills, recurring expenses, and dues.
 * Updates vendor balances atomically and supports offline cache and instant UI feedback.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { onSnapshot, query, writeBatch, increment } from 'firebase/firestore';
import { db, getAccountCollection, getAccountDoc } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import type { ExpenseBill, ExpenseBillStatus, ExpenseCategory } from '@/types/domain';
import { normalizeSearchText } from '@/hooks/useCustomers';

const LOCAL_BILLS_CACHE_PREFIX = 'meezan_local_expense_bills_';

export type BillStatusFilter = 'ALL' | ExpenseBillStatus;
export type BillCategoryFilter = 'ALL' | ExpenseCategory;

export interface ExpenseBillsMetrics {
  totalCount: number;
  unpaidCount: number;
  partiallyPaidCount: number;
  paidCount: number;
  overdueCount: number;
  totalPayables: number; // What we owe to vendors
  totalPaid: number;
  totalBilled: number;
}

export interface UseExpenseBillsReturn {
  bills: ExpenseBill[];
  rawBills: ExpenseBill[];
  loading: boolean;
  error: Error | null;

  // Filters & Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: BillStatusFilter;
  setStatusFilter: (status: BillStatusFilter) => void;
  categoryFilter: BillCategoryFilter;
  setCategoryFilter: (cat: BillCategoryFilter) => void;
  vendorFilter: string;
  setVendorFilter: (vendorId: string) => void;
  clearFilters: () => void;

  // Actions
  createBill: (data: Omit<ExpenseBill, 'id' | 'createdAt' | 'updatedAt' | 'amountPaid' | 'amountDue' | 'status'> & {
    amountPaid?: number;
    status?: ExpenseBillStatus;
  }) => Promise<ExpenseBill>;
  updateBill: (id: string, updates: Partial<ExpenseBill>) => Promise<void>;
  deleteBill: (id: string) => Promise<void>;
  getBillById: (id: string) => ExpenseBill | undefined;

  metrics: ExpenseBillsMetrics;
}

export function useExpenseBills(): UseExpenseBillsReturn {
  const { currentAccount } = useAuth();
  const accountId = currentAccount?.id || 'default';
  const cacheKey = `${LOCAL_BILLS_CACHE_PREFIX}${accountId}`;

  const [rawBills, setRawBills] = useState<ExpenseBill[]>(() => {
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

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<BillStatusFilter>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<BillCategoryFilter>('ALL');
  const [vendorFilter, setVendorFilter] = useState<string>('ALL');

  const persistCache = useCallback((items: ExpenseBill[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(cacheKey, JSON.stringify(items));
    } catch {
      // Ignore
    }
  }, [cacheKey]);

  useEffect(() => {
    setLoading(true);
    setError(null);

    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setRawBills(JSON.parse(cached));
      }
    } catch {
      // Ignore
    }

    try {
      const colRef = getAccountCollection(db, 'expense_bills', accountId);
      const q = query(colRef);

      const unsubscribe = onSnapshot(
        q,
        { includeMetadataChanges: true },
        (snapshot) => {
          const list: ExpenseBill[] = [];
          snapshot.forEach((docSnap) => {
            list.push({
              id: docSnap.id,
              ...docSnap.data()
            } as ExpenseBill);
          });

          // Sort descending by issue date
          list.sort((a, b) => new Date(b.issueDate || b.createdAt || 0).getTime() - new Date(a.issueDate || a.createdAt || 0).getTime());

          setRawBills((prev) => {
            if (list.length > 0) {
              persistCache(list);
              return list;
            }
            if (prev.length > 0) {
              return prev;
            }
            persistCache(list);
            return list;
          });
          setLoading(false);
        },
        (err) => {
          console.warn('[useExpenseBills] Subscription warning:', err);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.warn('[useExpenseBills] Failed to subscribe:', err);
      setLoading(false);
    }
  }, [accountId, cacheKey, persistCache]);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setCategoryFilter('ALL');
    setVendorFilter('ALL');
  }, []);

  // Filtered list
  const bills = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];

    return rawBills.filter((bill) => {
      // Status filter
      if (statusFilter !== 'ALL') {
        const isActuallyOverdue = bill.dueDate < today && bill.status !== 'PAID' && bill.status !== 'CANCELLED';
        if (statusFilter === 'OVERDUE') {
          if (!isActuallyOverdue && bill.status !== 'OVERDUE') return false;
        } else if (bill.status !== statusFilter) {
          return false;
        }
      }

      // Category filter
      if (categoryFilter !== 'ALL' && bill.category !== categoryFilter) {
        return false;
      }

      // Vendor filter
      if (vendorFilter !== 'ALL' && bill.vendorId !== vendorFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const qNorm = normalizeSearchText(searchQuery);
        const billNumNorm = normalizeSearchText(bill.billNumber);
        const vendorNorm = normalizeSearchText(bill.vendorName);
        const notesNorm = normalizeSearchText(bill.notes || '');

        const matches =
          billNumNorm.includes(qNorm) ||
          vendorNorm.includes(qNorm) ||
          notesNorm.includes(qNorm);

        if (!matches) return false;
      }

      return true;
    });
  }, [rawBills, statusFilter, categoryFilter, vendorFilter, searchQuery]);

  // Metrics
  const metrics = useMemo<ExpenseBillsMetrics>(() => {
    const today = new Date().toISOString().split('T')[0];
    let unpaidCount = 0;
    let partiallyPaidCount = 0;
    let paidCount = 0;
    let overdueCount = 0;
    let totalPayables = 0;
    let totalPaid = 0;
    let totalBilled = 0;

    for (const b of rawBills) {
      if (b.status === 'CANCELLED') continue;

      totalBilled += b.grandTotal || 0;
      totalPaid += b.amountPaid || 0;

      const due = b.amountDue ?? (b.grandTotal - (b.amountPaid || 0));
      totalPayables += Math.max(0, due);

      const isOverdue = b.dueDate < today && b.status !== 'PAID';
      if (isOverdue) overdueCount++;

      if (b.status === 'PAID') paidCount++;
      else if (b.status === 'PARTIALLY_PAID') partiallyPaidCount++;
      else unpaidCount++;
    }

    return {
      totalCount: rawBills.length,
      unpaidCount,
      partiallyPaidCount,
      paidCount,
      overdueCount,
      totalPayables,
      totalPaid,
      totalBilled
    };
  }, [rawBills]);

  const getBillById = useCallback(
    (id: string) => rawBills.find((b) => b.id === id),
    [rawBills]
  );

  const createBill = useCallback(
    async (
      data: Omit<ExpenseBill, 'id' | 'createdAt' | 'updatedAt' | 'amountPaid' | 'amountDue' | 'status'> & {
        amountPaid?: number;
        status?: ExpenseBillStatus;
      }
    ): Promise<ExpenseBill> => {
      const now = new Date().toISOString();
      const newId = `bill_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const amountPaid = data.amountPaid || 0;
      const amountDue = Math.max(0, data.grandTotal - amountPaid);

      let status: ExpenseBillStatus = data.status || 'UNPAID';
      if (amountDue === 0) status = 'PAID';
      else if (amountPaid > 0) status = 'PARTIALLY_PAID';

      const newBill: ExpenseBill = {
        ...data,
        id: newId,
        amountPaid,
        amountDue,
        status,
        createdAt: now,
        updatedAt: now
      };

      // Optimistic update
      setRawBills((prev) => {
        const next = [newBill, ...prev];
        persistCache(next);
        return next;
      });

      // Update Firestore + Vendor balance atomically
      try {
        const batch = writeBatch(db);
        const billRef = getAccountDoc(db, 'expense_bills', newId, accountId);
        batch.set(billRef, newBill);

        // Update vendor balances
        if (data.vendorId) {
          const vendorRef = getAccountDoc(db, 'vendors', data.vendorId, accountId);
          batch.update(vendorRef, {
            totalBilled: increment(data.grandTotal),
            totalPaid: increment(amountPaid),
            outstandingBalance: increment(amountDue),
            updatedAt: now
          });
        }

        await Promise.race([
          batch.commit(),
          new Promise((resolve) => setTimeout(resolve, 150))
        ]);
      } catch (err) {
        console.warn('[useExpenseBills] Save commit warning (stored locally):', err);
      }

      return newBill;
    },
    [accountId, persistCache]
  );

  const updateBill = useCallback(
    async (id: string, updates: Partial<ExpenseBill>) => {
      const now = new Date().toISOString();

      setRawBills((prev) => {
        const next = prev.map((b) => (b.id === id ? { ...b, ...updates, updatedAt: now } : b));
        persistCache(next);
        return next;
      });

      try {
        const batch = writeBatch(db);
        const billRef = getAccountDoc(db, 'expense_bills', id, accountId);
        batch.update(billRef, { ...updates, updatedAt: now });
        await Promise.race([
          batch.commit(),
          new Promise((resolve) => setTimeout(resolve, 150))
        ]);
      } catch (err) {
        console.warn('[useExpenseBills] Update commit warning (stored locally):', err);
      }
    },
    [accountId, persistCache]
  );

  const deleteBill = useCallback(
    async (id: string) => {
      const target = rawBills.find((b) => b.id === id);

      setRawBills((prev) => {
        const next = prev.filter((b) => b.id !== id);
        persistCache(next);
        return next;
      });

      try {
        const batch = writeBatch(db);
        const billRef = getAccountDoc(db, 'expense_bills', id, accountId);
        batch.delete(billRef);

        // Revert vendor balances if bill was found
        if (target && target.vendorId) {
          const vendorRef = getAccountDoc(db, 'vendors', target.vendorId, accountId);
          batch.update(vendorRef, {
            totalBilled: increment(-target.grandTotal),
            totalPaid: increment(-target.amountPaid),
            outstandingBalance: increment(-target.amountDue),
            updatedAt: new Date().toISOString()
          });
        }

        await Promise.race([
          batch.commit(),
          new Promise((resolve) => setTimeout(resolve, 150))
        ]);
      } catch (err) {
        console.warn('[useExpenseBills] Delete commit warning (stored locally):', err);
      }
    },
    [rawBills, accountId, persistCache]
  );

  return {
    bills,
    rawBills,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    vendorFilter,
    setVendorFilter,
    clearFilters,
    createBill,
    updateBill,
    deleteBill,
    getBillById,
    metrics
  };
}
