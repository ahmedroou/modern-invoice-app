/**
 * Expense Outgoing Payments & Vouchers Hook (سندات الصرف)
 * 
 * Target: src/hooks/useExpensePayments.ts
 * Manages outgoing payment vouchers to vendors and service providers.
 * Decrements bill due amounts and vendor outstanding balances atomically.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { onSnapshot, query, writeBatch, increment } from 'firebase/firestore';
import { db, getAccountCollection, getAccountDoc } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import type { ExpensePayment, ExpenseBill, PaymentMethod, ExpenseBillStatus } from '@/types/domain';
import { normalizeSearchText } from '@/hooks/useCustomers';

const LOCAL_EXPENSE_PAYMENTS_CACHE_PREFIX = 'meezan_local_expense_payments_';

export interface ExpensePaymentInput {
  billId?: string;
  billNumber?: string;
  vendorId: string;
  vendorName: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  notes?: string;
}

export interface UseExpensePaymentsReturn {
  payments: ExpensePayment[];
  rawPayments: ExpensePayment[];
  loading: boolean;
  error: Error | null;

  searchQuery: string;
  setSearchQuery: (query: string) => void;

  recordPayment: (input: ExpensePaymentInput, currentBill?: ExpenseBill) => Promise<ExpensePayment>;
  deletePayment: (paymentId: string) => Promise<void>;

  totalPaidAmount: number;
}

export function useExpensePayments(): UseExpensePaymentsReturn {
  const { currentAccount } = useAuth();
  const accountId = currentAccount?.id || 'default';
  const cacheKey = `${LOCAL_EXPENSE_PAYMENTS_CACHE_PREFIX}${accountId}`;

  const [rawPayments, setRawPayments] = useState<ExpensePayment[]>(() => {
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

  const persistCache = useCallback((items: ExpensePayment[]) => {
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
        setRawPayments(JSON.parse(cached));
      }
    } catch {
      // Ignore
    }

    try {
      const colRef = getAccountCollection(db, 'expense_payments', accountId);
      const q = query(colRef);

      const unsubscribe = onSnapshot(
        q,
        { includeMetadataChanges: true },
        (snapshot) => {
          const list: ExpensePayment[] = [];
          snapshot.forEach((docSnap) => {
            list.push({
              id: docSnap.id,
              ...docSnap.data()
            } as ExpensePayment);
          });

          // Sort descending by payment date
          list.sort((a, b) => new Date(b.paymentDate || b.createdAt || 0).getTime() - new Date(a.paymentDate || a.createdAt || 0).getTime());

          setRawPayments((prev) => {
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
          console.warn('[useExpensePayments] Subscription warning:', err);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.warn('[useExpensePayments] Failed to subscribe:', err);
      setLoading(false);
    }
  }, [accountId, cacheKey, persistCache]);

  const payments = useMemo(() => {
    if (!searchQuery.trim()) return rawPayments;
    const qNorm = normalizeSearchText(searchQuery);

    return rawPayments.filter((p) => {
      const vNorm = normalizeSearchText(p.vendorName);
      const voucherNorm = normalizeSearchText(p.voucherNumber);
      const billNorm = normalizeSearchText(p.billNumber || '');
      const refNorm = normalizeSearchText(p.referenceNumber || '');

      return (
        vNorm.includes(qNorm) ||
        voucherNorm.includes(qNorm) ||
        billNorm.includes(qNorm) ||
        refNorm.includes(qNorm)
      );
    });
  }, [rawPayments, searchQuery]);

  const totalPaidAmount = useMemo(() => {
    return rawPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [rawPayments]);

  const recordPayment = useCallback(
    async (input: ExpensePaymentInput, currentBill?: ExpenseBill): Promise<ExpensePayment> => {
      const now = new Date().toISOString();
      const newId = `exp_pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const voucherNumber = `VOUCH-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;

      const newPayment: ExpensePayment = {
        id: newId,
        voucherNumber,
        billId: input.billId,
        billNumber: input.billNumber,
        vendorId: input.vendorId,
        vendorName: input.vendorName,
        amount: input.amount,
        paymentDate: input.paymentDate || now.split('T')[0],
        paymentMethod: input.paymentMethod || 'CASH',
        referenceNumber: input.referenceNumber,
        notes: input.notes,
        createdAt: now
      };

      // Optimistic state update
      setRawPayments((prev) => {
        const next = [newPayment, ...prev];
        persistCache(next);
        return next;
      });

      try {
        const batch = writeBatch(db);
        const paymentRef = getAccountDoc(db, 'expense_payments', newId, accountId);
        batch.set(paymentRef, newPayment);

        // Update vendor balance
        if (input.vendorId) {
          const vendorRef = getAccountDoc(db, 'vendors', input.vendorId, accountId);
          batch.update(vendorRef, {
            totalPaid: increment(input.amount),
            outstandingBalance: increment(-input.amount),
            updatedAt: now
          });
        }

        // Update Bill if linked
        if (input.billId && currentBill) {
          const billRef = getAccountDoc(db, 'expense_bills', input.billId, accountId);
          const newAmountPaid = (currentBill.amountPaid || 0) + input.amount;
          const newAmountDue = Math.max(0, currentBill.grandTotal - newAmountPaid);
          const newStatus: ExpenseBillStatus = newAmountDue <= 0 ? 'PAID' : 'PARTIALLY_PAID';

          batch.update(billRef, {
            amountPaid: newAmountPaid,
            amountDue: newAmountDue,
            status: newStatus,
            updatedAt: now
          });
        }

        await Promise.race([
          batch.commit(),
          new Promise((resolve) => setTimeout(resolve, 150))
        ]);
      } catch (err) {
        console.warn('[useExpensePayments] Commit warning (stored locally):', err);
      }

      return newPayment;
    },
    [accountId, persistCache]
  );

  const deletePayment = useCallback(
    async (paymentId: string) => {
      setRawPayments((prev) => {
        const next = prev.filter((p) => p.id !== paymentId);
        persistCache(next);
        return next;
      });

      try {
        const batch = writeBatch(db);
        const pRef = getAccountDoc(db, 'expense_payments', paymentId, accountId);
        batch.delete(pRef);
        await Promise.race([
          batch.commit(),
          new Promise((resolve) => setTimeout(resolve, 150))
        ]);
      } catch (err) {
        console.warn('[useExpensePayments] Delete commit warning:', err);
      }
    },
    [accountId, persistCache]
  );

  return {
    payments,
    rawPayments,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    recordPayment,
    deletePayment,
    totalPaidAmount
  };
}
