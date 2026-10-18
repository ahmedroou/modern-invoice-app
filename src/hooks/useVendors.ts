/**
 * Vendor Management Hook (Offline-First)
 * 
 * Target: src/hooks/useVendors.ts
 * Manages suppliers, contractors, individuals, and utility accounts.
 * Provides instant local cache, reactive real-time updates, and atomic mutations.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { onSnapshot, query, writeBatch } from 'firebase/firestore';
import { db, getAccountCollection, getAccountDoc } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import type { Vendor } from '@/types/domain';
import { normalizeSearchText } from '@/hooks/useCustomers';

const LOCAL_VENDORS_CACHE_PREFIX = 'meezan_local_vendors_';

export interface VendorMetrics {
  totalCount: number;
  activeCount: number;
  totalOutstanding: number;
  totalBilled: number;
  totalPaid: number;
}

export interface UseVendorsReturn {
  vendors: Vendor[];
  rawVendors: Vendor[];
  loading: boolean;
  error: Error | null;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Actions
  createVendor: (data: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt' | 'totalBilled' | 'totalPaid' | 'outstandingBalance'>) => Promise<Vendor>;
  updateVendor: (id: string, updates: Partial<Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  deleteVendor: (id: string) => Promise<void>;
  getVendorById: (id: string) => Vendor | undefined;

  metrics: VendorMetrics;
}

export function useVendors(): UseVendorsReturn {
  const { currentAccount } = useAuth();
  const accountId = currentAccount?.id || 'default';
  const cacheKey = `${LOCAL_VENDORS_CACHE_PREFIX}${accountId}`;

  const [rawVendors, setRawVendors] = useState<Vendor[]>(() => {
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
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Save to local cache on change
  const persistCache = useCallback((items: Vendor[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(cacheKey, JSON.stringify(items));
    } catch {
      // Ignore quota errors
    }
  }, [cacheKey]);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Initial load from localStorage
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setRawVendors(JSON.parse(cached));
      }
    } catch {
      // Ignore
    }

    try {
      const colRef = getAccountCollection(db, 'vendors', accountId);
      const q = query(colRef);

      const unsubscribe = onSnapshot(
        q,
        { includeMetadataChanges: true },
        (snapshot) => {
          const list: Vendor[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            list.push({
              id: docSnap.id,
              ...data
            } as Vendor);
          });

          // Sort by creation date descending
          list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

          setRawVendors((prev) => {
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
          console.warn('[useVendors] Firestore subscription warning (using local cache):', err);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.warn('[useVendors] Failed to subscribe, using local fallback:', err);
      setLoading(false);
    }
  }, [accountId, cacheKey, persistCache]);

  // Client-side search & filtering
  const vendors = useMemo(() => {
    if (!searchQuery.trim()) return rawVendors;
    const queryNorm = normalizeSearchText(searchQuery);

    return rawVendors.filter((v) => {
      const nameNorm = normalizeSearchText(v.name);
      const companyNorm = normalizeSearchText(v.company || '');
      const phoneNorm = (v.phone || '').replace(/\s+/g, '');
      const catNorm = normalizeSearchText(v.category || '');

      return (
        nameNorm.includes(queryNorm) ||
        companyNorm.includes(queryNorm) ||
        phoneNorm.includes(queryNorm.replace(/\s+/g, '')) ||
        catNorm.includes(queryNorm)
      );
    });
  }, [rawVendors, searchQuery]);

  // Metrics
  const metrics = useMemo<VendorMetrics>(() => {
    let totalOutstanding = 0;
    let totalBilled = 0;
    let totalPaid = 0;
    let activeCount = 0;

    for (const v of rawVendors) {
      if (v.status !== 'ARCHIVED') activeCount++;
      totalOutstanding += v.outstandingBalance || 0;
      totalBilled += v.totalBilled || 0;
      totalPaid += v.totalPaid || 0;
    }

    return {
      totalCount: rawVendors.length,
      activeCount,
      totalOutstanding,
      totalBilled,
      totalPaid
    };
  }, [rawVendors]);

  const getVendorById = useCallback(
    (id: string) => rawVendors.find((v) => v.id === id),
    [rawVendors]
  );

  const createVendor = useCallback(
    async (
      data: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt' | 'totalBilled' | 'totalPaid' | 'outstandingBalance'>
    ): Promise<Vendor> => {
      const now = new Date().toISOString();
      const newId = `vnd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const newVendor: Vendor = {
        ...data,
        id: newId,
        currency: data.currency || 'SAR',
        totalBilled: 0,
        totalPaid: 0,
        outstandingBalance: 0,
        status: data.status || 'ACTIVE',
        createdAt: now,
        updatedAt: now
      };

      // Optimistic state update
      setRawVendors((prev) => {
        const next = [newVendor, ...prev];
        persistCache(next);
        return next;
      });

      // Commit to Firestore batch
      try {
        const batch = writeBatch(db);
        const docRef = getAccountDoc(db, 'vendors', newId, accountId);
        batch.set(docRef, newVendor);
        await Promise.race([
          batch.commit(),
          new Promise((resolve) => setTimeout(resolve, 150))
        ]);
      } catch (err) {
        console.warn('[useVendors] Firestore commit warning (stored locally):', err);
      }

      return newVendor;
    },
    [accountId, persistCache]
  );

  const updateVendor = useCallback(
    async (id: string, updates: Partial<Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'>>) => {
      const now = new Date().toISOString();

      setRawVendors((prev) => {
        const next = prev.map((v) => (v.id === id ? { ...v, ...updates, updatedAt: now } : v));
        persistCache(next);
        return next;
      });

      try {
        const batch = writeBatch(db);
        const docRef = getAccountDoc(db, 'vendors', id, accountId);
        batch.update(docRef, { ...updates, updatedAt: now });
        await Promise.race([
          batch.commit(),
          new Promise((resolve) => setTimeout(resolve, 150))
        ]);
      } catch (err) {
        console.warn('[useVendors] Update commit warning (stored locally):', err);
      }
    },
    [accountId, persistCache]
  );

  const deleteVendor = useCallback(
    async (id: string) => {
      setRawVendors((prev) => {
        const next = prev.filter((v) => v.id !== id);
        persistCache(next);
        return next;
      });

      try {
        const batch = writeBatch(db);
        const docRef = getAccountDoc(db, 'vendors', id, accountId);
        batch.delete(docRef);
        await Promise.race([
          batch.commit(),
          new Promise((resolve) => setTimeout(resolve, 150))
        ]);
      } catch (err) {
        console.warn('[useVendors] Delete commit warning (stored locally):', err);
      }
    },
    [accountId, persistCache]
  );

  return {
    vendors,
    rawVendors,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    createVendor,
    updateVendor,
    deleteVendor,
    getVendorById,
    metrics
  };
}
