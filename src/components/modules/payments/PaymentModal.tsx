/**
 * Record Payment Modal Dialog
 * 
 * Target: src/components/modules/payments/PaymentModal.tsx
 * 
 * Features & Invariants:
 * - Overpayment validation: rejects amount > amountDue ("Payment cannot exceed amount due").
 * - Zero/negative validation: rejects amount <= 0 ("Payment amount must be greater than 0.00").
 * - Status check: rejects if invoice is CANCELLED or already PAID.
 * - Quick-fill buttons: "100% Full" and "50%".
 * - Payment method selection: Cash, Bank Transfer, Credit Card, Check, Online Gateway, Other.
 * - Atomic writeBatch execution via usePayments.recordPayment().
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  CreditCard,
  AlertCircle,
  Check,
  Landmark,
  Wallet,
  Receipt,
  Globe,
  MoreHorizontal
} from 'lucide-react';
import { useDirection } from '@/context/DirectionContext';
import { usePayments } from '@/hooks/usePayments';
import { BidiIsolate } from '@/components/common/BidiIsolate';
import { roundFinancial } from '@/lib/calculations';
import type { Invoice, PaymentMethod } from '@/types/domain';

export interface PaymentModalProps {
  isOpen: boolean;
  invoice: Invoice | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const PAYMENT_METHODS: { id: PaymentMethod; labelKey: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'CASH', labelKey: 'payment.cash', icon: Wallet },
  { id: 'BANK_TRANSFER', labelKey: 'payment.bankTransfer', icon: Landmark },
  { id: 'CREDIT_CARD', labelKey: 'payment.creditCard', icon: CreditCard },
  { id: 'CHECK', labelKey: 'payment.check', icon: Receipt },
  { id: 'ONLINE_GATEWAY', labelKey: 'payment.online', icon: Globe },
  { id: 'OTHER', labelKey: 'payment.other', icon: MoreHorizontal }
];

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  invoice,
  onClose,
  onSuccess
}) => {
  const { t, formatCurrency } = useDirection();
  const { recordPayment, getNextPaymentNumber } = usePayments();

  // Form state
  const [amount, setAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const amountInputRef = useRef<HTMLInputElement>(null);

  // Initialize on open
  useEffect(() => {
    if (!isOpen || !invoice) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const initialDue = invoice.amountDue > 0 ? invoice.amountDue.toFixed(2) : '0.00';

    setAmount(initialDue);
    setPaymentDate(todayStr);
    setPaymentMethod('BANK_TRANSFER');
    setReferenceNumber('');
    setNotes('');
    setErrorMessage(null);
    setIsSubmitting(false);

    setTimeout(() => {
      amountInputRef.current?.focus();
      amountInputRef.current?.select();
    }, 50);
  }, [isOpen, invoice]);

  if (!isOpen || !invoice) return null;

  const currency = invoice.currency || 'SAR';
  const maxDue = invoice.amountDue || 0;
  const numAmount = Number(amount);

  // Quick-fill actions
  const handleSetFullAmount = () => {
    setAmount(maxDue.toFixed(2));
    setErrorMessage(null);
  };

  const handleSetHalfAmount = () => {
    const half = roundFinancial(maxDue / 2);
    setAmount(half.toFixed(2));
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Financial validations
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMessage('Payment amount must be greater than 0.00');
      amountInputRef.current?.focus();
      return;
    }

    if (numAmount > maxDue + 0.0001) {
      setErrorMessage('Payment cannot exceed amount due');
      amountInputRef.current?.focus();
      return;
    }

    if (invoice.status === 'CANCELLED') {
      setErrorMessage('Cannot record payment on a cancelled invoice');
      return;
    }

    if (invoice.status === 'PAID' || maxDue <= 0.0001) {
      setErrorMessage('Invoice is already fully paid');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const paymentNumber = getNextPaymentNumber();

      await recordPayment({
        payment: {
          paymentNumber,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          customerId: invoice.customerId,
          customerName: invoice.customerName,
          amount: roundFinancial(numAmount),
          paymentDate,
          paymentMethod,
          referenceNumber: referenceNumber.trim() || undefined,
          notes: notes.trim() || undefined
        },
        currentInvoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          grandTotal: invoice.grandTotal,
          amountPaid: invoice.amountPaid || 0,
          amountDue: invoice.amountDue,
          status: invoice.status,
          customerId: invoice.customerId,
          customerName: invoice.customerName,
          dueDate: invoice.dueDate
        }
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[PaymentModal] Error recording payment:', err);
      setErrorMessage(err.message || 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div
        data-testid="payment-modal"
        className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50">
              <CreditCard className="w-4 h-4" />
            </div>
            <h2 id="payment-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
              {t('payment.recordPayment')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form noValidate onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 text-xs sm:text-sm">
          {errorMessage && (
            <div
              data-testid="payment-error-alert"
              className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-lg flex items-center gap-2 text-rose-700 dark:rose-300 text-xs"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Invoice Summary Header */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700/60 space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {invoice.invoiceNumber}
              </span>
              <span className="text-slate-600 dark:text-slate-300 truncate max-w-[180px]">
                {invoice.customerName}
              </span>
            </div>

            <div className="flex justify-between items-center pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
              <span className="text-slate-500">{t('invoice.amountDue')}:</span>
              <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                <BidiIsolate>{formatCurrency(maxDue, currency)}</BidiIsolate>
              </span>
            </div>
          </div>

          {/* Amount Field with Quick-fill buttons */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('payment.amount')} ({currency}) *
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSetHalfAmount}
                  className="px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                >
                  {t('payment.halfAmount', '50%')}
                </button>
                <button
                  type="button"
                  onClick={handleSetFullAmount}
                  className="px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 rounded transition-colors"
                >
                  {t('payment.fullAmount', '100% Full')}
                </button>
              </div>
            </div>

            <input
              ref={amountInputRef}
              data-testid="payment-amount-input"
              type="number"
              step="0.01"
              min="0.01"
              max={maxDue}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setErrorMessage(null);
              }}
              className="w-full px-3 py-2 font-mono text-base font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white text-end"
            />
          </div>

          {/* Payment Method Selector Pills */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('payment.method')} *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {PAYMENT_METHODS.map((pm) => {
                const Icon = pm.icon;
                const isSelected = paymentMethod === pm.id;
                return (
                  <button
                    key={pm.id}
                    type="button"
                    data-testid={`payment-method-${pm.id}`}
                    onClick={() => setPaymentMethod(pm.id)}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-semibold transition-all ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 shadow-2xs'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{t(pm.labelKey)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payment Date & Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('payment.date')} *
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('payment.reference', 'Reference #')}
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="TXN-98765 / Check #101"
                className="w-full px-3 py-1.5 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('payment.notes')}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Payment notes or receipt remarks..."
              className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              {t('action.cancel')}
            </button>
            <button
              type="submit"
              data-testid="confirm-payment-btn"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow-sm transition-all"
            >
              {isSubmitting ? (
                <span>{t('sync.syncing')}</span>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{t('action.recordPayment')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
