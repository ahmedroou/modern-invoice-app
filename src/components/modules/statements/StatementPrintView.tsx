/**
 * Printable Statement of Account Layout
 * 
 * Target: src/components/modules/statements/StatementPrintView.tsx
 * 
 * Strict specifications:
 * - High contrast: forces clean white background and dark typography in print.
 * - Repeats table header across printed pages with thead display: table-header-group.
 * - Hides all interactive buttons and UI navigation on print (@media print).
 * - Full Arabic RTL layout support with Cairo/Tajawal fonts and <BidiIsolate>.
 */

import React from 'react';
import { X, Printer, Download } from 'lucide-react';
import { useDirection } from '@/context/DirectionContext';
import { BidiIsolate } from '@/components/common/BidiIsolate';
import type { StatementSummary } from '@/types/domain';

export interface StatementPrintViewProps {
  isOpen: boolean;
  statement: StatementSummary | null;
  onClose: () => void;
  onExportCSV?: () => void;
}

export const StatementPrintView: React.FC<StatementPrintViewProps> = ({
  isOpen,
  statement,
  onClose,
  onExportCSV
}) => {
  const { t, formatCurrency } = useDirection();

  if (!isOpen || !statement) return null;

  const currency = statement.customer.currency || 'SAR';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto"
    >
      {/* Container - on screen it is an A4 modal, on print it fills the entire page */}
      <div
        className="relative w-full max-w-4xl bg-white text-slate-900 shadow-2xl rounded-none sm:rounded-xl overflow-hidden my-auto max-h-[96vh] flex flex-col print:max-h-none print:shadow-none print:m-0 print:p-0 print:border-none print:rounded-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Screen-Only Control Toolbar (Hidden in Print) */}
        <div className="print:hidden flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-emerald-600" />
            <span className="text-xs sm:text-sm font-bold text-slate-800">
              {t('statement.title')} — {statement.customer.name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onExportCSV && (
              <button
                type="button"
                onClick={onExportCSV}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg shadow-2xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t('statement.exportCsv')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{t('action.print')}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-white font-sans text-slate-900 print:overflow-visible print:p-8">
          {/* Company & Statement Header */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-6 mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight">
                {t('statement.title')}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('statement.subtitle')}
              </p>
              <div className="mt-3 text-xs text-slate-600 space-y-0.5">
                <p className="font-semibold text-slate-800">{t('app.name')}</p>
                <p>Tax Registration: 300123456700003</p>
                <p>Riyadh, Kingdom of Saudi Arabia</p>
              </div>
            </div>

            <div className="text-end text-xs space-y-1">
              <div className="inline-block px-3 py-1 rounded bg-slate-100 border border-slate-200 font-mono text-[11px] font-semibold text-slate-700 mb-2">
                <BidiIsolate>{statement.dateRange.startDate} → {statement.dateRange.endDate}</BidiIsolate>
              </div>
              <p className="text-slate-500">
                Generated: <span className="font-mono text-slate-800">{new Date(statement.generatedAt).toLocaleDateString()}</span>
              </p>
              <p className="text-slate-500">
                Currency: <span className="font-mono font-bold text-slate-800">{currency}</span>
              </p>
            </div>
          </div>

          {/* Customer Account Summary Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/80 rounded-lg p-4 border border-slate-200 mb-6 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider mb-1">
                Customer Account
              </span>
              <h2 className="text-sm font-bold text-slate-900">{statement.customer.name}</h2>
              {statement.customer.taxNumber && (
                <p className="text-slate-600 mt-0.5">Tax ID: {statement.customer.taxNumber}</p>
              )}
              {statement.customer.email && (
                <p className="text-slate-600">{statement.customer.email}</p>
              )}
              {statement.customer.phone && (
                <p className="text-slate-600 font-mono"><BidiIsolate>{statement.customer.phone}</BidiIsolate></p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-end self-center sm:border-s sm:border-slate-200 sm:ps-4">
              <div>
                <span className="text-[10px] text-slate-500 block">{t('statement.openingBalance')}</span>
                <span className="font-mono font-bold text-xs text-slate-800">
                  <BidiIsolate>{formatCurrency(statement.openingBalance, currency)}</BidiIsolate>
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">{t('statement.closingBalance')}</span>
                <span className="font-mono font-bold text-sm text-emerald-700">
                  <BidiIsolate>{formatCurrency(statement.closingBalance, currency)}</BidiIsolate>
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <span className="text-[10px] text-slate-500 block">{t('statement.debit')}</span>
                <span className="font-mono font-semibold text-xs text-slate-800">
                  <BidiIsolate>{formatCurrency(statement.totalInvoiced, currency)}</BidiIsolate>
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <span className="text-[10px] text-slate-500 block">{t('statement.credit')}</span>
                <span className="font-mono font-semibold text-xs text-emerald-600">
                  <BidiIsolate>{formatCurrency(statement.totalPaid, currency)}</BidiIsolate>
                </span>
              </div>
            </div>
          </div>

          {/* Ledger Table with repeating header across pages */}
          <div className="border border-slate-200 rounded-lg overflow-hidden mb-6">
            <table className="w-full text-xs text-start border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 print:table-header-group">
                <tr>
                  <th className="px-3 py-2 text-start w-24">Date</th>
                  <th className="px-2 py-2 text-start w-20">Type</th>
                  <th className="px-2.5 py-2 text-start w-28">Ref #</th>
                  <th className="px-3 py-2 text-start">Description</th>
                  <th className="px-2.5 py-2 text-end w-24">{t('statement.debit')}</th>
                  <th className="px-2.5 py-2 text-end w-24">{t('statement.credit')}</th>
                  <th className="px-3 py-2 text-end w-28">{t('statement.runningBalance')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {/* Opening Balance Row */}
                <tr className="bg-slate-50/60 font-semibold text-slate-700">
                  <td className="px-3 py-2 font-mono"><BidiIsolate>{statement.dateRange.startDate}</BidiIsolate></td>
                  <td className="px-2 py-2">-</td>
                  <td className="px-2.5 py-2 font-mono">-</td>
                  <td className="px-3 py-2 font-bold">{t('statement.openingBalance')}</td>
                  <td className="px-2.5 py-2 text-end">-</td>
                  <td className="px-2.5 py-2 text-end">-</td>
                  <td className="px-3 py-2 text-end font-mono font-bold text-slate-900">
                    <BidiIsolate>{formatCurrency(statement.openingBalance, currency)}</BidiIsolate>
                  </td>
                </tr>

                {/* Ledger Entries */}
                {statement.entries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic">
                      {t('statement.noTransactions')}
                    </td>
                  </tr>
                ) : (
                  statement.entries.map((entry, idx) => (
                    <tr key={entry.id || idx} className="print:break-inside-avoid hover:bg-slate-50/40">
                      <td className="px-3 py-2 font-mono text-slate-600"><BidiIsolate>{entry.date}</BidiIsolate></td>
                      <td className="px-2 py-2">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            entry.type === 'INVOICE'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {entry.type}
                        </span>
                      </td>
                      <td className="px-2.5 py-2 font-mono font-medium text-slate-800">{entry.referenceNumber}</td>
                      <td className="px-3 py-2 text-slate-700 max-w-[200px] truncate">{entry.description}</td>
                      <td className="px-2.5 py-2 text-end font-mono text-slate-800">
                        {entry.debit > 0 ? (
                          <BidiIsolate>{formatCurrency(entry.debit, currency)}</BidiIsolate>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-2.5 py-2 text-end font-mono text-emerald-600">
                        {entry.credit > 0 ? (
                          <BidiIsolate>{formatCurrency(entry.credit, currency)}</BidiIsolate>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-3 py-2 text-end font-mono font-bold text-slate-900">
                        <BidiIsolate>{formatCurrency(entry.runningBalance, currency)}</BidiIsolate>
                      </td>
                    </tr>
                  ))
                )}

                {/* Closing Balance Row */}
                <tr className="bg-slate-100/70 font-bold text-slate-900 border-t-2 border-slate-300">
                  <td className="px-3 py-2.5 font-mono"><BidiIsolate>{statement.dateRange.endDate}</BidiIsolate></td>
                  <td className="px-2 py-2.5">-</td>
                  <td className="px-2.5 py-2.5 font-mono">-</td>
                  <td className="px-3 py-2.5 uppercase tracking-wider">{t('statement.closingBalance')}</td>
                  <td className="px-2.5 py-2.5 text-end font-mono"><BidiIsolate>{formatCurrency(statement.totalInvoiced, currency)}</BidiIsolate></td>
                  <td className="px-2.5 py-2.5 text-end font-mono text-emerald-600"><BidiIsolate>{formatCurrency(statement.totalPaid, currency)}</BidiIsolate></td>
                  <td className="px-3 py-2.5 text-end font-mono text-sm text-emerald-700 font-black">
                    <BidiIsolate>{formatCurrency(statement.closingBalance, currency)}</BidiIsolate>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Signature & Remittance Section */}
          <div className="grid grid-cols-2 gap-8 pt-8 mt-8 border-t border-slate-200 text-xs text-slate-600 print:break-inside-avoid">
            <div>
              <p className="font-semibold text-slate-800 mb-1">Payment Remittance Details:</p>
              <p>Bank: Saudi National Bank (SNB)</p>
              <p>IBAN: SA03 8000 0000 6080 1016 7519</p>
              <p>Account: Modern Invoice Enterprise Solutions</p>
            </div>
            <div className="text-end">
              <div className="inline-block text-center border-t border-slate-400 pt-2 w-48 mt-6">
                <p className="font-semibold text-slate-800">Authorized Signature</p>
                <p className="text-[10px] text-slate-400">Finance & Accounting Dept.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
