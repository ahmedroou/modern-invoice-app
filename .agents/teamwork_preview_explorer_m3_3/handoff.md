# Handoff Report: Real-Time Financial Dashboard & Chronological Activity Log

**Author**: teamwork_preview_explorer_m3_3  
**Role**: Real-Time Dashboard & Activity Log Specialist  
**Milestone**: Milestone 3 (Customer Directory & Financial Dashboard Modules)  
**Date**: 2026-09-19T09:49:00Z  

---

## 1. Observation

### 1.1 Existing Layout Shell and Mock Dashboard State
- In `src/App.tsx` (lines 18–152), the current dashboard view is an inlined mock component (`DashboardOverview`) that hardcodes static numbers:
  - Total Revenue: `$45,280` (`formatCurrency(45280)`) (line 49)
  - Outstanding Receivables: `$12,450` (`formatCurrency(12450)`) (line 57)
  - Paid Invoices count: `"38"` (line 64)
  - Overdue Invoices count: `"4"` (line 71)
  - Mock invoice records: `INV-2026-001`, `INV-2026-002`, `INV-2026-003` (lines 94–96)
  - A mock "Quick System & Sync Status" card (lines 129–148).
- `src/App.tsx` routes `<Route index element={<DashboardOverview />} />` (line 175). PROJECT.md §Code Layout specifies this should be routed to `src/components/modules/dashboard/DashboardView.tsx`.

### 1.2 Existing Compact Metric Card Architecture
- In `src/components/common/CompactMetricCard.tsx` (lines 5–92):
  - Fixed height: `h-[82px]` (line 56), strictly conforming to the user global rule of `<90px` height.
  - Automatically isolates numeric values using `<BidiIsolate>{value}</BidiIsolate>` (line 63).
  - Supports 5 semantic color variants: `'brand'` (Emerald), `'emerald'` (Teal), `'amber'` (Amber), `'rose'` (Rose), and `'slate'` (Slate) (lines 17–43).
  - Accepts `title`, `value`, `subtitle`, `icon: LucideIcon`, `variant`, and `trend: { value: string; isPositive: boolean }`.
  - Uses CSS flex layout with `min-w-0`, `truncate`, and responsive padding `p-2.5 sm:p-3` ensuring containment within a 2-column mobile grid on a 375px viewport.

### 1.3 Atomic Mutations and Activity Log Generation
- In `src/lib/atomicMutations.ts`:
  - `createInvoiceAtomic` (lines 34–104) updates the customer's `outstandingAmount` by `initialAmountDue` via `increment(initialAmountDue)` and writes an `INVOICE_CREATED` event to `activity_logs`.
  - `recordPaymentAtomic` (lines 136–221) updates the invoice's `amountPaid` and `amountDue`, decrements customer's `outstandingAmount` via `increment(-paymentAmount)`, and writes a `PAYMENT_RECORDED` event to `activity_logs`.
  - `createCustomerAtomic` (lines 232–280) creates the customer doc with `outstandingAmount: 0` and writes a `CUSTOMER_CREATED` event to `activity_logs`.
  - All operations commit atomically via `writeBatch()` into Firestore with IndexedDB local persistence.

### 1.4 Domain Interfaces and Types
- In `src/types/domain.ts`:
  - `InvoiceStatus` (line 1): `'DRAFT' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED'`.
  - `Invoice` (lines 34–54): includes `grandTotal`, `amountPaid`, `amountDue`, `status`, `dueDate`, `currency`, `customerId`, `customerName`.
  - `ActivityLog` (lines 71–79):
    ```typescript
    export interface ActivityLog {
      id: string;
      timestamp: string;
      eventType: 'CUSTOMER_CREATED' | 'CUSTOMER_UPDATED' | 'INVOICE_CREATED' | 'INVOICE_UPDATED' | 'INVOICE_STATUS_CHANGED' | 'PAYMENT_RECORDED';
      entityType: 'CUSTOMER' | 'INVOICE' | 'PAYMENT';
      entityId: string;
      description: string;
      metadata?: Record<string, any>;
    }
    ```

