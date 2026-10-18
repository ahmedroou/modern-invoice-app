/**
 * Customer Statement of Account Generator & Preview
 * 
 * Target: src/components/modules/statements/StatementGenerator.tsx
 * 
 * Features:
 * - Customer selector with deep linking (?customerId=xyz).
 * - Date Range presets (This Month, Last Month, This Quarter, Year to Date, All Time) + custom inputs.
 * - Validation: disables/flags error if startDate > endDate.
 * - Real-time Statement Calculation via pure generateCustomerStatement().
 * - 4 compact KPI summary cards (<90px height).
 * - Sequential running balance ledger table.
 * - RFC 4180 CSV export with UTF-8 BOM (\uFEFF) for Excel Arabic fidelity.
 * - Printable A4 view with repeating headers via StatementPrintView.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import {
  Download,
  Printer,
  DollarSign,
  CreditCard,
  Clock,
  Landmark,
  AlertCircle
} from 'lucide-react';
import { useDirection } from '@/context/DirectionContext';
import { useCustomers } from '@/hooks/useCustomers';
import { useInvoices } from '@/hooks/useInvoices';
import { usePayments } from '@/hooks/usePayments';
import { CompactMetricCard } from '@/components/common/CompactMetricCard';
import { BidiIsolate } from '@/components/common/BidiIsolate';
import { generateCustomerStatement, exportStatementToCSV } from '@/lib/statements';
import { StatementPrintView } from '@/components/modules/statements/StatementPrintView';
import type { StatementSummary } from '@/types/domain';

type PresetType = 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_QUARTER' | 'YEAR_TO_DATE' | 'ALL_TIME' | 'CUSTOM';

export const StatementGenerator: React.FC = () => {
  const { t, formatCurrency, isRTL } = useDirection();
  const [searchParams, setSearchParams] = useSearchParams();
  const routeParams = useParams<{ customerId?: string }>();

  const { customers } = useCustomers();
  const { rawInvoices } = useInvoices();
  const { rawPayments } = usePayments();

  // Selected customer
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

  // Date range
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activePreset, setActivePreset] = useState<PresetType>('THIS_MONTH');

  // Print view modal
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  // Set date ranges for presets
  const applyPreset = (preset: PresetType) => {
    setActivePreset(preset);
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed

    const pad = (n: number) => String(n).padStart(2, '0');

    if (preset === 'THIS_MONTH') {
      const firstDay = `${year}-${pad(month + 1)}-01`;
      const lastDayObj = new Date(year, month + 1, 0);
      const lastDay = `${year}-${pad(month + 1)}-${pad(lastDayObj.getDate())}`;
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === 'LAST_MONTH') {
      const prevMonthObj = new Date(year, month - 1, 1);
      const prevYear = prevMonthObj.getFullYear();
      const prevMonth = prevMonthObj.getMonth();
      const firstDay = `${prevYear}-${pad(prevMonth + 1)}-01`;
      const lastDayObj = new Date(prevYear, prevMonth + 1, 0);
      const lastDay = `${prevYear}-${pad(prevMonth + 1)}-${pad(lastDayObj.getDate())}`;
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === 'THIS_QUARTER') {
      const quarter = Math.floor(month / 3);
      const startQuarterMonth = quarter * 3;
      const endQuarterMonth = startQuarterMonth + 2;
      const firstDay = `${year}-${pad(startQuarterMonth + 1)}-01`;
      const lastDayObj = new Date(year, endQuarterMonth + 1, 0);
      const lastDay = `${year}-${pad(endQuarterMonth + 1)}-${pad(lastDayObj.getDate())}`;
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === 'YEAR_TO_DATE') {
      const firstDay = `${year}-01-01`;
      const today = `${year}-${pad(month + 1)}-${pad(now.getDate())}`;
      setStartDate(firstDay);
      setEndDate(today);
    } else if (preset === 'ALL_TIME') {
      const firstDay = '2020-01-01';
      const today = `${year}-${pad(month + 1)}-${pad(now.getDate())}`;
      setStartDate(firstDay);
      setEndDate(today);
    }
  };

  // Initialize customer and date range from URL or defaults
  useEffect(() => {
    const custId = routeParams.customerId || searchParams.get('customerId');
    if (custId) {
      setSelectedCustomerId(custId);
    } else if (customers.length > 0 && !selectedCustomerId) {
      setSelectedCustomerId(customers[0].id);
    }

    if (!startDate || !endDate) {
      applyPreset('THIS_MONTH');
    }
  }, [customers, searchParams, routeParams.customerId]);

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId) || customers[0] || null;
  }, [customers, selectedCustomerId]);

  const dateError = useMemo(() => {
    if (startDate && endDate && startDate > endDate) {
      return t('statement.invalidDateRange', 'Start date cannot be after end date');
    }
    return null;
  }, [startDate, endDate, t]);

  // Generate statement object reactively
  const statement: StatementSummary | null = useMemo(() => {
    if (!selectedCustomer || !startDate || !endDate || dateError) {
      return null;
    }

    try {
      const customerInvoices = rawInvoices.filter((inv) => inv.customerId === selectedCustomer.id);
      const customerPayments = rawPayments.filter((p) => p.customerId === selectedCustomer.id);

      return generateCustomerStatement(selectedCustomer, customerInvoices, customerPayments, {
        startDate,
        endDate
      });
    } catch (err) {
      console.error('[StatementGenerator] Generation error:', err);
      return null;
    }
  }, [selectedCustomer, rawInvoices, rawPayments, startDate, endDate, dateError]);

  const handleCustomerSelect = (id: string) => {
    setSelectedCustomerId(id);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('customerId', id);
    setSearchParams(newParams);
  };

  const handleExportCSV = async () => {
    if (!statement) return;
    const csvContent = exportStatementToCSV(statement);
    const suggestedFilename = `Statement_${statement.customer.name.replace(/\s+/g, '_')}_${statement.dateRange.startDate}_${statement.dateRange.endDate}.csv`;

    // 1. Electron API
    if (typeof window !== 'undefined' && (window as any).electronAPI?.exportFile) {
      try {
        await (window as any).electronAPI.exportFile({
          format: 'csv',
          data: csvContent,
          suggestedFilename
        });
        return;
      } catch (err) {
        console.warn('Native export failed, falling back to browser download:', err);
      }
    }

    // 2. Browser fallback Blob download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', suggestedFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const currency = selectedCustomer?.currency || 'SAR';

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('statement.title')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {t('statement.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!statement || Boolean(dateError)}
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xs disabled:opacity-40 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('statement.exportCsv')}</span>
          </button>

          <button
            type="button"
            disabled={!statement || Boolean(dateError)}
            onClick={() => setIsPrintOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 rounded-lg shadow-xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{t('statement.printPdf')}</span>
          </button>
        </div>
      </div>

      {/* Control Panel: Customer Selector & Date Range Presets */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 sm:p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Customer Dropdown */}
          <div className="sm:col-span-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('invoice.customer')}
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => handleCustomerSelect(e.target.value)}
              className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.currency ? `(${c.currency})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('statement.startDate')}
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setActivePreset('CUSTOM');
              }}
              className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('statement.endDate')}
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setActivePreset('CUSTOM');
              }}
              className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* Date Presets Ribbon */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 scrollbar-none">
          <button
            type="button"
            onClick={() => applyPreset('THIS_MONTH')}
            className={`px-2.5 py-1 text-xs rounded-md font-semibold transition-colors shrink-0 ${
              activePreset === 'THIS_MONTH'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            {isRTL ? 'هذا الشهر' : 'This Month'}
          </button>
          <button
            type="button"
            onClick={() => applyPreset('LAST_MONTH')}
            className={`px-2.5 py-1 text-xs rounded-md font-semibold transition-colors shrink-0 ${
              activePreset === 'LAST_MONTH'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            {isRTL ? 'الشهر الماضي' : 'Last Month'}
          </button>
          <button
            type="button"
            onClick={() => applyPreset('THIS_QUARTER')}
            className={`px-2.5 py-1 text-xs rounded-md font-semibold transition-colors shrink-0 ${
              activePreset === 'THIS_QUARTER'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            {isRTL ? 'هذا الربع' : 'This Quarter'}
          </button>
          <button
            type="button"
            onClick={() => applyPreset('YEAR_TO_DATE')}
            className={`px-2.5 py-1 text-xs rounded-md font-semibold transition-colors shrink-0 ${
              activePreset === 'YEAR_TO_DATE'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            {isRTL ? 'من بداية السنة' : 'Year to Date'}
          </button>
          <button
            type="button"
            onClick={() => applyPreset('ALL_TIME')}
            className={`px-2.5 py-1 text-xs rounded-md font-semibold transition-colors shrink-0 ${
              activePreset === 'ALL_TIME'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            {isRTL ? 'كل الفترات' : 'All Time'}
          </button>
        </div>

        {dateError && (
          <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-lg flex items-center gap-2 text-rose-700 dark:rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{dateError}</span>
          </div>
        )}
      </div>

      {/* Financial Summary Cards (<90px height) */}
      {statement && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <CompactMetricCard
            title={t('statement.openingBalance')}
            value={formatCurrency(statement.openingBalance, currency)}
            icon={Clock}
            variant="amber"
          />
          <CompactMetricCard
            title={t('statement.debit')}
            value={formatCurrency(statement.totalInvoiced, currency)}
            icon={DollarSign}
            variant="brand"
          />
          <CompactMetricCard
            title={t('statement.credit')}
            value={formatCurrency(statement.totalPaid, currency)}
            icon={CreditCard}
            variant="emerald"
          />
          <CompactMetricCard
            title={t('statement.closingBalance')}
            value={formatCurrency(statement.closingBalance, currency)}
            icon={Landmark}
            variant="brand"
          />
        </div>
      )}

      {/* Transaction Ledger Table Preview */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
            {isRTL ? 'حركة الحساب' : 'Ledger Activity'} ({statement?.entries.length || 0})
          </h3>
          {statement && (
            <span className="text-[11px] font-mono text-slate-400">
              {isRTL ? 'صافي الحركة:' : 'Net Change:'} {formatCurrency(statement.netChange, currency)}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-3 py-2.5 text-start w-28">Date</th>
                <th className="px-2 py-2.5 text-start w-20">Type</th>
                <th className="px-3 py-2.5 text-start w-32">Reference #</th>
                <th className="px-3 py-2.5 text-start">Description</th>
                <th className="px-3 py-2.5 text-end w-28">{t('statement.debit')}</th>
                <th className="px-3 py-2.5 text-end w-28">{t('statement.credit')}</th>
                <th className="px-3 py-2.5 text-end w-32">{t('statement.runningBalance')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {/* Opening Balance Row */}
              {statement && (
                <tr className="bg-slate-50/50 dark:bg-slate-800/30 font-semibold text-slate-700 dark:text-slate-300">
                  <td className="px-3 py-2 font-mono"><BidiIsolate>{statement.dateRange.startDate}</BidiIsolate></td>
                  <td className="px-2 py-2">-</td>
                  <td className="px-3 py-2 font-mono">-</td>
                  <td className="px-3 py-2 font-bold">{t('statement.openingBalance')}</td>
                  <td className="px-3 py-2 text-end">-</td>
                  <td className="px-3 py-2 text-end">-</td>
                  <td className="px-3 py-2 text-end font-mono font-bold text-slate-900 dark:text-white">
                    <BidiIsolate>{formatCurrency(statement.openingBalance, currency)}</BidiIsolate>
                  </td>
                </tr>
              )}

              {/* Transactions */}
              {!statement || statement.entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic">
                    {t('statement.noTransactions')}
                  </td>
                </tr>
              ) : (
                statement.entries.map((entry, idx) => (
                  <tr key={entry.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-3 py-2 font-mono text-slate-500"><BidiIsolate>{entry.date}</BidiIsolate></td>
                    <td className="px-2 py-2">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          entry.type === 'INVOICE'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        }`}
                      >
                        {entry.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono font-medium text-slate-800 dark:text-slate-200">
                      {entry.referenceNumber}
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300 truncate max-w-[240px]">
                      {entry.description}
                    </td>
                    <td className="px-3 py-2 text-end font-mono text-slate-800 dark:text-slate-200">
                      {entry.debit > 0 ? (
                        <BidiIsolate>{formatCurrency(entry.debit, currency)}</BidiIsolate>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-3 py-2 text-end font-mono text-emerald-600 dark:text-emerald-400">
                      {entry.credit > 0 ? (
                        <BidiIsolate>{formatCurrency(entry.credit, currency)}</BidiIsolate>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-3 py-2 text-end font-mono font-bold text-slate-900 dark:text-white">
                      <BidiIsolate>{formatCurrency(entry.runningBalance, currency)}</BidiIsolate>
                    </td>
                  </tr>
                ))
              )}

              {/* Closing Balance Row */}
              {statement && (
                <tr className="bg-slate-100/60 dark:bg-slate-800/70 font-bold text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-700">
                  <td className="px-3 py-2 font-mono"><BidiIsolate>{statement.dateRange.endDate}</BidiIsolate></td>
                  <td className="px-2 py-2">-</td>
                  <td className="px-3 py-2 font-mono">-</td>
                  <td className="px-3 py-2 uppercase tracking-wider">{t('statement.closingBalance')}</td>
                  <td className="px-3 py-2 text-end font-mono"><BidiIsolate>{formatCurrency(statement.totalInvoiced, currency)}</BidiIsolate></td>
                  <td className="px-3 py-2 text-end font-mono text-emerald-600 dark:text-emerald-400"><BidiIsolate>{formatCurrency(statement.totalPaid, currency)}</BidiIsolate></td>
                  <td className="px-3 py-2 text-end font-mono text-sm text-emerald-600 dark:text-emerald-400 font-extrabold">
                    <BidiIsolate>{formatCurrency(statement.closingBalance, currency)}</BidiIsolate>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Statement Print & Export Modal */}
      {isPrintOpen && statement && (
        <StatementPrintView
          isOpen={isPrintOpen}
          statement={statement}
          onClose={() => setIsPrintOpen(false)}
          onExportCSV={handleExportCSV}
        />
      )}
    </div>
  );
};

export const StatementOfAccount = StatementGenerator;
