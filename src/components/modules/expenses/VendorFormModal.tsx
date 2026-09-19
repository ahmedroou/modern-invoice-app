import React, { useState, useEffect } from 'react';
import { X, Building2 } from 'lucide-react';
import { useDirection } from '@/context/DirectionContext';
import type { Vendor } from '@/types/domain';

export interface VendorFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (vendorData: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt' | 'totalBilled' | 'totalPaid' | 'outstandingBalance'>) => Promise<void>;
  vendor?: Vendor | null;
}

export const VendorFormModal: React.FC<VendorFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  vendor
}) => {
  const { language } = useDirection();
  const isAr = language === 'ar';

  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [category, setCategory] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [currency, setCurrency] = useState('SAR');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (vendor) {
      setName(vendor.name || '');
      setCompany(vendor.company || '');
      setCategory(vendor.category || '');
      setPhone(vendor.phone || '');
      setEmail(vendor.email || '');
      setAddress(vendor.address || '');
      setTaxNumber(vendor.taxNumber || '');
      setNotes(vendor.notes || '');
      setCurrency(vendor.currency || 'SAR');
    } else {
      setName('');
      setCompany('');
      setCategory('');
      setPhone('');
      setEmail('');
      setAddress('');
      setTaxNumber('');
      setNotes('');
      setCurrency('SAR');
    }
    setError(null);
  }, [vendor, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(isAr ? 'يرجى إدخال اسم المورد أو الجهة' : 'Vendor name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        company: company.trim() || undefined,
        category: category.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        taxNumber: taxNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        currency,
        status: vendor?.status || 'ACTIVE'
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || (isAr ? 'فشل حفظ بيانات المورد' : 'Failed to save vendor'));
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
            <Building2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {vendor
                ? (isAr ? 'تعديل بيانات المورد / الجهة' : 'Edit Vendor')
                : (isAr ? 'إضافة مورد أو جهة مستحقة جديدة' : 'Add New Vendor')}
            </h3>
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

          {/* Name (Required) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {isAr ? 'اسم المورد أو الجهة *' : 'Vendor / Payee Name *'}
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isAr ? 'مثال: شركة التوريدات الحديثة / فني صيانة' : 'e.g. Modern Supplies LLC'}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              autoFocus
            />
          </div>

          {/* Company & Category */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isAr ? 'اسم الشركة / المؤسسة' : 'Company'}
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder={isAr ? 'اسم الشركة إن وجد' : 'Company name'}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isAr ? 'تصنيف النشاط' : 'Category'}
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder={isAr ? 'مثال: بضائع / إيجار / خدمات' : 'Goods / Rent / Utilities'}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Phone & Email */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isAr ? 'رقم الهاتف / الجوال' : 'Phone'}
              </label>
              <div className="relative">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="05XXXXXXXX"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  dir="ltr"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isAr ? 'البريد الإلكتروني' : 'Email'}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vendor@example.com"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                dir="ltr"
              />
            </div>
          </div>

          {/* Tax Number & Currency */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isAr ? 'الرقم الضريبي' : 'Tax / VAT Number'}
              </label>
              <input
                type="text"
                value={taxNumber}
                onChange={(e) => setTaxNumber(e.target.value)}
                placeholder="3XXXXXXXXXXXXXX"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isAr ? 'العملة' : 'Currency'}
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="SAR">SAR (ريال سعودي)</option>
                <option value="USD">USD ($)</option>
                <option value="AED">AED (درهم إماراتي)</option>
                <option value="EGP">EGP (جنيه مصري)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {isAr ? 'العنوان' : 'Address'}
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={isAr ? 'المدينة، الحي، الشارع' : 'City, Street'}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {isAr ? 'ملاحظات إضافية' : 'Notes'}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isAr ? 'أي بيانات أو شروط دفع متفق عليها...' : 'Payment terms, account numbers...'}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
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
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors disabled:opacity-50"
            >
              {isSubmitting
                ? (isAr ? 'جارٍ الحفظ...' : 'Saving...')
                : (isAr ? 'حفظ البيانات' : 'Save Vendor')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