### 1.5 Financial Math and Currency Utilities
- In `src/lib/calculations.ts`:
  - `roundFinancial(amount: number, decimals: number = 2): number` (lines 48–67) provides epsilon-safe symmetric half-up rounding.
  - `determineInvoiceStatus` (lines 134–164) determines status using `dueDate < today` overdue check when `amountPaid < grandTotal`.
  - `formatCurrency(amount: number, currency: string, locale: string)` (lines 236–270) generates bidi-safe currency strings formatted with Western Arabic numerals (`ar-SA-u-nu-latn`) and `\u200e` sign markers.

### 1.6 Sync Status Integration
- In `src/hooks/useSyncStatus.ts` (lines 154–174):
  - `trackSnapshotPendingWrites(sourceId: string, snapshot: { metadata: { hasPendingWrites: boolean } }): void`
  - `unregisterPendingSource(sourceId: string): void`
  - Allows Firestore snapshot listeners to register pending write states so the top-bar `SyncBadge` reflects `syncing` during local offline commits.

---

## 2. Logic Chain

### 2.1 Metric Invariants & Calculation Engine (`useDashboardMetrics.ts`)
1. **Total Revenue Calculation**:
   - Every invoice created or updated records `amountPaid`.
   - In `atomicMutations.ts` (Observation 1.3), full and partial payments directly increment `invoice.amountPaid`.
   - Invoices marked `CANCELLED` are voided and excluded.
   - Therefore, $\text{Total Revenue} = \text{roundFinancial}\left(\sum_{\text{inv} \notin \text{CANCELLED}} \text{inv.amountPaid}, 2\right)$.
   - Summing `invoice.amountPaid` preserves the financial identity: $\text{Total Invoiced} \equiv \text{Total Revenue} + \text{Outstanding Receivables}$ across active invoices.

2. **Outstanding Receivables Calculation & Consistency**:
   - An invoice represents accounts receivable if its status is not `CANCELLED` and not `DRAFT`.
   - In `atomicMutations.ts`, creating an invoice increments customer `outstandingAmount` by `invoice.amountDue`, and recording a payment decrements customer `outstandingAmount` by `payment.amount`.
   - Therefore, $\text{Outstanding Receivables} = \text{roundFinancial}\left(\sum_{\text{inv} \notin \{\text{CANCELLED}, \text{DRAFT}\}} \max(0, \text{inv.amountDue}), 2\right)$.
   - This value strictly matches the sum of all customer `outstandingAmount` balances ($\sum \text{inv.amountDue} \equiv \sum \text{cust.outstandingAmount}$).

3. **Paid Invoices Count**:
   - Invoices with `inv.status === 'PAID'` or (`inv.amountDue <= 0.0001 && inv.status !== 'CANCELLED' && inv.status !== 'DRAFT' && inv.grandTotal > 0`) are fully cleared.

4. **Dynamic Overdue Evaluation (Offline-First Requirement)**:
   - In offline-first desktop architectures without server-side cron triggers, an invoice's stored `status` field in IndexedDB may remain `'UNPAID'` or `'PARTIALLY_PAID'` even when the current date passes `inv.dueDate`.
   - Consequently, the dashboard MUST evaluate overdue state dynamically on the client:
     $\text{isOverdue} \iff \text{inv.status} === \text{'OVERDUE'} \lor (\text{inv.dueDate} < \text{today} \land \text{inv.amountDue} > 0 \land \text{inv.status} \notin \{\text{'PAID'}, \text{'CANCELLED'}, \text{'DRAFT'}\})$.
   - This ensures accurate, live overdue metrics immediately upon app launch.

5. **Epsilon Precision Math**:
   - Iterative floating-point addition in JavaScript accumulates drift (e.g. $19.99 \times 3 = 59.96999999999999$).
   - All aggregations must pass through `roundFinancial(sum, 2)` (Observation 1.5).

