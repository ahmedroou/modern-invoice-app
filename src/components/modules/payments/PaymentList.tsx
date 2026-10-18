/**
 * Payments Ledger & Directory View
 * 
 * Target: src/components/modules/payments/PaymentList.tsx
 * 
 * Features:
 * - Compact cards strictly <90px vertical height (h-[82px]) in card view.
 * - Desktop table view toggle with responsive columns.
 * - Search by payment #, invoice #, customer name, reference.
 * - Method filter pills (All, Cash, Bank Transfer, Card, Check, Online, Other).
 * - Date range filtering.
 * - Integration with usePayments, useInvoices, and PaymentModal.
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CreditCard,
  Search,
  X,
  Plus,
  DollarSign,
  Landmark,
  Wallet,
  Receipt,
  LayoutGrid,
  List as ListIcon
} from 'lucide-react';
import { useDirection } from '@/context/DirectionContext';
import { usePayments, type PaymentMethodFilter } from '@/hooks/usePayments';
import { useInvoices } from '@/hooks/useInvoices';
import { CompactMetricCard } from '@/components/common/CompactMetricCard';
import { BidiIsolate } from '@/components/common/BidiIsolate';
import { PaymentModal } from '@/components/modules/payments/PaymentModal';
import type { PaymentMethod, Invoice } from '@/types/domain';

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'payment.cash',
  BANK_TRANSFER: 'payment.bankTransfer',
  CREDIT_CARD: 'payment.creditCard',
  CHECK: 'payment.check',
  ONLINE_GATEWAY: 'payment.online',
  OTHER: 'payment.other'
};

export const PaymentList: React.FC = () => {
  const { t, formatCurrency, isRTL } = useDirection();
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    payments,
    loading,
    searchQuery,
    setSearchQuery,
    methodFilter,
    setMethodFilter,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    metrics
  } = usePayments();

  const { invoices, loading: invoicesLoading } = useInvoices();

  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [activePaymentModalInvoice, setActivePaymentModalInvoice] = useState<Invoice | null>(null);
  const [isSelectInvoiceOpen, setIsSelectInvoiceOpen] = useState<boolean>(false);

  // Read URL search params
  useEffect(() => {
    const isNew = searchParams.get('new') === '1';
    const invoiceId = searchParams.get('invoiceId');
    const customerId = searchParams.get('customerId');

    if (isNew) {
      if (invoicesLoading) return;
      if (invoiceId) {
        const matched = invoices.find((inv) => inv.id === invoiceId);
        if (matched) {
          setActivePaymentModalInvoice(matched);
        }
      } else if (customerId) {
        // Find first unpaid invoice for this customer
        const matched = invoices.find(
          (inv) => inv.customerId === customerId && inv.status !== 'DRAFT' && inv.status !== 'PAID' && inv.status !== 'CANCELLED' && inv.amountDue > 0
        );
        if (matched) {
          setActivePaymentModalInvoice(matched);
        } else {
          setIsSelectInvoiceOpen(true);
        }
      } else {
        setIsSelectInvoiceOpen(true);
      }
      const params = new URLSearchParams(searchParams);
      params.delete('new');
      params.delete('invoiceId');
      params.delete('customerId');
      setSearchParams(params, { replace: true });
    }
  }, [searchParams, invoices, invoicesLoading, setSearchParams]);

  const handleOpenRecordPayment = () => {
    setIsSelectInvoiceOpen(true);
  };

  const getMethodBadge = (method: PaymentMethod) => {
    switch (method) {
      case 'BANK_TRANSFER':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <Landmark className="w-2.5 h-2.5" />
            {t(METHOD_LABELS.BANK_TRANSFER)}
          </span>
        );
      case 'CASH':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <Wallet className="w-2.5 h-2.5" />
            {t(METHOD_LABELS.CASH)}
          </span>
        );
      case 'CREDIT_CARD':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            <CreditCard className="w-2.5 h-2.5" />
            {t(METHOD_LABELS.CREDIT_CARD)}
          </span>
        );
      case 'CHECK':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Receipt className="w-2.5 h-2.5" />
            {t(METHOD_LABELS.CHECK)}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {t(METHOD_LABELS[method] || 'payment.other')}
          </span>
        );
    }
  };

  const methodTabs: { id: PaymentMethodFilter; label: string; count?: number }[] = [
    { id: 'ALL', label: isRTL ? 'الكل' : 'All', count: metrics.paymentCount },
    { id: 'BANK_TRANSFER', label: t('payment.bankTransfer'), count: metrics.methodCounts.BANK_TRANSFER },
    { id: 'CASH', label: t('payment.cash'), count: metrics.methodCounts.CASH },
    { id: 'CREDIT_CARD', label: t('payment.creditCard'), count: metrics.methodCounts.CREDIT_CARD },
    { id: 'CHECK', label: t('payment.check'), count: metrics.methodCounts.CHECK },
    { id: 'ONLINE_GATEWAY', label: t('payment.online'), count: metrics.methodCounts.ONLINE_GATEWAY },
    { id: 'OTHER', label: t('payment.other'), count: metrics.methodCounts.OTHER }
  ];

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('payment.title')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {isRTL ? 'سجلات الدفعات والتحصيل ومراجعة العمليات' : 'Payment transactions, settlement receipts, and audit trail'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenRecordPayment}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-xs transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{t('payment.recordPayment')}</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Grid (<90px height cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <CompactMetricCard
          title={t('kpi.totalRevenue', 'Total Collected')}
          value={formatCurrency(metrics.totalCollected)}
          icon={DollarSign}
          variant="brand"
        />
        <CompactMetricCard
          title={t('payment.title', 'Total Payments')}
          value={metrics.paymentCount}
          icon={Receipt}
          variant="emerald"
        />
        <CompactMetricCard
          title={t('payment.bankTransfer')}
          value={metrics.methodCounts.BANK_TRANSFER}
          icon={Landmark}
          variant="amber"
        />
        <CompactMetricCard
          title={t('payment.cash')}
          value={metrics.methodCounts.CASH}
          icon={Wallet}
          variant="slate"
        />
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('action.search')}
            className="w-full ps-9 pe-8 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Date Range */}
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300"
          />
          <span>→</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300"
          />
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              title="Compact Card View"
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              title="Dense Table View"
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <ListIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Tabs by Payment Method */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {methodTabs.map((tab) => {
          const isActive = methodFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMethodFilter(tab.id)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg shrink-0 transition-colors flex items-center gap-1.5 ${
                isActive
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`text-[10px] px-1 py-0.2 rounded font-mono ${
                    isActive
                      ? 'bg-slate-800 dark:bg-slate-200 text-slate-200 dark:text-slate-800'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content Area: Compact Cards vs Table */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-xs sm:text-sm">
          {t('sync.syncing')}
        </div>
      ) : payments.length === 0 ? (
        <div className="py-12 text-center bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-6">
          <Receipt className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {t('payment.empty')}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Recorded invoice payments will appear here
          </p>
          <button
            type="button"
            onClick={handleOpenRecordPayment}
            className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-800/60 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('payment.recordPayment')}</span>
          </button>
        </div>
      ) : viewMode === 'cards' ? (
        /* Compact Cards Grid strictly <90px vertical height (h-[82px]) */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-2.5">
          {payments.map((pay) => (
            <div
              key={pay.id}
              className="h-[82px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-lg px-3 py-2 flex flex-col justify-between shadow-2xs hover:shadow-xs transition-all select-none min-w-0"
            >
              {/* Top Row: Payment # + Customer Name + Method Badge */}
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0 truncate">
                  <span className="font-mono font-bold text-xs text-slate-900 dark:text-white shrink-0">
                    {pay.paymentNumber}
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="text-xs text-slate-600 dark:text-slate-400 truncate">
                    {pay.customerName}
                  </span>
                </div>
                <div className="shrink-0">{getMethodBadge(pay.paymentMethod)}</div>
              </div>

              {/* Bottom Row: Date + Invoice # reference + Amount */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
                  <span className="font-mono">
                    <BidiIsolate>{pay.paymentDate}</BidiIsolate>
                  </span>
                  <span>•</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                    {pay.invoiceNumber}
                  </span>
                  {pay.referenceNumber && (
                    <span className="hidden sm:inline truncate max-w-[80px] font-mono text-slate-400">
                      (Ref: {pay.referenceNumber})
                    </span>
                  )}
                </div>

                <div className="text-end">
                  <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                    +<BidiIsolate>{formatCurrency(pay.amount)}</BidiIsolate>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Dense Table View */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto shadow-2xs">
          <table className="w-full text-xs text-start">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-3 py-2.5 text-start">{t('payment.paymentNumber')}</th>
                <th className="px-3 py-2.5 text-start">{t('payment.date')}</th>
                <th className="px-3 py-2.5 text-start">{t('invoice.customer')}</th>
                <th className="px-3 py-2.5 text-start">{t('invoice.invoiceNumber')}</th>
                <th className="px-3 py-2.5 text-start">{t('payment.method')}</th>
                <th className="px-3 py-2.5 text-start">{t('payment.reference', 'Reference')}</th>
                <th className="px-3 py-2.5 text-end">{t('payment.amount')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {payments.map((pay) => (
                <tr key={pay.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-3 py-2 font-mono font-bold text-slate-900 dark:text-white">
                    {pay.paymentNumber}
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-500">
                    <BidiIsolate>{pay.paymentDate}</BidiIsolate>
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">
                    {pay.customerName}
                  </td>
                  <td className="px-3 py-2 font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                    {pay.invoiceNumber}
                  </td>
                  <td className="px-3 py-2">{getMethodBadge(pay.paymentMethod)}</td>
                  <td className="px-3 py-2 font-mono text-slate-500">
                    {pay.referenceNumber || '-'}
                  </td>
                  <td className="px-3 py-2 text-end font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    +<BidiIsolate>{formatCurrency(pay.amount)}</BidiIsolate>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Quick Invoice Picker Modal if user clicks "Record Payment" with multiple unpaid invoices */}
      {isSelectInvoiceOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs"
        >
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isRTL ? 'اختر الفاتورة لتسجيل الدفعة' : 'Select an invoice to pay'}
              </h3>
              <button
                type="button"
                onClick={() => setIsSelectInvoiceOpen(false)}
                aria-label={isRTL ? 'إغلاق' : 'Close'}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1.5 divide-y divide-slate-100 dark:divide-slate-800">
              {invoices
                .filter((inv) => inv.status !== 'DRAFT' && inv.status !== 'PAID' && inv.status !== 'CANCELLED' && inv.amountDue > 0)
                .map((inv) => (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() => {
                      setIsSelectInvoiceOpen(false);
                      setActivePaymentModalInvoice(inv);
                    }}
                    className="w-full text-start p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg flex items-center justify-between text-xs transition-colors"
                  >
                    <div>
                      <span className="font-mono font-bold text-slate-900 dark:text-white block">
                        {inv.invoiceNumber}
                      </span>
                      <span className="text-slate-500">{inv.customerName}</span>
                    </div>
                    <div className="text-end">
                      <span className="font-mono font-bold text-rose-600 dark:text-rose-400 block">
                        {isRTL ? 'المستحق' : 'Due'} <BidiIsolate>{formatCurrency(inv.amountDue, inv.currency)}</BidiIsolate>
                      </span>
                      <span className="text-[10px] text-slate-400">{inv.issueDate}</span>
                    </div>
                  </button>
                ))}
              {!invoices.some(inv => !['DRAFT', 'PAID', 'CANCELLED'].includes(inv.status) && inv.amountDue > 0) && <p className="py-6 text-center text-xs text-slate-500">{isRTL ? 'لا توجد فواتير مستحقة لتسجيل دفعة عليها.' : 'There are no outstanding invoices to pay.'}</p>}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsSelectInvoiceOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                {t('action.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Recording Modal */}
      {activePaymentModalInvoice && (
        <PaymentModal
          isOpen={Boolean(activePaymentModalInvoice)}
          invoice={activePaymentModalInvoice}
          onClose={() => setActivePaymentModalInvoice(null)}
          onSuccess={() => setActivePaymentModalInvoice(null)}
        />
      )}
    </div>
  );
};
