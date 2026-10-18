/**
 * High-performance, mobile-first Customer Directory component.
 * Mobile (<640px / 375px): Compact cards strictly <90px height (h-[82px]) with 0ms overflow.
 * Desktop (>=768px): Dense sortable table with view toggle (cards/table).
 * Full Arabic RTL support, bidirectional isolation (<BidiIsolate>), and instant offline search.
 * Supports drill-down into CustomerLedger.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Users,
  Plus,
  Search,
  X,
  Phone,
  Mail,
  ChevronRight,
  ArrowUpDown,
  Building2,
  Table as TableIcon,
  LayoutGrid,
  AlertCircle,
  Edit2,
  Receipt
} from 'lucide-react';
import { useDirection } from '@/context/DirectionContext';
import { BidiIsolate } from '@/components/common/BidiIsolate';
import { CompactCard } from '@/components/common/CompactCard';
import { CompactMetricCard } from '@/components/common/CompactMetricCard';
import { CustomerModal } from './CustomerModal';
import { CustomerLedger } from './CustomerLedger';
import {
  useCustomers,
  type CustomerStatusFilter,
  type CustomerSortBy
} from '@/hooks/useCustomers';
import type { Customer } from '@/types/domain';

export const CustomerList: React.FC = () => {
  const navigate = useNavigate();
  const { id: routeCustomerId } = useParams<{ id?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryCustomerId = searchParams.get('id');

  const { t, formatCurrency, isRTL } = useDirection();
  const {
    customers,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    balanceFilter,
    setBalanceFilter,
    sortBy,
    setSortBy,
    sortOrder,
    toggleSortOrder,
    createCustomer,
    updateCustomer,
    archiveCustomer,
    restoreCustomer,
    deleteCustomer,
    metrics
  } = useCustomers();

  // Local UI state
  const [selectedCustomerForEdit, setSelectedCustomerForEdit] = useState<Customer | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(searchParams.get('new') === '1');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [localLedgerCustomerId, setLocalLedgerCustomerId] = useState<string | null>(null);

  const activeLedgerCustomerId = routeCustomerId || queryCustomerId || localLedgerCustomerId;
  useEffect(() => {
    if (searchParams.get('new') === '1') { setSelectedCustomerForEdit(null); setIsModalOpen(true); }
  }, [searchParams]);
  const handleCloseModal = () => {
    setIsModalOpen(false);
    if (searchParams.has('new')) {
      const params = new URLSearchParams(searchParams);
      params.delete('new');
      setSearchParams(params, { replace: true });
    }
  };

  const handleOpenCreate = () => {
    setSelectedCustomerForEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (customer: Customer) => {
    setSelectedCustomerForEdit(customer);
    setIsModalOpen(true);
  };

  const handleViewLedger = (customerId: string) => {
    setLocalLedgerCustomerId(customerId);
    setSearchParams({ id: customerId });
  };

  const handleCloseLedger = () => {
    setLocalLedgerCustomerId(null);
    if (routeCustomerId) {
      navigate('/customers');
    } else if (queryCustomerId) {
      setSearchParams({});
    }
  };

  // If a customer ledger is active, render CustomerLedger drilldown view
  if (activeLedgerCustomerId) {
    return (
      <div data-testid="customer-ledger-view">
        <CustomerLedger
          customerId={activeLedgerCustomerId}
          onBack={handleCloseLedger}
          onNewInvoice={(custId) => navigate(`/invoices?new=1&customerId=${custId}`)}
          onRecordPayment={(custId) => navigate(`/payments?new=1&customerId=${custId}`)}
          onSelectInvoice={(invId) => navigate(`/invoices?id=${invId}`)}
          onEditCustomer={(cust) => handleOpenEdit(cust)}
        />

        <CustomerModal
          isOpen={isModalOpen}
          customer={selectedCustomerForEdit}
          onClose={handleCloseModal}
          onSubmit={async (data) => {
            if (selectedCustomerForEdit) {
              await updateCustomer(selectedCustomerForEdit.id, data);
            } else {
              await createCustomer(data);
            }
          }}
          onArchive={archiveCustomer}
          onRestore={restoreCustomer}
          onDelete={async (id) => {
            await deleteCustomer(id);
            handleCloseLedger();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4 max-w-full overflow-hidden" data-testid="customer-list-view">
      {/* 1. Page Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{t('nav.customers')}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isRTL
              ? 'إدارة حسابات العملاء ومتابعة المستحقات المالية دون اتصال'
              : 'Manage customer directories and monitor receivables offline'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Desktop View Mode Toggle */}
          <div className="hidden md:flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Compact Card View"
              aria-label="Cards view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Table View"
              aria-label="Table view"
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* New Customer Primary CTA */}
          <button
            type="button"
            onClick={handleOpenCreate}
            data-testid="add-customer-btn"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('action.newCustomer')}</span>
          </button>
        </div>
      </div>

      {/* 2. Compact Directory Metric Cards Grid (<90px height, 82px actual) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3" data-testid="customer-metrics-grid">
        <CompactMetricCard
          title={isRTL ? 'إجمالي العملاء' : 'Total Customers'}
          value={metrics.totalCount}
          icon={Users}
          variant="slate"
        />
        <CompactMetricCard
          title={t('kpi.activeCustomers')}
          value={metrics.activeCount}
          icon={Users}
          variant="emerald"
        />
        <CompactMetricCard
          title={isRTL ? 'عملاء عليهم مستحقات' : 'Debtor Accounts'}
          value={metrics.withDebtCount}
          subtitle={isRTL ? 'يتطلب متابعة' : 'Pending payment'}
          icon={AlertCircle}
          variant="amber"
        />
        <CompactMetricCard
          title={t('kpi.outstandingReceivables')}
          value={formatCurrency(metrics.totalOutstanding)}
          icon={Building2}
          variant="brand"
        />
      </div>

      {/* 3. Search, Filter Bar & Sort Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 shadow-2xs space-y-2">
        <div className="flex items-center gap-2">
          {/* Search Input with Clear Button */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 absolute start-2.5 top-2.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isRTL ? 'بحث بالاسم، الهاتف، أو الرقم الضريبي...' : 'Search by name, phone, or tax ID...'}
              className="w-full ps-8 pe-8 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900 dark:text-white"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute end-2 top-2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Sort Dropdown */}
          <div className="flex items-center gap-1 shrink-0">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as CustomerSortBy)}
              className="px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-700 dark:text-slate-300 focus:outline-none"
              aria-label="Sort by"
            >
              <option value="name">{isRTL ? 'الاسم (أ-ي)' : 'Name (A-Z)'}</option>
              <option value="outstandingAmount">{isRTL ? 'المستحقات' : 'Outstanding'}</option>
              <option value="totalInvoiced">{isRTL ? 'إجمالي الفواتير' : 'Total Invoiced'}</option>
              <option value="createdAt">{isRTL ? 'الأحدث تسجيلاً' : 'Newest'}</option>
            </select>

            <button
              type="button"
              onClick={toggleSortOrder}
              className="p-1.5 border border-slate-200 dark:border-slate-800 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title={`Sort order: ${sortOrder}`}
              aria-label="Toggle sort order"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Filter Pills (Status & Balance) */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 overflow-x-auto text-xs scrollbar-none">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider hidden sm:inline">
              {t('action.filter')}:
            </span>
            {(['ALL', 'ACTIVE', 'ARCHIVED'] as CustomerStatusFilter[]).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                  statusFilter === status
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {status === 'ALL'
                  ? isRTL
                    ? 'الكل'
                    : 'All'
                  : status === 'ACTIVE'
                  ? isRTL
                    ? 'النشطون'
                    : 'Active'
                  : isRTL
                  ? 'المؤرشفون'
                  : 'Archived'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() =>
                setBalanceFilter(balanceFilter === 'WITH_BALANCE' ? 'ALL' : 'WITH_BALANCE')
              }
              className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                balanceFilter === 'WITH_BALANCE'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-semibold'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {isRTL ? 'عليهم مستحقات فقط' : 'Has Outstanding'}
            </button>
          </div>
        </div>
      </div>

      {/* 4. Customer Directory Content (Cards vs Table) */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs">{isRTL ? 'جارٍ تحميل بيانات العملاء...' : 'Loading customers...'}</p>
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 text-rose-700 text-xs">
          {error.message}
        </div>
      ) : customers.length === 0 ? (
        /* Empty State */
        <CompactCard className="py-10 text-center space-y-2">
          <Users className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {searchQuery
              ? isRTL
                ? `لا توجد نتائج مطابقة لـ "${searchQuery}"`
                : `No customers match "${searchQuery}"`
              : isRTL
              ? 'دليل العملاء فارغ حالياً'
              : 'No customers found'}
          </h3>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            {searchQuery
              ? isRTL
                ? 'جرّب تعديل مصطلح البحث أو إزالة المرشحات.'
                : 'Try adjusting your search query or filters.'
              : isRTL
              ? 'ابدأ بإضافة عميلك الأول لإنشاء الفواتير ومتابعة المستحقات.'
              : 'Add your first customer to start tracking invoices and payments.'}
          </p>
          <div className="pt-2">
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                {isRTL ? 'إلغاء البحث' : 'Clear search'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('action.newCustomer')}</span>
              </button>
            )}
          </div>
        </CompactCard>
      ) : viewMode === 'cards' ? (
        /* Compact Card View (Optimized for Mobile <90px height: h-[82px]) */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-2.5" data-testid="customer-cards-grid">
          {customers.map((customer) => {
            const hasDebt = (customer.outstandingAmount || 0) > 0;
            return (
              <div
                key={customer.id}
                data-testid={`customer-card-${customer.id}`}
                onClick={() => handleViewLedger(customer.id)}
                className="h-[82px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-lg px-3 py-2 flex flex-col justify-between shadow-2xs hover:shadow-xs transition-all cursor-pointer select-none min-w-0"
              >
                {/* Top Row: Initial Avatar + Name + Edit Button + Status */}
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-900/30">
                      {customer.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                      {customer.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      title="Edit Customer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEdit(customer);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>

                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        customer.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {customer.status === 'ACTIVE'
                        ? isRTL
                          ? 'نشط'
                          : 'Active'
                        : isRTL
                        ? 'مؤرشف'
                        : 'Archived'}
                    </span>
                  </div>
                </div>

                {/* Bottom Row: Contact info + Outstanding Balance */}
                <div className="flex items-center justify-between gap-2 min-w-0 text-xs">
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 truncate text-[11px]">
                    {customer.phone ? (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <BidiIsolate>{customer.phone}</BidiIsolate>
                      </span>
                    ) : customer.email ? (
                      <span className="flex items-center gap-1 truncate">
                        <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{customer.email}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[10px] italic">
                        {isRTL ? 'لا يوجد هاتف' : 'No phone'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                      {isRTL ? 'المستحق' : 'Due'}:
                    </span>
                    <span
                      className={`font-mono font-bold text-xs ${
                        hasDebt
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <BidiIsolate>
                        {formatCurrency(customer.outstandingAmount || 0, customer.currency)}
                      </BidiIsolate>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 rtl:rotate-180 shrink-0" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Dense Desktop Table View */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-2xs" data-testid="customer-table-view">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                  <th className="py-2.5 px-3 text-start">{isRTL ? 'العميل' : 'Customer'}</th>
                  <th className="py-2.5 px-3 text-start">{isRTL ? 'الاتصال' : 'Contact'}</th>
                  <th className="py-2.5 px-3 text-start">{isRTL ? 'الرقم الضريبي' : 'Tax / VAT'}</th>
                  <th className="py-2.5 px-3 text-end">{isRTL ? 'إجمالي الفواتير' : 'Invoiced'}</th>
                  <th className="py-2.5 px-3 text-end">{isRTL ? 'المستحق' : 'Outstanding'}</th>
                  <th className="py-2.5 px-3 text-center">{isRTL ? 'الحالة' : 'Status'}</th>
                  <th className="py-2.5 px-3 text-end">{isRTL ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    data-testid={`customer-row-${c.id}`}
                    onClick={() => handleViewLedger(c.id)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer h-11"
                  >
                    <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate max-w-[180px]">{c.name}</span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-slate-600 dark:text-slate-400 font-mono">
                      {c.phone ? (
                        <BidiIsolate>{c.phone}</BidiIsolate>
                      ) : (
                        <span className="text-slate-400 italic">--</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-slate-500 font-mono">
                      {c.taxNumber ? (
                        <BidiIsolate>{c.taxNumber}</BidiIsolate>
                      ) : (
                        <span className="text-slate-400 italic">--</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-end font-mono font-medium text-slate-700 dark:text-slate-300">
                      <BidiIsolate>{formatCurrency(c.totalInvoiced || 0, c.currency)}</BidiIsolate>
                    </td>
                    <td className="py-2 px-3 text-end font-mono font-bold">
                      <span
                        className={
                          (c.outstandingAmount || 0) > 0
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-slate-700 dark:text-slate-300'
                        }
                      >
                        <BidiIsolate>
                          {formatCurrency(c.outstandingAmount || 0, c.currency)}
                        </BidiIsolate>
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          c.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {c.status === 'ACTIVE' ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'مؤرشف' : 'Archived')}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-end">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewLedger(c.id);
                          }}
                          className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline text-xs font-semibold cursor-pointer"
                        >
                          <Receipt className="w-3 h-3" />
                          <span>{isRTL ? 'كشف الحساب' : 'Ledger'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEdit(c);
                          }}
                          className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:underline text-xs cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>{isRTL ? 'تعديل' : 'Edit'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Customer Create/Edit Modal Dialog */}
      <CustomerModal
        isOpen={isModalOpen}
        customer={selectedCustomerForEdit}
        onClose={handleCloseModal}
        onSubmit={async (data) => {
          if (selectedCustomerForEdit) {
            await updateCustomer(selectedCustomerForEdit.id, data);
          } else {
            await createCustomer(data);
          }
        }}
        onArchive={archiveCustomer}
        onRestore={restoreCustomer}
        onDelete={deleteCustomer}
      />
    </div>
  );
};