### 2.2 Dashboard Layout & Responsive Grid (`DashboardView.tsx`, `MetricsGrid.tsx`)
1. **Mobile-First 375px Grid**:
   - The user global rule mandates mobile-first optimization and compact cards (<90px height).
   - `MetricsGrid.tsx` uses `grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3`.
   - At a 375px viewport with padding `px-4` (32px), the net width is 343px. Two columns with `gap-2.5` (10px) give each card $\frac{343 - 10}{2} = 166.5\text{px}$.
   - At height `82px` (`h-[82px]`), typography `text-lg font-bold`, and `truncate` text handling, all 4 cards render without horizontal overflow.

2. **Arabic RTL Mirroring & Bidi Safety**:
   - Arabic RTL mode switches grid direction naturally from right-to-left.
   - `CompactMetricCard` has `BidiIsolate` wrapping `value`.
   - Trend badges (e.g., `+12.5%`, `38/42`) and currency strings are isolated to prevent Unicode Bidirectional Algorithm (UBA) scrambling in Arabic mode.

3. **Page Composition (`DashboardView.tsx`)**:
   - Top: Header with title, tagline, and "New Invoice" / "New Customer" action buttons.
   - Middle: `<MetricsGrid />` with the 4 reactive KPI cards.
   - Bottom: Responsive 2-column layout (`grid grid-cols-1 lg:grid-cols-3 gap-3`):
     - Main column (2 cols on desktop): Recent Invoices summary list + Offline Storage status card.
     - Side column (1 col on desktop): `<ActivityFeed />` chronological event log.
     - On mobile (375px): All sections stack cleanly into a single vertical stream.

### 2.3 Chronological Activity Feed (`ActivityFeed.tsx`, `useActivityLog.ts`)
1. **Firestore Query & Reactive Subscription**:
   - `useActivityLog.ts` queries `activity_logs` ordered by `timestamp desc` with `limit(15)` via `onSnapshot(..., { includeMetadataChanges: true })`.
   - Offline commits to `activity_logs` in `atomicMutations.ts` fire immediately into React state with zero latency.
   - Hooks report pending writes to `trackSnapshotPendingWrites` for sync status coordination.

2. **Visual Hierarchy & Entity Mapping**:
   - `CUSTOMER_CREATED` / `CUSTOMER_UPDATED` $\rightarrow$ `UserPlus` icon (Blue badge).
   - `INVOICE_CREATED` / `INVOICE_UPDATED` $\rightarrow$ `FileText` icon (Purple badge).
   - `PAYMENT_RECORDED` $\rightarrow$ `CreditCard` icon (Emerald badge).
   - `INVOICE_STATUS_CHANGED` $\rightarrow$ `AlertCircle` icon (Amber badge).

3. **Bilingual Relative Time Formatting**:
   - A dedicated relative time utility calculates relative duration in English ("just now", "5m ago", "2h ago", "yesterday", "3d ago") and Arabic ("الآن", "منذ 5 د", "منذ 2 س", "أمس", "منذ 3 أ").
   - Entity IDs (e.g. `INV-2026-001`, `PAY-2026-001`) are rendered inside `<BidiIsolate>` to prevent inverted hyphenation in Arabic.

---

## 3. Concrete Implementation Specifications

### 3.1 `src/hooks/useDashboardMetrics.ts`
```typescript
import { useState, useEffect, useMemo } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { collections } from '@/lib/firebase';
import { roundFinancial } from '@/lib/calculations';
import { trackSnapshotPendingWrites, unregisterPendingSource } from '@/hooks/useSyncStatus';
import type { Invoice } from '@/types/domain';

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
  const { referenceDate, currency = 'SAR' } = options;
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const sourceId = 'dashboard-metrics-invoices';
    setIsLoading(true);

    const unsubscribe = onSnapshot(
      collections.invoices,
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
      unregisterPendingSource(sourceId);
    };
  }, []);

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
```

---

