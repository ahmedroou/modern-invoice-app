/**
 * Invoices Directory View
 * 
 * Target: src/components/modules/invoices/InvoiceList.tsx
 * 
 * Strict specifications:
 * - Mobile-first responsive design: adapts from 375px to 1920px.
 * - Compact cards strictly <90px height (h-[82px]) in card view.
 * - Desktop table view toggle with responsive columns.
 * - Real-time calculations and filter updates with 0ms latency.
 * - Deep link support via URL query parameters: ?new=1, ?customerId=xyz, ?id=inv123.
 * - Global shortcut Ctrl+N opens New Invoice form.
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams, useParams, useLocation } from 'react-router-dom';
import {
  Plus,
  Search,
  X,
  FileText,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  LayoutGrid,
  List as ListIcon
} from 'lucide-react';
import { useDirection } from '@/context/DirectionContext';
import { useInvoices, type InvoiceStatusFilter } from '@/hooks/useInvoices';
import { useCustomers } from '@/hooks/useCustomers';
import { CompactMetricCard } from '@/components/common/CompactMetricCard';
import { BidiIsolate } from '@/components/common/BidiIsolate';
import { InvoiceForm } from '@/components/modules/invoices/InvoiceForm';
import { InvoiceDetail } from '@/components/modules/invoices/InvoiceDetail';
import { PaymentModal } from '@/components/modules/payments/PaymentModal';
import { useGlobalShortcuts } from '@/lib/keyboard';
import type { Invoice, InvoiceStatus } from '@/types/domain';

export const InvoiceList: React.FC = () => {
  const { t, formatCurrency, isRTL } = useDirection();
  const [searchParams, setSearchParams] = useSearchParams();
  const routeParams = useParams<{ id?: string }>();
  const location = useLocation();

  const {
    invoices,
    loading,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    customerFilter,
    setCustomerFilter,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    createInvoice,
    updateInvoice,
    cancelInvoice,
    getNextInvoiceNumber,
    metrics
  } = useInvoices();

  const { customers } = useCustomers();

  // View mode: 'cards' or 'table'
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);

  // Read URL search params on mount or param change
  useEffect(() => {
    const isNew = searchParams.get('new') === '1' || location.pathname.endsWith('/new');
    if (isNew) {
      setEditingInvoice(null);
      setIsFormOpen(true);
    }
  }, [searchParams, location.pathname]);

  // Sync selected invoice by route/query id
  useEffect(() => {
    const invoiceId = routeParams.id || searchParams.get('id');
    if (invoiceId && invoiceId !== 'new') {
      const matched = invoices.find((inv) => inv.id === invoiceId);
      if (matched) {
        setSelectedInvoice(matched);
      }
    }
  }, [searchParams, invoices, routeParams.id]);

  // Global shortcut: Ctrl+N opens New Invoice modal
  useGlobalShortcuts({
    onNewInvoice: () => {
      setEditingInvoice(null);
      setIsFormOpen(true);
    },
    enabled: !isFormOpen && !selectedInvoice && !paymentInvoice
  });

  const handleOpenNewInvoice = () => {
    setEditingInvoice(null);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    if (searchParams.get('new')) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('new');
      newParams.delete('customerId');
      setSearchParams(newParams);
    }
  };

  const handleFormSubmit = async (data: any) => {
    if (editingInvoice) {
      await updateInvoice(editingInvoice.id, data, editingInvoice);
    } else {
      await createInvoice(data);
    }
    handleCloseForm();
  };

  const handleInvoiceClick = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('id', invoice.id);
    setSearchParams(newParams);
  };

  const handleCloseDetail = () => {
    setSelectedInvoice(null);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('id');
    setSearchParams(newParams);
  };

  const handleEditFromDetail = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setIsFormOpen(true);
  };

  const handleRecordPaymentFromDetail = (invoice: Invoice) => {
    setPaymentInvoice(invoice);
  };

  const getStatusBadge = (status: InvoiceStatus) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            {t('status.paid')}
          </span>
        );
      case 'PARTIALLY_PAID':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            {t('status.partiallyPaid')}
          </span>
        );
      case 'OVERDUE':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
            {t('status.overdue')}
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {t('status.cancelled')}
          </span>
        );
      case 'DRAFT':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
            {t('status.draft')}
          </span>
        );
      default:
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
            {t('status.unpaid')}
          </span>
        );
    }
  };

  const filterTabs: { id: InvoiceStatusFilter; label: string; count?: number }[] = [
    { id: 'ALL', label: t('action.filter', 'All'), count: metrics.totalCount },
    { id: 'UNPAID', label: t('status.unpaid'), count: metrics.unpaidCount },
    { id: 'PARTIALLY_PAID', label: t('status.partiallyPaid'), count: metrics.partiallyPaidCount },
    { id: 'PAID', label: t('status.paid'), count: metrics.paidCount },
    { id: 'OVERDUE', label: t('status.overdue'), count: metrics.overdueCount },
    { id: 'CANCELLED', label: t('status.cancelled') }
  ];

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('invoice.title')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Manage client billing, payment receipts, and accounts receivable
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="new-invoice-btn"
            onClick={handleOpenNewInvoice}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-xs transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{t('invoice.newInvoice')}</span>
            <span className="hidden sm:inline opacity-75 font-mono text-[10px] ml-1">(Ctrl+N)</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Grid (<90px height cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <CompactMetricCard
          title={t('kpi.totalRevenue')}
          value={formatCurrency(metrics.totalRevenue)}
          icon={DollarSign}
          variant="brand"
        />
        <CompactMetricCard
          title={t('kpi.outstandingReceivables')}
          value={formatCurrency(metrics.totalReceivables)}
          icon={Clock}
          variant="amber"
        />
        <CompactMetricCard
          title={t('kpi.overdueInvoices')}
          value={metrics.overdueCount}
          icon={AlertTriangle}
          variant="rose"
        />
        <CompactMetricCard
          title={t('kpi.paidInvoices')}
          value={metrics.paidCount}
          icon={CheckCircle2}
          variant="emerald"
        />
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
        {/* Search Input */}
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

        {/* Customer & Date Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Customer Selector */}
          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
          >
            <option value="ALL">All Customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

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

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {filterTabs.map((tab) => {
          const isActive = statusFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
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

      {/* Content Area: Card View vs Table View */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-xs sm:text-sm">
          {t('sync.syncing')}
        </div>
      ) : invoices.length === 0 ? (
        <div className="py-12 text-center bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-6">
          <FileText className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {t('invoice.empty')}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Create your first invoice or adjust filter settings
          </p>
          <button
            type="button"
            onClick={handleOpenNewInvoice}
            className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-800/60 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('invoice.newInvoice')}</span>
          </button>
        </div>
      ) : viewMode === 'cards' ? (
        /* Compact Cards Grid strictly <90px vertical height (h-[82px]) */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-2.5">
          {invoices.map((inv) => (
            <div
              key={inv.id}
              data-testid={`invoice-card-${inv.id}`}
              onClick={() => handleInvoiceClick(inv)}
              className="h-[82px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-lg px-3 py-2 flex flex-col justify-between shadow-2xs hover:shadow-xs transition-all cursor-pointer select-none min-w-0"
            >
              {/* Top Row: Invoice # + Customer Name + Status */}
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0 truncate">
                  <span className="font-mono font-bold text-xs text-slate-900 dark:text-white shrink-0">
                    {inv.invoiceNumber}
                  </span>
                  {inv.syncStatus === 'pending' && (
                    <span
                      title={t('sync.offline', 'Saved locally (Sync pending)')}
                      className="inline-flex items-center text-amber-500 dark:text-amber-400 shrink-0"
                    >
                      <Clock className="w-3 h-3 animate-pulse" />
                    </span>
                  )}
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="text-xs text-slate-600 dark:text-slate-400 truncate">
                    {inv.customerName}
                  </span>
                </div>
                <div className="shrink-0">{getStatusBadge(inv.status)}</div>
              </div>

              {/* Bottom Row: Date + Financial Balance Due + Chevron */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
                  <span className="font-mono">
                    <BidiIsolate>{inv.issueDate}</BidiIsolate>
                  </span>
                  {inv.dueDate && (
                    <>
                      <span>→</span>
                      <span className="font-mono">
                        <BidiIsolate>{inv.dueDate}</BidiIsolate>
                      </span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="text-end">
                    <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                      <BidiIsolate>{formatCurrency(inv.grandTotal, inv.currency)}</BidiIsolate>
                    </span>
                    {inv.amountDue > 0 && inv.status !== 'PAID' && (
                      <span className="block text-[10px] font-mono text-rose-500 font-semibold leading-tight">
                        due <BidiIsolate>{formatCurrency(inv.amountDue, inv.currency)}</BidiIsolate>
                      </span>
                    )}
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0 ${isRTL ? 'rotate-180' : ''}`} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Dense Data Table View */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto shadow-2xs">
          <table className="w-full text-xs text-start">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-3 py-2.5 text-start">{t('invoice.invoiceNumber')}</th>
                <th className="px-3 py-2.5 text-start">{t('invoice.customer')}</th>
                <th className="px-3 py-2.5 text-start">{t('invoice.issueDate')}</th>
                <th className="px-3 py-2.5 text-start">{t('invoice.dueDate')}</th>
                <th className="px-3 py-2.5 text-center">Status</th>
                <th className="px-3 py-2.5 text-end">{t('invoice.grandTotal')}</th>
                <th className="px-3 py-2.5 text-end">{t('invoice.amountDue')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  onClick={() => handleInvoiceClick(inv)}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                >
                  <td className="px-3 py-2 font-mono font-bold text-slate-900 dark:text-white">
                    <div className="flex items-center gap-1.5">
                      <span>{inv.invoiceNumber}</span>
                      {inv.syncStatus === 'pending' && (
                        <span
                          title={t('sync.offline', 'Saved locally (Sync pending)')}
                          className="inline-flex items-center text-amber-500 dark:text-amber-400 shrink-0"
                        >
                          <Clock className="w-3 h-3 animate-pulse" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">
                    {inv.customerName}
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-500">
                    <BidiIsolate>{inv.issueDate}</BidiIsolate>
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-500">
                    <BidiIsolate>{inv.dueDate}</BidiIsolate>
                  </td>
                  <td className="px-3 py-2 text-center">{getStatusBadge(inv.status)}</td>
                  <td className="px-3 py-2 text-end font-mono font-bold text-slate-900 dark:text-white">
                    <BidiIsolate>{formatCurrency(inv.grandTotal, inv.currency)}</BidiIsolate>
                  </td>
                  <td className="px-3 py-2 text-end font-mono font-semibold text-rose-600 dark:text-rose-400">
                    <BidiIsolate>{formatCurrency(inv.amountDue, inv.currency)}</BidiIsolate>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invoice Form Modal (New / Edit) */}
      {isFormOpen && (
        <InvoiceForm
          key={`invoice-form-${editingInvoice?.id || 'new'}`}
          isOpen={isFormOpen}
          invoice={editingInvoice}
          initialCustomerId={searchParams.get('customerId') || undefined}
          defaultInvoiceNumber={getNextInvoiceNumber()}
          onClose={handleCloseForm}
          onSubmit={handleFormSubmit}
        />
      )}

      {/* Invoice Detail Modal */}
      <InvoiceDetail
        isOpen={Boolean(selectedInvoice)}
        invoice={selectedInvoice}
        onClose={handleCloseDetail}
        onEdit={handleEditFromDetail}
        onCancel={async (id, inv) => {
          await cancelInvoice(id, inv);
        }}
        onRecordPayment={handleRecordPaymentFromDetail}
      />

      {/* Payment Modal */}
      {paymentInvoice && (
        <PaymentModal
          isOpen={Boolean(paymentInvoice)}
          invoice={paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
          onSuccess={() => {
            setPaymentInvoice(null);
            handleCloseDetail();
          }}
        />
      )}
    </div>
  );
};
