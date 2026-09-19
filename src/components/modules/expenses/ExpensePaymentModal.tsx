import React, { useState, useEffect } from 'react';
import { X, ArrowDownRight } from 'lucide-react';
import { useDirection } from '@/context/DirectionContext';
import type { ExpenseBill, PaymentMethod, Vendor } from '@/types/domain';
import type { ExpensePaymentInput } from '@/hooks/useExpensePayments';

export interface ExpensePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ExpensePaymentInput, bill?: ExpenseBill) => Promise<void>;
  bill?: ExpenseBill | null;
  vendors?: Vendor[];
}

export const ExpensePaymentModal: React.FC<ExpensePaymentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  bill,
  vendors = []
}) => {
  const { language } = useDirection();
  const isAr = language === 'ar';

  const todayStr = new Date().toISOString().split('T')[0];

  const [vendorId, setVendorId] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState(todayStr);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (bill) {
      setVendorId(bill.vendorId);
      setVendorName(bill.vendorName);
      setAmount(bill.amountDue > 0 ? bill.amountDue : bill.grandTotal);
    } else if (vendors.length > 0) {
      setVendorId(vendors[0].id);
      setVendorName(vendors[0].name);
      setAmount(vendors[0].outstandingBalance > 0 ? vendors[0].outstandingBalance : 0);
    } else {
      setVendorId('');
      setVendorName('');
      setAmount(0);
    }
    setPaymentDate(todayStr);
    setPaymentMethod('BANK_TRANSFER');
    setReferenceNumber('');
    setNotes('');
    setError(null);
  }, [bill, isOpen, vendors]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!vendorName.trim()) {
      setError(isAr ? 'يرجى تحديد الجهة المستحقة' : 'Vendor name is required');
      return;
    }
    if (amount <= 0) {
      setError(isAr ? 'مبلغ السداد يجب أن يكون أكبر من صفر' : 'Payment amount must be greater than zero');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(
        {
          billId: bill?.id,
          billNumber: bill?.billNumber,
          vendorId: vendorId || 'unknown_vendor',
          vendorName: vendorName.trim(),
          amount: Number(amount),
          paymentDate,
          paymentMethod,
          referenceNumber: referenceNumber.trim() || undefined,
          notes: notes.trim() || undefined
        },
        bill || undefined
      );
      onClose();
    } catch (err: any) {
      setError(err?.message || (isAr ? 'فشل تسجيل سند الصرف' : 'Failed to record payment voucher'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <ArrowDownRight className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isAr ? 'إصدار سند صرف / سداد دفعة' : 'Record Payment Voucher'}
              </h3>
              {bill && (
                <p className="text-[11px] text-slate-500 font-mono">
                  {isAr ? `فاتورة: ${bill.billNumber}` : `Bill: ${bill.billNumber}`}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-3">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-400 font-medium">
              {error}
            </div>
          )}

          {/* If linked to bill, show summary card */}
          {bill && (
            <div className="p-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 text-xs space-y-1">
              <div className="flex justify-between font-medium text-slate-700 dark:text-slate-300">
                <span>{isAr ? 'الجهة المستحقة:' : 'Payee:'}</span>
                <span className="font-bold text-slate-900 dark:text-white">{bill.vendorName}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>{isAr ? 'المتبقي المستحق:' : 'Remaining Due:'}</span>
                <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                  {bill.amountDue.toFixed(2)} {bill.currency}
                </span>
              </div>
            </div>
          )}

          {/* Payee Selection if not linked to bill */}
          {!bill && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isAr ? 'الجهة أو المورد المستحق *' : 'Payee / Vendor *'}
              </label>
              {vendors.length > 0 ? (
                <select
                  value={vendorId}
                  onChange={(e) => {
                    setVendorId(e.target.value);
                    const v = vendors.find((x) => x.id === e.target.value);
                    if (v) {
                      setVendorName(v.name);
                      if (v.outstandingBalance > 0) setAmount(v.outstandingBalance);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">{isAr ? '-- اختر الجهة المستحقة --' : '-- Select Payee --'}</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} (المستحق: {v.outstandingBalance} {v.currency})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  required
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder={isAr ? 'اسم المستفيد أو المورد' : 'Payee name'}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              )}
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {isAr ? 'المبلغ المدفوع *' : 'Payment Amount *'}
            </label>
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              value={amount || ''}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 text-sm font-bold font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Payment Method & Date */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isAr ? 'طريقة الصرف' : 'Payment Method'}
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="BANK_TRANSFER">{isAr ? 'تحويل بنكي' : 'Bank Transfer'}</option>
                <option value="CASH">{isAr ? 'نقدي (كاش)' : 'Cash'}</option>
                <option value="CHECK">{isAr ? 'شيك بنكي' : 'Check'}</option>
                <option value="CREDIT_CARD">{isAr ? 'بطاقة ائتمان / سداد' : 'Card / POS'}</option>
                <option value="OTHER">{isAr ? 'أخرى' : 'Other'}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isAr ? 'تاريخ السداد' : 'Payment Date'}
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Reference / Check Number */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {isAr ? 'رقم الحوالة / رقم الشيك / المرجع' : 'Reference / Check #'}
            </label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder={isAr ? 'مثال: رقم العملية البنكية' : 'e.g. TR-89410'}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {isAr ? 'ملاحظات وتفاصيل السند' : 'Notes'}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isAr ? 'تفاصيل سند الصرف أو بنود الصرف...' : 'Payment details...'}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-colors disabled:opacity-50"
            >
              {isSubmitting
                ? (isAr ? 'جارٍ التسجيل...' : 'Saving...')
                : (isAr ? 'تسجيل سند الصرف' : 'Confirm Payment')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