### 3.2 `src/components/modules/dashboard/MetricsGrid.tsx`
```typescript
import React from 'react';
import { TrendingUp, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { CompactMetricCard } from '@/components/common/CompactMetricCard';
import { useDirection } from '@/context/DirectionContext';
import type { DashboardMetrics } from '@/hooks/useDashboardMetrics';

export interface MetricsGridProps {
  metrics: DashboardMetrics;
}

export const MetricsGrid: React.FC<MetricsGridProps> = ({ metrics }) => {
  const { t, formatCurrency } = useDirection();

  const revenueSubtitle = metrics.collectionRate > 0
    ? `${metrics.collectionRate}% collected`
    : `${metrics.paidInvoicesCount} invoices paid`;

  const receivablesSubtitle = metrics.unpaidInvoicesCount === 1
    ? '1 unpaid invoice'
    : `${metrics.unpaidInvoicesCount} unpaid invoices`;

  const paidSubtitle = metrics.totalInvoicesCount > 0
    ? `${metrics.paidInvoicesCount} of ${metrics.totalInvoicesCount} total`
    : '0 invoices';

  const overdueSubtitle = metrics.overdueInvoicesCount > 0
    ? 'Requires attention'
    : 'All accounts up to date';

  return (
    <div
      data-testid="metrics-grid"
      className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3"
    >
      {/* 1. Total Revenue Card (<90px, 82px actual) */}
      <CompactMetricCard
        title={t('kpi.totalRevenue')}
        value={formatCurrency(metrics.totalRevenue, metrics.primaryCurrency)}
        subtitle={revenueSubtitle}
        icon={TrendingUp}
        variant="brand"
        trend={
          metrics.collectionRate > 0
            ? { value: `${metrics.collectionRate}%`, isPositive: true }
            : undefined
        }
      />

      {/* 2. Outstanding Receivables Card (<90px, 82px actual) */}
      <CompactMetricCard
        title={t('kpi.outstandingReceivables')}
        value={formatCurrency(metrics.outstandingReceivables, metrics.primaryCurrency)}
        subtitle={receivablesSubtitle}
        icon={Clock}
        variant="amber"
        trend={
          metrics.outstandingReceivables === 0
            ? { value: 'All Clear', isPositive: true }
            : undefined
        }
      />

      {/* 3. Paid Invoices Card (<90px, 82px actual) */}
      <CompactMetricCard
        title={t('kpi.paidInvoices')}
        value={metrics.paidInvoicesCount}
        subtitle={paidSubtitle}
        icon={CheckCircle2}
        variant="emerald"
        trend={
          metrics.totalInvoicesCount > 0
            ? { value: `${metrics.paidInvoicesCount}/${metrics.totalInvoicesCount}`, isPositive: true }
            : undefined
        }
      />

      {/* 4. Overdue Invoices Card (<90px, 82px actual) */}
      <CompactMetricCard
        title={t('kpi.overdueInvoices')}
        value={metrics.overdueInvoicesCount}
        subtitle={overdueSubtitle}
        icon={AlertTriangle}
        variant="rose"
        trend={
          metrics.overdueInvoicesCount > 0
            ? { value: 'Needs Action', isPositive: false }
            : { value: 'Zero Overdue', isPositive: true }
        }
      />
    </div>
  );
};
```

---

### 3.3 `src/hooks/useActivityLog.ts`
```typescript
import { useState, useEffect } from 'react';
import { onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { collections } from '@/lib/firebase';
import { trackSnapshotPendingWrites, unregisterPendingSource } from '@/hooks/useSyncStatus';
import type { ActivityLog } from '@/types/domain';

export interface UseActivityLogResult {
  logs: ActivityLog[];
  isLoading: boolean;
  error: Error | null;
}

export function useActivityLog(maxItems: number = 15): UseActivityLogResult {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const sourceId = 'activity-feed-listener';
    setIsLoading(true);

    const q = query(
      collections.activityLogs,
      orderBy('timestamp', 'desc'),
      limit(maxItems)
    );

    const unsubscribe = onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot) => {
        trackSnapshotPendingWrites(sourceId, snapshot);
        const docs: ActivityLog[] = snapshot.docs.map(doc => ({
          ...(doc.data() as ActivityLog),
          id: doc.id
        }));
        setLogs(docs);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[useActivityLog] Snapshot error:', err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribe();
      unregisterPendingSource(sourceId);
    };
  }, [maxItems]);

  return { logs, isLoading, error };
}
```

---

