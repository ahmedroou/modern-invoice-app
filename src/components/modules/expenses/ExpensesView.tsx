import React, { useState } from 'react';
import {
  Receipt,
  Building2,
  CreditCard,
  AlertTriangle,
  Plus,
  Search,
  ArrowDownRight,
  CheckCircle2,
  Trash2
} from 'lucide-react';
import { useDirection } from '@/context/DirectionContext';
import { useVendors } from '@/hooks/useVendors';
import { useExpenseBills, type BillStatusFilter, type BillCategoryFilter } from '@/hooks/useExpenseBills';
import { useExpensePayments } from '@/hooks/useExpensePayments';
import { CompactMetricCard } from '@/components/common/CompactMetricCard';
import { CompactCard } from '@/components/common/CompactCard';
import { VendorFormModal } from './VendorFormModal';
import { ExpenseBillFormModal } from './ExpenseBillFormModal';
import { ExpensePaymentModal } from './ExpensePaymentModal';
import type { ExpenseBill, ExpenseCategory } from '@/types/domain';

type ActiveTab = 'bills' | 'vendors' | 'payments';

const CATEGORY_LABELS: Record<ExpenseCategory, { ar: string; en: string }> = {
  GOODS: { ar: 'بضائع ومخزون', en: 'Goods' },
  RENT: { ar: 'إيجار ومقرات', en: 'Rent' },
  SALARIES: { ar: 'رواتب وأجور', en: 'Salaries' },
  UTILITIES: { ar: 'فواتير تشغيلية', en: 'Utilities' },
  MAINTENANCE: { ar: 'صيانة ومعدات', en: 'Maintenance' },
  SHIPPING: { ar: 'شحن وتوصيل', en: 'Shipping' },
  MARKETING: { ar: 'تسويق وإعلانات', en: 'Marketing' },
  OTHER: { ar: 'مصروفات أخرى', en: 'Other' }
};

