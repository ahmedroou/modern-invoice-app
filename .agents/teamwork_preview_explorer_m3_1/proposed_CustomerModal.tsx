/**
 * Proposed Implementation: src/components/modules/customers/CustomerModal.tsx
 * 
 * Accessible CRUD Customer Form Dialog.
 * Responsive: Bottom-sheet on mobile (<640px), centered dialog on desktop.
 * Full Arabic RTL support with <BidiIsolate> for numbers and read-only financial ledger.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  User,
  Phone,
  Mail,
  Building2,
  FileText,
  AlertCircle,
  Archive,
  RefreshCw,
  Trash2,
  Check
} from 'lucide-react';
import { useDirection } from '@/context/DirectionContext';
import { BidiIsolate } from '@/components/common/BidiIsolate';
import type { Customer } from '@/types/domain';
import type { CustomerUpdateInput } from '@/lib/atomicMutations';

export interface CustomerModalProps {
  isOpen: boolean;
  customer?: Customer | null; // null for Create mode, Customer for Edit mode
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  onArchive?: (id: string) => Promise<void>;
  onRestore?: (id: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export const CustomerModal: React.FC<CustomerModalProps> = ({
  isOpen,
  customer,
  onClose,
  onSubmit,
  onArchive,
  onRestore,
  onDelete
}) => {
  const { t, formatCurrency, isRTL } = useDirection();
  const isEdit = Boolean(customer);

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [currency, setCurrency] = useState('SAR');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);

  // Sync state with customer prop on open
  useEffect(() => {
    if (isOpen) {
      if (customer) {
        setName(customer.name || '');
        setPhone(customer.phone || '');
        setEmail(customer.email || '');
        setTaxNumber(customer.taxNumber || '');
        setCurrency(customer.currency || 'SAR');
        setAddress(customer.address || '');
        setNotes(customer.notes || '');
        setStatus(customer.status || 'ACTIVE');
      } else {
        // Reset form for create
        setName('');
        setPhone('');
        setEmail('');
        setTaxNumber('');
        setCurrency('SAR');
        setAddress('');
        setNotes('');
        setStatus('ACTIVE');
      }
      setErrorMessage(null);
      setShowDeleteConfirm(false);

      // Autofocus
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, customer]);

  // Keyboard escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    if (!name.trim() || name.trim().length < 2) {
      setErrorMessage(
        isRTL
          ? 'اسم العميل مطلوب ويجب أن يحتوي على حرفين على الأقل'
          : 'Customer name is required (minimum 2 characters)'
      );
      return false;
    }

    if (email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        setErrorMessage(
          isRTL
            ? 'يرجى إدخال بريد إلكتروني صالح'
            : 'Please enter a valid email address'
        );
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (isEdit && customer) {
        const updates: CustomerUpdateInput = {
          name: name.trim(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          taxNumber: taxNumber.trim() || undefined,
          currency,
          address: address.trim() || undefined,
          notes: notes.trim() || undefined,
          status
        };
        await onSubmit(updates);
      } else {
        await onSubmit({
          name: name.trim(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          taxNumber: taxNumber.trim() || undefined,
          currency,
          address: address.trim() || undefined,
          notes: notes.trim() || undefined,
          status: 'ACTIVE'
        });
      }
      onClose();
    } catch (err: any) {
      console.error('[CustomerModal] Submit failed:', err);
      setErrorMessage(err.message || 'Operation failed. Please check input.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchiveToggle = async () => {
    if (!customer) return;
    setIsSubmitting(true);
    try {
      if (customer.status === 'ARCHIVED' && onRestore) {
        await onRestore(customer.id);
      } else if (onArchive) {
        await onArchive(customer.id);
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to change archive status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!customer || !onDelete) return;
    setIsSubmitting(true);
    try {
      await onDelete(customer.id);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Cannot delete customer with financial history.');
      setShowDeleteConfirm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity select-none"
    >
      {/* Modal Container: Bottom sheet on mobile, rounded card on tablet/desktop */}
      <div
        className="w-full sm:max-w-lg bg-white dark:bg-slate-900 sm:rounded-xl rounded-t-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] sm:max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3
                id="customer-modal-title"
                className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate"
              >
                {isEdit
                  ? isRTL
                    ? 'تعديل بيانات العميل'
                    : 'Edit Customer'
                  : isRTL
                  ? 'إضافة عميل جديد'
                  : 'Add New Customer'}
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                {isEdit
                  ? customer?.id
                    ? <BidiIsolate>ID: {customer.id}</BidiIsolate>
                    : ''
                  : isRTL
                  ? 'سجل عميل جديد في النظام دون اتصال'
                  : 'Register a new customer for invoicing'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Read-only Financial Ledger Banner in Edit Mode */}
        {isEdit && customer && (
          <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800/60 grid grid-cols-3 gap-2 text-center shrink-0">
            <div className="p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <span className="block text-[9px] uppercase tracking-wider font-semibold text-slate-400">
                {isRTL ? 'إجمالي الفواتير' : 'Invoiced'}
              </span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                <BidiIsolate>{formatCurrency(customer.totalInvoiced || 0, customer.currency)}</BidiIsolate>
              </span>
            </div>
            <div className="p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <span className="block text-[9px] uppercase tracking-wider font-semibold text-emerald-600 dark:text-emerald-400">
                {isRTL ? 'المدفوع' : 'Paid'}
              </span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                <BidiIsolate>{formatCurrency(customer.totalPaid || 0, customer.currency)}</BidiIsolate>
              </span>
            </div>
            <div className="p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <span className="block text-[9px] uppercase tracking-wider font-semibold text-amber-600 dark:text-amber-400">
                {isRTL ? 'المستحق' : 'Due'}
              </span>
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 font-mono">
                <BidiIsolate>{formatCurrency(customer.outstandingAmount || 0, customer.currency)}</BidiIsolate>
              </span>
            </div>
          </div>
        )}

        {/* Modal Body & Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {/* Error Banner */}
          {errorMessage && (
            <div
              role="alert"
              className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2 text-rose-700 dark:text-rose-300 text-xs"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Customer Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {isRTL ? 'اسم العميل أو المؤسسة *' : 'Customer Name *'}
            </label>
            <div className="relative">
              <input
                ref={nameInputRef}
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isRTL ? 'مثال: شركة أفق التقنية' : 'e.g. Acme Corporation'}
                className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Phone & Email (2 columns on tablet, 1 on 375px mobile) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isRTL ? 'رقم الهاتف' : 'Phone Number'}
              </label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 absolute start-2.5 top-2.5 text-slate-400" />
                <input
                  type="tel"
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+966 50 123 4567"
                  className="w-full ps-8 pe-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900 dark:text-white text-start font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isRTL ? 'البريد الإلكتروني' : 'Email Address'}
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 absolute start-2.5 top-2.5 text-slate-400" />
                <input
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="billing@example.com"
                  className="w-full ps-8 pe-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900 dark:text-white text-start"
                />
              </div>
            </div>
          </div>

          {/* Tax Number & Currency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isRTL ? 'الرقم الضريبي (VAT)' : 'Tax / VAT Number'}
              </label>
              <div className="relative">
                <Building2 className="w-3.5 h-3.5 absolute start-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  dir="ltr"
                  value={taxNumber}
                  onChange={(e) => setTaxNumber(e.target.value)}
                  placeholder="300012345600003"
                  className="w-full ps-8 pe-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900 dark:text-white text-start font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isRTL ? 'العملة الافتراضية' : 'Default Currency'}
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900 dark:text-white"
              >
                <option value="SAR">SAR (ر.س - Saudi Riyal)</option>
                <option value="USD">USD ($ - US Dollar)</option>
                <option value="EUR">EUR (€ - Euro)</option>
                <option value="AED">AED (د.إ - UAE Dirham)</option>
                <option value="GBP">GBP (£ - British Pound)</option>
              </select>
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {isRTL ? 'العنوان' : 'Address'}
            </label>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={isRTL ? 'الرياض، المملكة العربية السعودية' : 'Street address, City, Country'}
              className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900 dark:text-white resize-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {isRTL ? 'ملاحظات إضافية' : 'Internal Notes'}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isRTL ? 'شروط خاصة أو تعليمات تسليم...' : 'Payment terms or specific preferences...'}
              className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900 dark:text-white resize-none"
            />
          </div>

          {/* Status (Edit mode only) */}
          {isEdit && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {isRTL ? 'حالة الحساب' : 'Account Status'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStatus('ACTIVE')}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                    status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {isRTL ? 'نشط' : 'Active'}
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('ARCHIVED')}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                    status === 'ARCHIVED'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {isRTL ? 'مؤرشف' : 'Archived'}
                </button>
              </div>
            </div>
          )}

          {/* Delete Confirmation Warning Box */}
          {showDeleteConfirm && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 space-y-2">
              <p className="text-xs font-semibold text-rose-800 dark:text-rose-200">
                {isRTL
                  ? 'هل أنت متأكد من رغبتك بحذف هذا العميل نهائياً؟'
                  : 'Permanently delete this customer?'}
              </p>
              <p className="text-[11px] text-rose-600 dark:text-rose-400">
                {isRTL
                  ? 'ملاحظة: لا يمكن حذف العميل إذا كان لديه فواتير مسجلة. يمكنك أرشفته بدلاً من ذلك.'
                  : 'Cannot delete customer if invoices or balance exist. Archiving is recommended.'}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  className="px-2.5 py-1 text-xs font-bold rounded bg-rose-600 text-white hover:bg-rose-700"
                >
                  {isRTL ? 'نعم، احذف' : 'Yes, Delete'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-2.5 py-1 text-xs rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </div>
          )}
        </form>

        {/* Modal Footer Actions */}
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
          {/* Left: Secondary actions (Archive / Delete) */}
          <div className="flex items-center gap-1.5">
            {isEdit && customer && (
              <>
                <button
                  type="button"
                  onClick={handleArchiveToggle}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  title={customer.status === 'ARCHIVED' ? 'Restore customer' : 'Archive customer'}
                >
                  {customer.status === 'ARCHIVED' ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{isRTL ? 'استعادة' : 'Restore'}</span>
                    </>
                  ) : (
                    <>
                      <Archive className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{isRTL ? 'أرشفة' : 'Archive'}</span>
                    </>
                  )}
                </button>

                {onDelete && !showDeleteConfirm && (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isSubmitting}
                    className="p-1.5 text-xs text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 rounded hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors"
                    title="Delete customer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            )}
          </div>

          {/* Right: Cancel & Submit buttons */}
          <div className="flex items-center gap-2 ms-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-md transition-colors"
            >
              {t('action.cancel')}
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 rounded-md shadow-xs transition-colors"
            >
              {isSubmitting ? (
                <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>
                {isEdit
                  ? isRTL
                    ? 'حفظ التعديلات'
                    : 'Save Changes'
                  : isRTL
                  ? 'تسجيل العميل'
                  : 'Create Customer'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
