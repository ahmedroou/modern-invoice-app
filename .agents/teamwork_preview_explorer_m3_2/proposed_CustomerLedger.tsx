import React, { useState } from 'react';
import {
  ArrowLeft,
  Search,
  Filter,
  ArrowUpDown,
  FileText,
  CreditCard,
  Plus,
  AlertCircle,
  Calendar,
  Layers,
  ChevronDown
} from 'lucide-react';
import { useDirection } from '@/context/DirectionContext';
import { CompactCard } from '@/components/common/CompactCard';
import { BidiIsolate } from '@/components/common/BidiIsolate';
import { CustomerProfileSummary } from './proposed_CustomerProfileSummary';
import { useCustomerLedger, type CustomerLedgerEntry } from './proposed_useCustomerLedger';

export interface CustomerLedgerProps {
  customerId: string;
  onBack?: () => void;
  onNewInvoice?: (customerId: string) => void;
  onRecordPayment?: (customerId: string) => void;
  onSelectInvoice?: (invoiceId: string) => void;
}

export const CustomerLedger: React.FC<CustomerLedgerProps> = ({
  customerId,
  onBack,
  onNewInvoice,
  onRecordPayment,
  onSelectInvoice
}) => {
  const { t, formatCurrency, isRTL } = useDirection();

  const {
    customer,
    ledgerEntries,
    filteredEntries,
    metrics,
    loading,
    error,
    sortOrder,
    setSortOrder,
    filterType,
    setFilterType,
    searchTerm,
    setSearchTerm,
    isReconciled
  } = useCustomerLedger(customerId);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse p-4">
        <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-1/4"></div>
        <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded"></div>
          <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded"></div>
          <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded"></div>
        </div>
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded"></div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="p-6 text-center">
        <CompactCard className="py-8 max-w-md mx-auto">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            {isRTL ? 'تعذر العثور على حساب العميل' : 'Customer Account Not Found'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            {error ? error.message : (isRTL ? 'لم يتم العثور على سجل العميل المطلوب.' : 'The requested customer profile could not be loaded.')}
          </p>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
              <span>{isRTL ? 'العودة لقائمة العملاء' : 'Back to Customers'}</span>
            </button>
          )}
        </CompactCard>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-full overflow-hidden">
      {/* 1. Header Navigation Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              title={isRTL ? 'رجوع' : 'Back'}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0"
            >
              <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            </button>
          )}
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white truncate">
              {customer.name}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isRTL ? 'الملف المالي وكشف الحساب التفصيلي' : 'Financial Profile & Statement of Account'}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Discrepancy / Reconciliation Warning (Defense-in-depth) */}
      {!isReconciled && (
        <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>
            {isRTL
              ? 'تنبيه تدقيق: تم اكتشاف تباين طفيف بين رصيد العميل المحفوظ وحصيلة كشف الحساب التراكمي.'
              : 'Audit Notice: A slight variance was detected between stored customer balance and transactional ledger sum.'}
          </span>
        </div>
      )}

      {/* 3. Customer Profile & Compact KPI Cards */}
      <CustomerProfileSummary
        customer={customer}
        metrics={metrics}
        onNewInvoice={() => onNewInvoice?.(customer.id)}
        onRecordPayment={() => onRecordPayment?.(customer.id)}
      />

      {/* 4. Ledger Filters & Search Toolbar */}
      <CompactCard className="p-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 absolute top-2.5 start-2.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={isRTL ? 'بحث برقم الفاتورة، الدفعة، أو الوصف...' : 'Search by invoice #, payment ref, description...'}
              className="w-full ps-8 pe-3 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Filter Pills & Sort Controls */}
          <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto pb-1 sm:pb-0">
            {/* Type Filter Buttons */}
            <div className="inline-flex rounded-md border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-100 dark:bg-slate-800/60 text-xs">
              <button
                type="button"
                onClick={() => setFilterType('ALL')}
                className={`px-2 py-1 rounded font-medium text-[11px] transition-colors ${
                  filterType === 'ALL'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {isRTL ? 'الكل' : 'All'} ({ledgerEntries.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('INVOICES')}
                className={`px-2 py-1 rounded font-medium text-[11px] transition-colors ${
                  filterType === 'INVOICES'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-2xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {isRTL ? 'الفواتير' : 'Invoices'} ({metrics.invoiceCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('PAYMENTS')}
                className={`px-2 py-1 rounded font-medium text-[11px] transition-colors ${
                  filterType === 'PAYMENTS'
                    ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-2xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {isRTL ? 'المدفوعات' : 'Payments'} ({metrics.paymentCount})
              </button>
            </div>

            {/* Sort Toggle Button */}
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0"
              title={isRTL ? 'تبديل الترتيب الزمني' : 'Toggle chronological order'}
            >
              <ArrowUpDown className="w-3 h-3 text-slate-400" />
              <span>
                {sortOrder === 'desc'
                  ? (isRTL ? 'الأحدث أولاً' : 'Newest First')
                  : (isRTL ? 'الأقدم أولاً' : 'Oldest First')}
              </span>
            </button>
          </div>
        </div>
      </CompactCard>

      {/* 5. Transaction Ledger List: Mobile Compact Cards (< md) / Desktop Table (md+) */}
      {filteredEntries.length === 0 ? (
        <CompactCard className="py-12 text-center">
          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-2">
            <FileText className="w-5 h-5" />
          </div>
          <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {isRTL ? 'لا توجد معاملات مسجلة' : 'No Transactions Found'}
          </h3>
          <p className="text-[11px] text-slate-400 mt-1 mb-3">
            {searchTerm
              ? (isRTL ? 'لا توجد نتائج تطابق معايير البحث.' : 'No entries match your search criteria.')
              : (isRTL ? 'لم يتم تسجيل أي فواتير أو مدفوعات لهذا العميل بعد.' : 'No invoices or payments have been recorded for this customer yet.')}
          </p>
          {onNewInvoice && !searchTerm && (
            <button
              type="button"
              onClick={() => onNewInvoice(customer.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('action.newInvoice')}</span>
            </button>
          )}
        </CompactCard>
      ) : (
        <>
          {/* MOBILE VIEW (< md): Space-efficient Compact Cards */}
          <div className="block md:hidden space-y-2">
            {filteredEntries.map((entry) => (
              <MobileLedgerCard
                key={`${entry.type}-${entry.id}`}
                entry={entry}
                customerCurrency={customer.currency}
                onSelectInvoice={onSelectInvoice}
              />
            ))}
          </div>

          {/* DESKTOP VIEW (md+): Tabular Ledger View */}
          <div className="hidden md:block">
            <CompactCard className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      <th className="py-2.5 px-3 text-start w-[100px]">{isRTL ? 'التاريخ' : 'Date'}</th>
                      <th className="py-2.5 px-3 text-start w-[90px]">{isRTL ? 'النوع' : 'Type'}</th>
                      <th className="py-2.5 px-3 text-start w-[130px]">{isRTL ? 'المرجع' : 'Reference'}</th>
                      <th className="py-2.5 px-3 text-start">{isRTL ? 'الوصف' : 'Description'}</th>
                      <th className="py-2.5 px-3 text-end w-[110px]">{isRTL ? 'مدين (+)' : 'Debit (+)'}</th>
                      <th className="py-2.5 px-3 text-end w-[110px]">{isRTL ? 'دائن (-)' : 'Credit (-)'}</th>
                      <th className="py-2.5 px-3 text-end w-[130px]">{isRTL ? 'الرصيد التراكمي' : 'Running Balance'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredEntries.map((entry) => (
                      <DesktopLedgerRow
                        key={`${entry.type}-${entry.id}`}
                        entry={entry}
                        customerCurrency={customer.currency}
                        onSelectInvoice={onSelectInvoice}
                      />
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50/80 dark:bg-slate-800/50 font-bold border-t-2 border-slate-200 dark:border-slate-700 text-xs">
                      <td colSpan={4} className="py-2.5 px-3 text-end">
                        {isRTL ? 'المجاميع الإجمالية:' : 'Grand Totals:'}
                      </td>
                      <td className="py-2.5 px-3 text-end font-mono text-slate-900 dark:text-white">
                        <BidiIsolate>{formatCurrency(metrics.totalInvoiced, customer.currency)}</BidiIsolate>
                      </td>
                      <td className="py-2.5 px-3 text-end font-mono text-emerald-600 dark:text-emerald-400">
                        <BidiIsolate>{formatCurrency(metrics.totalPaid, customer.currency)}</BidiIsolate>
                      </td>
                      <td className="py-2.5 px-3 text-end font-mono text-slate-900 dark:text-white">
                        <BidiIsolate>{formatCurrency(metrics.outstandingBalance, customer.currency)}</BidiIsolate>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CompactCard>
          </div>
        </>
      )}
    </div>
  );
};

// ==========================================
// Sub-components: Mobile Card & Desktop Row
// ==========================================

interface LedgerRowProps {
  entry: CustomerLedgerEntry;
  customerCurrency: string;
  onSelectInvoice?: (invoiceId: string) => void;
}

const MobileLedgerCard: React.FC<LedgerRowProps> = ({
  entry,
  customerCurrency,
  onSelectInvoice
}) => {
  const { formatCurrency, isRTL, t } = useDirection();
  const isInvoice = entry.type === 'INVOICE';

  return (
    <CompactCard
      className="p-2.5 cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
      onClick={() => isInvoice && onSelectInvoice?.(entry.id)}
    >
      {/* Top Header: Badge, Reference, Date */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
              isInvoice
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900'
                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
            }`}
          >
            {isInvoice ? (isRTL ? 'فاتورة' : 'Invoice') : (isRTL ? 'سداد' : 'Payment')}
          </span>

          <span className="font-mono font-semibold text-xs text-slate-900 dark:text-white truncate">
            <BidiIsolate>{entry.referenceNumber}</BidiIsolate>
          </span>
        </div>

        <span className="text-[11px] text-slate-400 shrink-0 font-mono">
          <BidiIsolate>{entry.date}</BidiIsolate>
        </span>
      </div>

      {/* Middle: Description / Payment Method */}
      <div className="text-[11px] text-slate-600 dark:text-slate-400 truncate mb-2">
        {entry.description}
      </div>

      {/* Bottom Footer: Amount & Running Balance */}
      <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800/80 text-xs">
        <div className="flex items-center gap-1 font-mono">
          <span className="text-[10px] text-slate-400">
            {isInvoice ? (isRTL ? 'المبلغ:' : 'Amount:') : (isRTL ? 'المدفوع:' : 'Paid:')}
          </span>
          <span
            className={`font-semibold ${
              isInvoice
                ? 'text-slate-900 dark:text-white'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            <BidiIsolate>
              {isInvoice ? '+' : '-'}{formatCurrency(isInvoice ? entry.debit : entry.credit, entry.currency || customerCurrency)}
            </BidiIsolate>
          </span>
        </div>

        <div className="flex items-center gap-1 font-mono">
          <span className="text-[10px] text-slate-400">{isRTL ? 'الرصيد:' : 'Balance:'}</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">
            <BidiIsolate>
              {formatCurrency(entry.runningBalance, customerCurrency)}
            </BidiIsolate>
          </span>
        </div>
      </div>
    </CompactCard>
  );
};

const DesktopLedgerRow: React.FC<LedgerRowProps> = ({
  entry,
  customerCurrency,
  onSelectInvoice
}) => {
  const { formatCurrency, isRTL } = useDirection();
  const isInvoice = entry.type === 'INVOICE';

  return (
    <tr
      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
        isInvoice ? 'cursor-pointer' : ''
      }`}
      onClick={() => isInvoice && onSelectInvoice?.(entry.id)}
    >
      {/* Date */}
      <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
        <BidiIsolate>{entry.date}</BidiIsolate>
      </td>

      {/* Type */}
      <td className="py-2 px-3 whitespace-nowrap">
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${
            isInvoice
              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
          }`}
        >
          {isInvoice ? <FileText className="w-2.5 h-2.5" /> : <CreditCard className="w-2.5 h-2.5" />}
          <span>{isInvoice ? (isRTL ? 'فاتورة' : 'Invoice') : (isRTL ? 'سداد' : 'Payment')}</span>
        </span>
      </td>

      {/* Reference Number */}
      <td className="py-2 px-3 font-mono font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
        <BidiIsolate>{entry.referenceNumber}</BidiIsolate>
      </td>

      {/* Description */}
      <td className="py-2 px-3 text-slate-600 dark:text-slate-400 max-w-[240px] truncate">
        {entry.description}
      </td>

      {/* Debit (+) */}
      <td className="py-2 px-3 text-end font-mono font-semibold text-slate-900 dark:text-white whitespace-nowrap">
        {entry.debit > 0 ? (
          <BidiIsolate>{formatCurrency(entry.debit, entry.currency || customerCurrency)}</BidiIsolate>
        ) : (
          <span className="text-slate-300 dark:text-slate-700">—</span>
        )}
      </td>

      {/* Credit (-) */}
      <td className="py-2 px-3 text-end font-mono font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
        {entry.credit > 0 ? (
          <BidiIsolate>{formatCurrency(entry.credit, entry.currency || customerCurrency)}</BidiIsolate>
        ) : (
          <span className="text-slate-300 dark:text-slate-700">—</span>
        )}
      </td>

      {/* Running Balance */}
      <td className="py-2 px-3 text-end font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
        <BidiIsolate>{formatCurrency(entry.runningBalance, customerCurrency)}</BidiIsolate>
      </td>
    </tr>
  );
};
