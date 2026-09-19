import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ArrowUpRight, Database, UserPlus } from 'lucide-react';
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
    <div className="space-y-4 max-w-full overflow-hidden" data-testid="dashboard-view">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('nav.dashboard')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('app.tagline')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="action-new-customer"
            onClick={() => navigate('/customers')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{t('action.newCustomer')}</span>
          </button>

          <button
            type="button"
            data-testid="action-new-invoice"
            onClick={() => navigate('/invoices?new=1')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs transition-colors cursor-pointer"
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
