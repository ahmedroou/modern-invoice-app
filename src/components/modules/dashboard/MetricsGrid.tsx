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