export const ExpensesView: React.FC = () => {
  const { language, formatCurrency } = useDirection();
  const isAr = language === 'ar';

  const [activeTab, setActiveTab] = useState<ActiveTab>('bills');

  // Hooks
  const {
    vendors,
    rawVendors,
    loading: vendorsLoading,
    searchQuery: vendorSearch,
    setSearchQuery: setVendorSearch,
    createVendor,
    deleteVendor,
    metrics: vendorMetrics
  } = useVendors();

  const {
    bills,
    rawBills,
    loading: billsLoading,
    searchQuery: billSearch,
    setSearchQuery: setBillSearch,
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    createBill,
    deleteBill,
    metrics: billMetrics
  } = useExpenseBills();

  const {
    payments,
    rawPayments,
    loading: paymentsLoading,
    searchQuery: paymentSearch,
    setSearchQuery: setPaymentSearch,
    recordPayment,
    deletePayment,
    totalPaidAmount
  } = useExpensePayments();

  // Modals state
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedBillForPayment, setSelectedBillForPayment] = useState<ExpenseBill | null>(null);

  const handleOpenPayForBill = (bill: ExpenseBill) => {
    setSelectedBillForPayment(bill);
    setIsPaymentModalOpen(true);
  };

  const handleOpenGeneralPayment = () => {
    setSelectedBillForPayment(null);
    setIsPaymentModalOpen(true);
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-4">
      {/* ─── Top Compact KPI Cards (<90px height) ─────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Total Payables Owed */}
        <CompactMetricCard
          title={isAr ? 'مستحقات للغير (واجبة السداد)' : 'Total Payables Owed'}
          value={formatCurrency(billMetrics.totalPayables)}
          subtitle={isAr ? `${billMetrics.unpaidCount + billMetrics.partiallyPaidCount} فاتورة غير مسددة` : `${billMetrics.unpaidCount} unpaid bills`}
          icon={Receipt}
          variant="rose"
        />

        {/* Total Paid Out */}
        <CompactMetricCard
          title={isAr ? 'إجمالي المدفوع للموردين' : 'Total Paid Out'}
          value={formatCurrency(totalPaidAmount)}
          subtitle={isAr ? `${rawPayments.length} سند صرف مسجل` : `${rawPayments.length} vouchers`}
          icon={CreditCard}
          variant="emerald"
        />

        {/* Overdue Bills */}
        <CompactMetricCard
          title={isAr ? 'فواتير متأخرة السداد' : 'Overdue Bills'}
          value={billMetrics.overdueCount}
          subtitle={isAr ? 'تجاوزت تاريخ الاستحقاق' : 'Past due date'}
          icon={AlertTriangle}
          variant="amber"
        />

        {/* Active Vendors */}
        <CompactMetricCard
          title={isAr ? 'الموردون والجهات' : 'Active Payees'}
          value={vendorMetrics.activeCount}
          subtitle={isAr ? 'شركات وأفراد وخدمات' : 'Vendors & services'}
          icon={Building2}
          variant="brand"
        />
      </div>

      {/* ─── Main Content Container with Tabs & Actions ───────────────────── */}
      <CompactCard className="p-3 sm:p-4 space-y-4">
        {/* Header: Title + Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>{isAr ? 'المصروفات وفواتير المشتريات' : 'Bills, Expenses & Payables'}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isAr
                ? 'متابعة فواتير الشركات والموردين، سداد المستحقات، وسندات الصرف'
                : 'Manage vendor dues, business expenses, and payment vouchers'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsBillModalOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAr ? 'فاتورة مشتريات / مصروف +' : '+ New Bill'}</span>
            </button>

            <button
              onClick={handleOpenGeneralPayment}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-colors"
            >
              <ArrowDownRight className="w-3.5 h-3.5" />
              <span>{isAr ? 'سند صرف +' : '+ Payment Voucher'}</span>
            </button>

            <button
              onClick={() => setIsVendorModalOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span>{isAr ? 'مورد جديد +' : '+ Vendor'}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto select-none">
          <button
            onClick={() => setActiveTab('bills')}
            className={`
              flex items-center gap-2 px-3 py-2 text-xs font-bold border-b-2 transition-colors whitespace-nowrap
              ${
                activeTab === 'bills'
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }
            `}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>{isAr ? 'فواتير المشتريات والمصروفات' : 'Bills & Expenses'}</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {rawBills.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('vendors')}
            className={`
              flex items-center gap-2 px-3 py-2 text-xs font-bold border-b-2 transition-colors whitespace-nowrap
              ${
                activeTab === 'vendors'
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }
            `}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>{isAr ? 'دليل الموردين والجهات' : 'Vendors & Payees'}</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {rawVendors.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`
              flex items-center gap-2 px-3 py-2 text-xs font-bold border-b-2 transition-colors whitespace-nowrap
              ${
                activeTab === 'payments'
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }
            `}
          >
            <ArrowDownRight className="w-3.5 h-3.5" />
            <span>{isAr ? 'سجل سندات الصرف' : 'Payment Vouchers'}</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {rawPayments.length}
            </span>
          </button>
        </div>

        {/* ─── TAB 1: Bills & Expenses List ──────────────────────────────── */}
        {activeTab === 'bills' && (
          <div className="space-y-3">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute start-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={billSearch}
                  onChange={(e) => setBillSearch(e.target.value)}
                  placeholder={isAr ? 'بحث برقم الفاتورة أو المورد...' : 'Search bills...'}
                  className="w-full ps-8 pe-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as BillStatusFilter)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none"
                >
                  <option value="ALL">{isAr ? 'جميع الحالات' : 'All Statuses'}</option>
                  <option value="UNPAID">{isAr ? 'غير مدفوعة' : 'Unpaid'}</option>
                  <option value="PARTIALLY_PAID">{isAr ? 'مدفوعة جزئياً' : 'Partially Paid'}</option>
                  <option value="PAID">{isAr ? 'مدفوعة بالكامل' : 'Paid'}</option>
                  <option value="OVERDUE">{isAr ? 'متأخرة السداد' : 'Overdue'}</option>
                </select>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as BillCategoryFilter)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none"
                >
                  <option value="ALL">{isAr ? 'كافة التصنيفات' : 'All Categories'}</option>
                  {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>{isAr ? label.ar : label.en}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* List / Cards */}
            {billsLoading && bills.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                {isAr ? 'جارٍ تحميل فواتير المصروفات...' : 'Loading expense bills...'}
              </div>
            ) : bills.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                <Receipt className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p>{isAr ? 'لا توجد فواتير مصروفات مطابقة للبحث' : 'No expense bills found'}</p>
                <button
                  onClick={() => setIsBillModalOpen(true)}
                  className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
                >
                  {isAr ? '+ تسجيل أول فاتورة مصروف' : '+ Record first bill'}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {bills.map((b) => {
                  const isOverdue = b.dueDate < todayStr && b.status !== 'PAID' && b.status !== 'CANCELLED';
                  return (
                    <div
                      key={b.id}
                      className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-850 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 min-h-[76px]"
                    >
                      {/* Left / Info */}
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                          <Receipt className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                              {b.billNumber}
                            </span>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                              {b.vendorName}
                            </span>
                            {/* Status Badge */}
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                b.status === 'PAID'
                                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                  : isOverdue
                                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                                  : b.status === 'PARTIALLY_PAID'
                                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {b.status === 'PAID'
                                ? (isAr ? 'مدفوعة' : 'Paid')
                                : isOverdue
                                ? (isAr ? 'متأخرة' : 'Overdue')
                                : b.status === 'PARTIALLY_PAID'
                                ? (isAr ? 'مدفوعة جزئياً' : 'Partially Paid')
                                : (isAr ? 'غير مدفوعة' : 'Unpaid')}
                            </span>
                            <span className="text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                              {isAr ? CATEGORY_LABELS[b.category]?.ar : CATEGORY_LABELS[b.category]?.en}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                            <span>{isAr ? `تاريخ: ${b.issueDate}` : `Date: ${b.issueDate}`}</span>
                            <span>{isAr ? `استحقاق: ${b.dueDate}` : `Due: ${b.dueDate}`}</span>
                            {b.items && <span>({b.items.length} {isAr ? 'بنود' : 'items'})</span>}
                          </div>
                        </div>
                      </div>

                      {/* Right / Financials & Actions */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                        <div className="text-start sm:text-end">
                          <div className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                            {formatCurrency(b.grandTotal, b.currency)}
                          </div>
                          {b.amountDue > 0 ? (
                            <div className="text-[11px] font-mono text-rose-600 dark:text-rose-400">
                              {isAr ? 'المتبقي:' : 'Due:'} {formatCurrency(b.amountDue, b.currency)}
                            </div>
                          ) : (
                            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{isAr ? 'مسددة بالكامل' : 'Settled'}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {b.amountDue > 0 && (
                            <button
                              onClick={() => handleOpenPayForBill(b)}
                              className="px-2.5 py-1 text-xs font-bold rounded-md bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 hover:bg-teal-100 transition-colors"
                            >
                              {isAr ? 'سداد دفعة' : 'Pay'}
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (confirm(isAr ? 'هل أنت متأكد من حذف هذه الفاتورة؟' : 'Delete this bill?')) {
                                deleteBill(b.id);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors"
                            title={isAr ? 'حذف الفاتورة' : 'Delete bill'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 2: Vendors List ───────────────────────────────────────── */}
        {activeTab === 'vendors' && (
          <div className="space-y-3">
            {/* Search */}
            <div className="flex items-center justify-between gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute start-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={vendorSearch}
                  onChange={(e) => setVendorSearch(e.target.value)}
                  placeholder={isAr ? 'بحث باسم المورد أو الشركة...' : 'Search vendors...'}
                  className="w-full ps-8 pe-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <button
                onClick={() => setIsVendorModalOpen(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAr ? 'مورد جديد' : 'New Vendor'}</span>
              </button>
            </div>

            {vendorsLoading && vendors.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                {isAr ? 'جارٍ تحميل دليل الموردين...' : 'Loading vendors...'}
              </div>
            ) : vendors.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                <Building2 className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p>{isAr ? 'لا يوجد موردون مسجلون حالياً' : 'No vendors registered yet'}</p>
                <button
                  onClick={() => setIsVendorModalOpen(true)}
                  className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
                >
                  {isAr ? '+ إضافة أول مورد أو جهة' : '+ Add first vendor'}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {vendors.map((v) => (
                  <div
                    key={v.id}
                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-850 transition-colors flex flex-col justify-between h-[86px]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {v.name}
                        </h4>
                        <p className="text-[11px] text-slate-400 truncate">
                          {v.company || v.category || (isAr ? 'جهة مستحقة' : 'Payee')}
                          {v.phone ? ` • ${v.phone}` : ''}
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          if (confirm(isAr ? `هل تريد حذف ${v.name}؟` : `Delete vendor ${v.name}?`)) {
                            deleteVendor(v.id);
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                        title={isAr ? 'حذف المورد' : 'Delete'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-100 dark:border-slate-800 font-mono">
                      <span className="text-[10px] text-slate-400">
                        {isAr ? 'المستحق عليه له:' : 'Balance Owed:'}
                      </span>
                      <span className={`font-bold ${v.outstandingBalance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400'}`}>
                        {formatCurrency(v.outstandingBalance || 0, v.currency)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 3: Outgoing Payments / Vouchers List ────────────────────── */}
        {activeTab === 'payments' && (
          <div className="space-y-3">
            {/* Search */}
            <div className="flex items-center justify-between gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute start-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={paymentSearch}
                  onChange={(e) => setPaymentSearch(e.target.value)}
                  placeholder={isAr ? 'بحث برقم السند أو اسم المستفيد...' : 'Search vouchers...'}
                  className="w-full ps-8 pe-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <button
                onClick={handleOpenGeneralPayment}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-colors shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAr ? 'سند صرف جديد' : 'New Voucher'}</span>
              </button>
            </div>

            {paymentsLoading && payments.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                {isAr ? 'جارٍ تحميل سندات الصرف...' : 'Loading vouchers...'}
              </div>
            ) : payments.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                <CreditCard className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p>{isAr ? 'لم يتم تسجيل أي سندات صرف حتى الآن' : 'No payment vouchers recorded'}</p>
                <button
                  onClick={handleOpenGeneralPayment}
                  className="text-teal-600 dark:text-teal-400 font-bold hover:underline"
                >
                  {isAr ? '+ إصدار أول سند صرف' : '+ Record first voucher'}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-850 transition-colors flex items-center justify-between gap-3 min-h-[64px]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                        <ArrowDownRight className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                            {p.voucherNumber}
                          </span>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                            {p.vendorName}
                          </span>
                          {p.billNumber && (
                            <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              {isAr ? `فاتورة: ${p.billNumber}` : `Bill: ${p.billNumber}`}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                          <span>{p.paymentDate}</span>
                          <span>•</span>
                          <span>{p.paymentMethod}</span>
                          {p.referenceNumber && <span>({p.referenceNumber})</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-end">
                        <div className="text-xs font-mono font-bold text-teal-600 dark:text-teal-400">
                          {formatCurrency(p.amount)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {isAr ? 'سند صرف معتمد' : 'Voucher confirmed'}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          if (confirm(isAr ? 'هل أنت متأكد من حذف هذا السند؟' : 'Delete this voucher?')) {
                            deletePayment(p.id);
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                        title={isAr ? 'حذف السند' : 'Delete voucher'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CompactCard>

      {/* ─── Modals ──────────────────────────────────────────────────────── */}
      <VendorFormModal
        isOpen={isVendorModalOpen}
        onClose={() => setIsVendorModalOpen(false)}
        onSubmit={async (data) => {
          await createVendor(data);
        }}
      />

      <ExpenseBillFormModal
        isOpen={isBillModalOpen}
        onClose={() => setIsBillModalOpen(false)}
        vendors={vendors}
        onOpenNewVendorModal={() => {
          setIsBillModalOpen(false);
          setIsVendorModalOpen(true);
        }}
        onSubmit={async (data) => {
          await createBill(data);
        }}
      />

      <ExpensePaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setSelectedBillForPayment(null);
        }}
        bill={selectedBillForPayment}
        vendors={vendors}
        onSubmit={async (data, bill) => {
          await recordPayment(data, bill);
        }}
      />
    </div>
  );
};
