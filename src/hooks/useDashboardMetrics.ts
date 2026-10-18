import { useState, useEffect, useMemo } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { db, getAccountCollection } from '@/lib/firebase';
import { roundFinancial } from '@/lib/calculations';
import { trackSnapshotPendingWrites, unregisterPendingSource } from '@/hooks/useSyncStatus';
import type { Invoice } from '@/types/domain';
import { useAuth } from '@/context/AuthContext';
import { getCachedInvoices, LOCAL_INVOICE_CHANGE_EVENT } from '@/lib/localInvoiceStorage';

export interface DashboardMetrics {
  totalRevenue: number;
  outstandingReceivables: number;
  paidInvoicesCount: number;
  overdueInvoicesCount: number;
  unpaidInvoicesCount: number;
  totalInvoicesCount: number;
  draftInvoicesCount: number;
  totalInvoiced: number;
  collectionRate: number;
  primaryCurrency: string;
  recentInvoices: Invoice[];
  isLoading: boolean;
  error: Error | null;
}

export interface UseDashboardMetricsOptions {
  referenceDate?: string;
  currency?: string;
}

export function useDashboardMetrics(options: UseDashboardMetricsOptions = {}): DashboardMetrics {
  const { currentAccount } = useAuth();
  const accountId = currentAccount?.id;
  const { referenceDate, currency = 'SAR' } = options;
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const sourceId = `dashboard-metrics-invoices-${accountId || 'default'}`;
    setIsLoading(true);
    setInvoices(getCachedInvoices(accountId || 'default'));
    const onLocalChange = () => {
      setInvoices(getCachedInvoices(accountId || 'default'));
    };
    window.addEventListener(LOCAL_INVOICE_CHANGE_EVENT, onLocalChange);

    const unsubscribe = onSnapshot(
      getAccountCollection<Invoice>(db, 'invoices', accountId),
      { includeMetadataChanges: true },
      (snapshot) => {
        trackSnapshotPendingWrites(sourceId, snapshot);
        const docs: Invoice[] = snapshot.docs.map(doc => ({
          ...(doc.data() as Invoice),
          id: doc.id
        }));
        setInvoices(docs);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[useDashboardMetrics] Snapshot error:', err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribe();
      window.removeEventListener(LOCAL_INVOICE_CHANGE_EVENT, onLocalChange);
      unregisterPendingSource(sourceId);
    };
  }, [accountId]);

  const metrics = useMemo<DashboardMetrics>(() => {
    const today = referenceDate || new Date().toISOString().split('T')[0];

    let totalRevenue = 0;
    let outstandingReceivables = 0;
    let totalInvoiced = 0;
    let paidInvoicesCount = 0;
    let overdueInvoicesCount = 0;
    let unpaidInvoicesCount = 0;
    let draftInvoicesCount = 0;
    let activeInvoicesCount = 0;

    for (const inv of invoices) {
      const isCancelled = inv.status === 'CANCELLED';
      const isDraft = inv.status === 'DRAFT';
      const grandTotal = Number(inv.grandTotal) || 0;
      const amountPaid = Number(inv.amountPaid) || 0;
      const amountDue = Number(inv.amountDue) || 0;

      if (isDraft) {
        draftInvoicesCount++;
        continue;
      }

      if (isCancelled) {
        continue;
      }

      activeInvoicesCount++;
      totalInvoiced += grandTotal;
      totalRevenue += amountPaid;

      // Outstanding Receivables
      if (amountDue > 0) {
        outstandingReceivables += amountDue;
        unpaidInvoicesCount++;
      }

      // Paid evaluation
      if (inv.status === 'PAID' || (amountDue <= 0.0001 && grandTotal > 0)) {
        paidInvoicesCount++;
      }

      // Dynamic Overdue evaluation
      const isOverdue =
        inv.status === 'OVERDUE' ||
        (Boolean(inv.dueDate) && inv.dueDate < today && amountDue > 0 && inv.status !== 'PAID');

      if (isOverdue) {
        overdueInvoicesCount++;
      }
    }

    const roundedRevenue = roundFinancial(totalRevenue);
    const roundedReceivables = roundFinancial(outstandingReceivables);
    const roundedInvoiced = roundFinancial(totalInvoiced);
    const collectionRate = roundedInvoiced > 0
      ? roundFinancial((roundedRevenue / roundedInvoiced) * 100, 1)
      : 0;

    // Recent 5 invoices sorted by createdAt or issueDate descending
    const sortedInvoices = [...invoices].sort((a, b) => {
      const dateA = a.createdAt || a.issueDate || '';
      const dateB = b.createdAt || b.issueDate || '';
      return dateB.localeCompare(dateA);
    });

    return {
      totalRevenue: roundedRevenue,
      outstandingReceivables: roundedReceivables,
      paidInvoicesCount,
      overdueInvoicesCount,
      unpaidInvoicesCount,
      totalInvoicesCount: activeInvoicesCount,
      draftInvoicesCount,
      totalInvoiced: roundedInvoiced,
      collectionRate,
      primaryCurrency: currency,
      recentInvoices: sortedInvoices.slice(0, 5),
      isLoading,
      error
    };
  }, [invoices, referenceDate, currency, isLoading, error]);

  return metrics;
}