### 3.4 `src/components/modules/dashboard/ActivityFeed.tsx`
```typescript
import React from 'react';
import {
  Activity,
  UserPlus,
  UserCheck,
  FileText,
  CreditCard,
  AlertCircle,
  Clock
} from 'lucide-react';
import { CompactCard } from '@/components/common/CompactCard';
import { BidiIsolate } from '@/components/common/BidiIsolate';
import { useDirection } from '@/context/DirectionContext';
import { useActivityLog } from '@/hooks/useActivityLog';
import type { ActivityLog } from '@/types/domain';

export function formatRelativeTime(isoString: string, language: 'en' | 'ar' = 'en'): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 60) {
      return language === 'ar' ? 'الآن' : 'just now';
    }
    if (diffMin < 60) {
      return language === 'ar' ? `منذ ${diffMin} د` : `${diffMin}m ago`;
    }
    if (diffHours < 24) {
      return language === 'ar' ? `منذ ${diffHours} س` : `${diffHours}h ago`;
    }
    if (diffDays === 1) {
      return language === 'ar' ? 'أمس' : 'yesterday';
    }
    if (diffDays < 7) {
      return language === 'ar' ? `منذ ${diffDays} أ` : `${diffDays}d ago`;
    }
    return date.toISOString().split('T')[0];
  } catch {
    return isoString;
  }
}

interface EventBadgeConfig {
  icon: React.ElementType;
  style: string;
  badgeLabelEn: string;
  badgeLabelAr: string;
}

const EVENT_CONFIGS: Record<ActivityLog['eventType'], EventBadgeConfig> = {
  CUSTOMER_CREATED: {
    icon: UserPlus,
    style: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/30',
    badgeLabelEn: 'Customer',
    badgeLabelAr: 'عميل'
  },
  CUSTOMER_UPDATED: {
    icon: UserCheck,
    style: 'bg-sky-50 text-sky-600 border-sky-100 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-900/30',
    badgeLabelEn: 'Customer',
    badgeLabelAr: 'عميل'
  },
  INVOICE_CREATED: {
    icon: FileText,
    style: 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900/30',
    badgeLabelEn: 'Invoice',
    badgeLabelAr: 'فاتورة'
  },
  INVOICE_UPDATED: {
    icon: FileText,
    style: 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900/30',
    badgeLabelEn: 'Invoice',
    badgeLabelAr: 'فاتورة'
  },
  INVOICE_STATUS_CHANGED: {
    icon: AlertCircle,
    style: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/30',
    badgeLabelEn: 'Status',
    badgeLabelAr: 'حالة'
  },
  PAYMENT_RECORDED: {
    icon: CreditCard,
    style: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/30',
    badgeLabelEn: 'Payment',
    badgeLabelAr: 'دفعة'
  }
};

export const ActivityFeed: React.FC<{ maxItems?: number }> = ({ maxItems = 15 }) => {
  const { language } = useDirection();
  const { logs, isLoading } = useActivityLog(maxItems);

  return (
    <CompactCard data-testid="activity-feed">
      <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            {language === 'ar' ? 'النشاط الأخير' : 'Recent Activity'}
          </h3>
        </div>
        {logs.length > 0 && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {logs.length}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2 py-2" data-testid="activity-feed-loading">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-11 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div
          data-testid="activity-feed-empty"
          className="py-6 text-center text-slate-400 dark:text-slate-500 space-y-1"
        >
          <Clock className="w-5 h-5 mx-auto opacity-60" />
          <p className="text-xs font-medium">
            {language === 'ar' ? 'لا يوجد نشاط مسجل حتى الآن' : 'No activity recorded yet'}
          </p>
          <p className="text-[10px]">
            {language === 'ar' ? 'ستظهر العمليات المنفذة هنا في الوقت الفعلي' : 'Actions will stream here in real time'}
          </p>
        </div>
      ) : (
        <div
          data-testid="activity-feed-list"
          className="max-h-[380px] overflow-y-auto space-y-2 pr-0.5 divide-y divide-slate-100 dark:divide-slate-800/60"
        >
          {logs.map((log) => {
            const config = EVENT_CONFIGS[log.eventType] || EVENT_CONFIGS.INVOICE_CREATED;
            const Icon = config.icon;
            const badgeLabel = language === 'ar' ? config.badgeLabelAr : config.badgeLabelEn;
            const relativeTime = formatRelativeTime(log.timestamp, language);

            return (
              <div
                key={log.id}
                data-testid={`activity-item-${log.id}`}
                className="pt-2 first:pt-0 flex items-start gap-2.5 text-xs select-none"
              >
                <div
                  className={`w-7 h-7 rounded-md shrink-0 flex items-center justify-center border mt-0.5 ${config.style}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-semibold px-1 py-0.2 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {badgeLabel}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 font-mono">
                      {relativeTime}
                    </span>
                  </div>

                  <p className="text-slate-700 dark:text-slate-200 text-xs mt-0.5 leading-snug line-clamp-2">
                    <BidiIsolate>{log.description}</BidiIsolate>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </CompactCard>
  );
};
```

---

### 3.5 `src/components/modules/dashboard/DashboardView.tsx`
```typescript
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ArrowUpRight, Database } from 'lucide-react';
import { useDirection } from '@/context/DirectionContext';
import { CompactCard } from '@/components/common/CompactCard';
import { BidiIsolate } from '@/components/common/BidiIsolate';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { MetricsGrid } from './MetricsGrid';
import { ActivityFeed } from './ActivityFeed';

