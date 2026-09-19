/**
 * Detailed View Modal for Invoices
 * 
 * Target: src/components/modules/invoices/InvoiceDetail.tsx
 * Displays full itemized invoice breakdown, financial balances, payment status,
 * and triggers actions for Recording Payment, Editing, Cancelling, and PDF Printing.
 */

import React, { useState } from 'react';
import {
  X,
  Printer,
  Edit2,
  Ban,
  CreditCard,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { useDirection } from '@/context/DirectionContext';
import { BidiIsolate } from '@/components/common/BidiIsolate';
import type { Invoice, InvoiceStatus } from '@/types/domain';

export interface InvoiceDetailProps {
  isOpen: boolean;
  invoice: Invoice | null;
  onClose: () => void;
  onEdit?: (invoice: Invoice) => void;
  onCancel?: (invoiceId: string, invoice: Invoice) => Promise<void>;
  onRecordPayment?: (invoice: Invoice) => void;
}

export const InvoiceDetail: React.FC<InvoiceDetailProps> = ({
  isOpen,
  invoice,
  onClose,
  onEdit,
  onCancel,
  onRecordPayment
}) => {
  const { t, formatCurrency } = useDirection();
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  if (!isOpen || !invoice) return null;

  const currency = invoice.currency || 'SAR';
  const isPaid = invoice.status === 'PAID' || invoice.amountDue <= 0.0001;
  const isCancelled = invoice.status === 'CANCELLED';

  const handlePrint = async () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.printInvoicePDF) {
      try {
        await (window as any).electronAPI.printInvoicePDF({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber
        });
      } catch (e) {
        console.warn('Native PDF print error, falling back to window.print()', e);
        window.print();
      }
    } else {
      window.print();
    }
  };

  const handleConfirmCancel = async () => {
    if (!onCancel) return;
    setIsCancelling(true);
    try {
      await onCancel(invoice.id, invoice);
      setShowCancelConfirm(false);
      onClose();
    } catch (err) {
      console.error('[InvoiceDetail] Failed to cancel invoice:', err);
    } finally {
      setIsCancelling(false);
    }
  };

  const getStatusBadge = (status: InvoiceStatus) => {
    switch (status) {
      case 'PAID':
        return (
          <span data-testid="invoice-status-badge" className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3" />
            {t('status.paid')}
          </span>
        );
      case 'PARTIALLY_PAID':
        return (
          <span data-testid="invoice-status-badge" className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3 h-3" />
            {t('status.partiallyPaid')}
          </span>
        );
      case 'OVERDUE':
        return (
          <span data-testid="invoice-status-badge" className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <AlertTriangle className="w-3 h-3" />
            {t('status.overdue')}
          </span>
        );
      case 'CANCELLED':
        return (
          <span data-testid="invoice-status-badge" className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            <Ban className="w-3 h-3" />
            {t('status.cancelled')}
          </span>
        );
      case 'DRAFT':
        return (
          <span data-testid="invoice-status-badge" className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            <Clock className="w-3 h-3" />
            {t('status.draft')}
          </span>
        );
      default:
        return (
          <span data-testid="invoice-status-badge" className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <Clock className="w-3 h-3" />
            {t('status.unpaid')}
          </span>
        );
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invoice-detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div
        data-testid="invoice-detail-modal"
        className="relative w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="invoice-detail-title" className="text-base sm:text-lg font-bold font-mono text-slate-900 dark:text-white">
                  {invoice.invoiceNumber}
                </h2>
                {getStatusBadge(invoice.status)}
              </div>
              <p className="text-xs text-slate-500">{invoice.customerName}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrint}
              title={t('action.print')}
              className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs sm:text-sm">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700/60">
            <div>
              <span className="text-[11px] text-slate-500 block">{t('invoice.customer')}</span>
              <span className="font-semibold text-slate-900 dark:text-white truncate block">{invoice.customerName}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">{t('invoice.issueDate')}</span>
              <span className="font-mono text-slate-800 dark:text-slate-200"><BidiIsolate>{invoice.issueDate}</BidiIsolate></span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">{t('invoice.dueDate')}</span>
              <span className="font-mono text-slate-800 dark:text-slate-200"><BidiIsolate>{invoice.dueDate}</BidiIsolate></span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">{t('invoice.amountDue')}</span>
              <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                <BidiIsolate>{formatCurrency(invoice.amountDue, currency)}</BidiIsolate>
              </span>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-3 py-2 text-start">{t('invoice.description')}</th>
                  <th className="px-2 py-2 text-end">{t('invoice.qty')}</th>
                  <th className="px-2 py-2 text-end">{t('invoice.unitPrice')}</th>
                  <th className="px-2 py-2 text-end">{t('invoice.discount')}</th>
                  <th className="px-2 py-2 text-end">{t('invoice.tax')}</th>
                  <th className="px-3 py-2 text-end">{t('invoice.total')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {invoice.items?.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="px-3 py-2 font-medium text-slate-900 dark:text-white">{item.description}</td>
                    <td className="px-2 py-2 text-end font-mono"><BidiIsolate>{item.quantity}</BidiIsolate></td>
                    <td className="px-2 py-2 text-end font-mono"><BidiIsolate>{formatCurrency(item.unitPrice, currency)}</BidiIsolate></td>
                    <td className="px-2 py-2 text-end font-mono text-slate-500">
                      {item.lineDiscount > 0 ? (
                        <BidiIsolate>-{formatCurrency(item.lineDiscount, currency)}</BidiIsolate>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-2 py-2 text-end font-mono text-slate-500">
                      <BidiIsolate>{formatCurrency(item.lineTax, currency)}</BidiIsolate>
                    </td>
                    <td className="px-3 py-2 text-end font-mono font-bold text-slate-900 dark:text-white">
                      <BidiIsolate>{formatCurrency(item.lineTotal, currency)}</BidiIsolate>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Breakdown Section */}
          <div className="flex justify-end">
            <div className="w-full sm:w-72 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700/60 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>{t('invoice.subtotal')}</span>
                <span className="font-mono font-semibold"><BidiIsolate>{formatCurrency(invoice.subtotal, currency)}</BidiIsolate></span>
              </div>
              {invoice.totalDiscount > 0 && (
                <div className="flex justify-between text-rose-600 dark:text-rose-400">
                  <span>{t('invoice.totalDiscount')}</span>
                  <span className="font-mono font-semibold">-<BidiIsolate>{formatCurrency(invoice.totalDiscount, currency)}</BidiIsolate></span>
                </div>
              )}
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>{t('invoice.totalTax')}</span>
                <span className="font-mono font-semibold"><BidiIsolate>{formatCurrency(invoice.totalTax, currency)}</BidiIsolate></span>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between font-bold text-slate-900 dark:text-white text-sm">
                <span>{t('invoice.grandTotal')}</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400"><BidiIsolate>{formatCurrency(invoice.grandTotal, currency)}</BidiIsolate></span>
              </div>
              <div className="flex justify-between text-slate-500 text-xs pt-1">
                <span>{t('invoice.amountPaid')}</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400"><BidiIsolate>{formatCurrency(invoice.amountPaid || 0, currency)}</BidiIsolate></span>
              </div>
              <div className="flex justify-between font-bold text-xs pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                <span className="text-rose-600 dark:text-rose-400">{t('invoice.amountDue')}</span>
                <span data-testid="remaining-amount" className="font-mono text-rose-600 dark:text-rose-400"><BidiIsolate>{formatCurrency(invoice.amountDue, currency)}</BidiIsolate></span>
              </div>
            </div>
          </div>

          {/* Notes or Terms */}
          {invoice.notes && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">{t('payment.notes')}</span>
              <p className="text-slate-600 dark:text-slate-400">{invoice.notes}</p>
            </div>
          )}

          {/* Cancel Confirmation Prompt */}
          {showCancelConfirm && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg space-y-2">
              <p className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                {t('invoice.cancelConfirm')}
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(false)}
                  className="px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
                >
                  {t('action.cancel')}
                </button>
                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={handleConfirmCancel}
                  className="px-2.5 py-1 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded"
                >
                  {isCancelling ? t('sync.syncing') : t('action.delete', 'Confirm Cancel')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            {!isCancelled && onCancel && (
              <button
                type="button"
                onClick={() => setShowCancelConfirm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg border border-rose-200 dark:border-rose-800/60 transition-colors"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>{t('invoice.cancelInvoice')}</span>
              </button>
            )}

            {!isCancelled && !isPaid && onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(invoice);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>{t('action.edit')}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isCancelled && !isPaid && onRecordPayment && (
              <button
                type="button"
                data-testid="record-payment-btn"
                onClick={() => {
                  onClose();
                  onRecordPayment(invoice);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>{t('action.recordPayment')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              {t('action.cancel', 'Close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
