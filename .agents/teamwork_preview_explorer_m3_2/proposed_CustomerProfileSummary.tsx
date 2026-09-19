import React from 'react';
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Phone,
  Mail,
  MapPin,
  Plus,
  CreditCard,
  Printer,
  Receipt,
  UserCheck,
  Building2
} from 'lucide-react';
import { useDirection } from '@/context/DirectionContext';
import { CompactMetricCard } from '@/components/common/CompactMetricCard';
import { CompactCard } from '@/components/common/CompactCard';
import { BidiIsolate } from '@/components/common/BidiIsolate';
import type { Customer } from '@/types/domain';
import type { CustomerFinancialMetrics } from './proposed_useCustomerLedger';

export interface CustomerProfileSummaryProps {
  customer: Customer;
  metrics: CustomerFinancialMetrics;
  onNewInvoice?: () => void;
  onRecordPayment?: () => void;
  onPrintStatement?: () => void;
  onEditCustomer?: () => void;
}

export const CustomerProfileSummary: React.FC<CustomerProfileSummaryProps> = ({
  customer,
  metrics,
  onNewInvoice,
  onRecordPayment,
  onPrintStatement,
  onEditCustomer
}) => {
  const { t, formatCurrency, isRTL } = useDirection();

  // Determine Financial Status Badge styling
  const getStatusBadge = () => {
    switch (metrics.financialStatus) {
      case 'OVERDUE':
        return {
          label: isRTL ? 'مستحق متأخر' : 'Overdue Balance',
          bg: 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-200 dark:border-rose-900/50',
          icon: AlertTriangle
        };
      case 'HAS_BALANCE':
        return {
          label: isRTL ? 'رصيد قائم' : 'Open Balance',
          bg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200 dark:border-amber-900/50',
          icon: Clock
        };
      case 'CLEARED':
      default:
        return {
          label: isRTL ? 'الرصيد خالص' : 'Balance Settled',
          bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50',
          icon: CheckCircle2
        };
    }
  };

  const statusBadge = getStatusBadge();
  const StatusIcon = statusBadge.icon;

  return (
    <div className="space-y-3">
      {/* 1. Main Profile Information Card */}
      <CompactCard className="p-3 sm:p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Customer Avatar & Header */}
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-emerald-600/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800 font-bold text-sm sm:text-base">
              {customer.name.trim().charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                  {customer.name}
                </h1>

                {/* Account Status Badge */}
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    customer.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <UserCheck className="w-2.5 h-2.5" />
                  <span>{customer.status === 'ACTIVE' ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'مؤرشف' : 'Archived')}</span>
                </span>

                {/* Financial Status Badge */}
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusBadge.bg}`}
                >
                  <StatusIcon className="w-2.5 h-2.5" />
                  <span>{statusBadge.label}</span>
                </span>
              </div>

              {/* Contact and Tax Meta Strip */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                {/* Tax / VAT Number */}
                {customer.taxNumber && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Receipt className="w-3.5 h-3.5 text-slate-400" />
                    <span>{isRTL ? 'الرقم الضريبي:' : 'Tax No:'}</span>
                    <BidiIsolate className="font-mono font-medium text-slate-700 dark:text-slate-300">
                      {customer.taxNumber}
                    </BidiIsolate>
                  </div>
                )}

                {/* Phone */}
                {customer.phone && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <a
                      href={`tel:${customer.phone}`}
                      className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                    >
                      <BidiIsolate className="font-mono">{customer.phone}</BidiIsolate>
                    </a>
                  </div>
                )}

                {/* Email */}
                {customer.email && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <a
                      href={`mailto:${customer.email}`}
                      className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors truncate max-w-[200px]"
                    >
                      {customer.email}
                    </a>
                  </div>
                )}

                {/* Address */}
                {customer.address && (
                  <div className="flex items-center gap-1 shrink-0">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate max-w-[220px]">{customer.address}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons Bar */}
          <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
            {onNewInvoice && (
              <button
                type="button"
                onClick={onNewInvoice}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs transition-colors shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('action.newInvoice')}</span>
              </button>
            )}

            {onRecordPayment && (
              <button
                type="button"
                onClick={onRecordPayment}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 shadow-2xs transition-colors shrink-0"
              >
                <CreditCard className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{t('action.recordPayment')}</span>
              </button>
            )}

            {onPrintStatement && (
              <button
                type="button"
                onClick={onPrintStatement}
                title={isRTL ? 'طباعة كشف الحساب' : 'Print Statement'}
                className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors shrink-0"
              >
                <Printer className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </CompactCard>

      {/* 2. Compact KPI Metric Cards (<90px height) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
        {/* Total Invoiced */}
        <CompactMetricCard
          title={isRTL ? 'إجمالي الفواتير' : 'Total Invoiced'}
          value={formatCurrency(metrics.totalInvoiced, customer.currency)}
          subtitle={
            isRTL
              ? `${metrics.invoiceCount} فاتورة صادرة`
              : `${metrics.invoiceCount} invoices issued`
          }
          icon={FileText}
          variant="slate"
        />

        {/* Total Paid */}
        <CompactMetricCard
          title={isRTL ? 'إجمالي المسدد' : 'Total Paid'}
          value={formatCurrency(metrics.totalPaid, customer.currency)}
          subtitle={
            isRTL
              ? `${metrics.paymentCount} دفعة مسجلة`
              : `${metrics.paymentCount} payments received`
          }
          icon={CheckCircle2}
          variant="emerald"
        />

        {/* Current Outstanding Balance */}
        <CompactMetricCard
          title={isRTL ? 'الرصيد المستحق' : 'Outstanding Balance'}
          value={formatCurrency(metrics.outstandingBalance, customer.currency)}
          subtitle={
            metrics.overdueCount > 0
              ? isRTL
                ? `${metrics.overdueCount} فاتورة متأخرة`
                : `${metrics.overdueCount} overdue invoices`
              : metrics.outstandingBalance <= 0.001
              ? isRTL ? 'لا توجد مستحقات' : 'Zero balance'
              : isRTL ? 'مستحق الدفع' : 'Current pending'
          }
          icon={metrics.overdueCount > 0 ? AlertTriangle : Clock}
          variant={metrics.overdueCount > 0 ? 'rose' : metrics.outstandingBalance > 0 ? 'amber' : 'emerald'}
          trend={
            metrics.overdueCount > 0
              ? { value: isRTL ? 'متأخر' : 'Overdue', isPositive: false }
              : undefined
          }
        />
      </div>
    </div>
  );
};