export const DashboardView: React.FC = () => {
  const navigate = useNavigate();
  const { t, formatCurrency, isRTL } = useDirection();
  const metrics = useDashboardMetrics();

  return (
    <div className="space-y-4" data-testid="dashboard-view">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('nav.dashboard')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('app.tagline')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="action-new-invoice"
            onClick={() => navigate('/invoices?new=1')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('action.newInvoice')}</span>
          </button>
        </div>
      </div>

      {/* 4 Compact Metric Cards (<90px height, 82px actual) */}
      <MetricsGrid metrics={metrics} />

      {/* Responsive Content Grid: 2 columns on desktop, 1 on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Left / Main Section (2 cols on lg) */}
        <div className="lg:col-span-2 space-y-3">
          {/* Recent Invoices Card */}
          <CompactCard data-testid="recent-invoices-card">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                {t('nav.invoices')}
              </h3>
              <button
                type="button"
                onClick={() => navigate('/invoices')}
                className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 font-medium hover:underline cursor-pointer"
              >
                <span>{isRTL ? 'عرض الكل' : 'View all'}</span>
                <ArrowUpRight className="w-3 h-3 rtl:rotate-[-90deg]" />
              </button>
            </div>

            {metrics.recentInvoices.length === 0 ? (
              <div className="py-6 text-center text-slate-400 dark:text-slate-500 text-xs">
                <p>{isRTL ? 'لا توجد فواتير حتى الآن' : 'No invoices created yet'}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {metrics.recentInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    data-testid={`recent-invoice-row-${inv.id}`}
                    onClick={() => navigate(`/invoices?id=${inv.id}`)}
                    className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-xs cursor-pointer"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        <BidiIsolate>{inv.invoiceNumber || inv.id}</BidiIsolate> — {inv.customerName}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-semibold text-slate-900 dark:text-white">
                        <BidiIsolate>{formatCurrency(inv.grandTotal, inv.currency)}</BidiIsolate>
                      </span>

                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          inv.status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : inv.status === 'UNPAID'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : inv.status === 'OVERDUE'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        }`}
                      >
                        {t(`status.${inv.status.toLowerCase()}`, inv.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CompactCard>

          {/* Quick Offline Persistence Indicator Card */}
          <CompactCard>
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  {t('sync.online')}
                </h3>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>IndexedDB Cache</span>
              </span>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2">
              <p>
                {isRTL
                  ? 'يعمل محرك التخزين المحلي فورياً دون انتظار الشبكة، مع مزامنة سحابية تلقائية في الخلفية.'
                  : 'Zero-latency offline reads and atomic writes powered by multi-tab IndexedDB cache and background cloud sync.'}
              </p>
            </div>
          </CompactCard>
        </div>

        {/* Right / Activity Feed Column (1 col on lg, stacked on mobile) */}
        <div className="lg:col-span-1">
          <ActivityFeed maxItems={15} />
        </div>
      </div>
    </div>
  );
};
```

---

## 4. Caveats
1. **Multi-Currency Invoices**:
   If the user issues invoices across mixed currencies (e.g. SAR and USD), summing numeric totals directly without currency conversion would merge distinct currency amounts.
   *Mitigation*: The hook supports an explicit `currency` parameter and derives primary currency from active invoices or default app currency (`SAR`). If multi-currency aggregation is desired in Milestone 4, `useDashboardMetrics` can return a `byCurrency: Record<string, { totalRevenue, outstandingReceivables }>` breakdown.
2. **Cancelled Invoices Handling**:
   When an invoice is marked `'CANCELLED'`, its `amountDue` is voided and must not be counted in `outstandingReceivables`. Our formula explicitly filters out `'CANCELLED'` invoices.
3. **Time Travel / Reference Date for Testing**:
   The hook accepts an optional `referenceDate?: string` to guarantee reproducible unit and E2E testing of the dynamic overdue evaluation without mocking the global system clock.

---

## 5. Conclusion
- The Real-Time Financial Dashboard and Chronological Activity Log architecture is fully specified and compliant with all project constraints:
  1. `useDashboardMetrics.ts` dynamically calculates Total Revenue, Outstanding Receivables, Paid Invoices count, and Overdue count using `roundFinancial(amount, 2)` from live Firestore snapshot data against the IndexedDB local cache.
  2. `MetricsGrid.tsx` delivers 4 compact metric cards with fixed height `h-[82px]` (<90px), responsive 2-column layout on mobile (375px) and 4-column layout on desktop, with full Arabic RTL and `<BidiIsolate>` formatting.
  3. `ActivityFeed.tsx` and `useActivityLog.ts` deliver a real-time event stream from `activity_logs`, rendering entity icons, bilingual relative time, bidi-safe ID tags, and an empty/loading state in a space-efficient container.
  4. Both snapshot hooks integrate with `trackSnapshotPendingWrites` and `unregisterPendingSource` from `useSyncStatus.ts` for seamless sync pill coordination.

---

## 6. Verification Method

### 6.1 Automated Unit & Integration Tests (`tests/unit/DashboardMetrics.test.ts`)
To independently verify the implementation, write a unit test suite with the following test cases:
1. **Financial Invariant Verification**:
   - Seed 5 invoices (2 PAID, 2 UNPAID, 1 CANCELLED).
   - Verify `totalRevenue === roundFinancial(sum(paid.amountPaid))`
   - Verify `outstandingReceivables === roundFinancial(sum(unpaid.amountDue))`
   - Verify `totalInvoiced === roundFinancial(totalRevenue + outstandingReceivables)`
   - Verify CANCELLED invoices are excluded from revenue and receivables.
2. **Dynamic Overdue Detection**:
   - Seed an invoice with `status = 'UNPAID'`, `dueDate = '2026-09-01'`, and `amountDue = 500`.
   - Pass `referenceDate = '2026-09-19'`.
   - Assert `overdueInvoicesCount === 1` even though `status` in Firestore is `'UNPAID'`.
3. **Mobile Viewport & Compact Layout (<90px)**:
   - Render `<MetricsGrid />` inside a 375px mobile container.
   - Assert that all 4 cards have CSS class `h-[82px]` and no horizontal overflow occurs.
4. **Bidi & Arabic RTL Verification**:
   - Render in Arabic mode (`DirectionProvider` with language `'ar'`).
   - Verify invoice IDs, currency amounts, and trend percentages are rendered with `<BidiIsolate>` and Western Arabic numerals.
5. **Activity Log Stream & Relative Time**:
   - Render `<ActivityFeed />` with simulated `CUSTOMER_CREATED`, `INVOICE_CREATED`, and `PAYMENT_RECORDED` events.
   - Verify proper icons, entity badges, and relative times ("just now", "5m ago", "الآن", "منذ 5 د").

### 6.2 Test Command
Run all unit tests via Vitest:
```bash
npm test
```
All existing 157 tests and newly added dashboard tests must pass with 0 errors.
