import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Receipt } from 'lucide-react';
import { useDirection } from '@/context/DirectionContext';
import type { ExpenseBill, ExpenseBillItem, ExpenseCategory, Vendor } from '@/types/domain';

export interface ExpenseBillFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (billData: Omit<ExpenseBill, 'id' | 'createdAt' | 'updatedAt' | 'amountPaid' | 'amountDue' | 'status'>) => Promise<void>;
  vendors: Vendor[];
  onOpenNewVendorModal?: () => void;
  bill?: ExpenseBill | null;
}

const CATEGORY_OPTIONS: { value: ExpenseCategory; labelAr: string; labelEn: string }[] = [
  { value: 'GOODS', labelAr: 'مشتريات بضاعة ومخزون', labelEn: 'Goods & Inventory' },
  { value: 'RENT', labelAr: 'إيجار ومقرات', labelEn: 'Rent & Facilities' },
  { value: 'SALARIES', labelAr: 'رواتب وأجور ومستحقات أفراد', labelEn: 'Salaries & Wages' },
  { value: 'UTILITIES', labelAr: 'فواتير وخدمات (كهرباء / ماء / إنترنت)', labelEn: 'Utilities & Bills' },
  { value: 'MAINTENANCE', labelAr: 'صيانة ومعدات', labelEn: 'Maintenance & Repairs' },
  { value: 'SHIPPING', labelAr: 'شحن ونقل ولوجستيات', labelEn: 'Shipping & Logistics' },
  { value: 'MARKETING', labelAr: 'تسويق وإعلانات', labelEn: 'Marketing & Ads' },
  { value: 'OTHER', labelAr: 'مصروفات أخرى وتشغيلية', labelEn: 'Other Operating Expenses' }
];

export const ExpenseBillFormModal: React.FC<ExpenseBillFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  vendors,
  onOpenNewVendorModal,
  bill
}) => {
  const { language } = useDirection();
  const isAr = language === 'ar';

  const todayStr = new Date().toISOString().split('T')[0];

  const [vendorId, setVendorId] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [issueDate, setIssueDate] = useState(todayStr);
  const [dueDate, setDueDate] = useState(todayStr);
  const [category, setCategory] = useState<ExpenseCategory>('GOODS');
  const [currency, setCurrency] = useState('SAR');
  const [notes, setNotes] = useState('');
  const [includeTax, setIncludeTax] = useState<boolean>(false);
  const [taxRate, setTaxRate] = useState<number>(15);

  const [items, setItems] = useState<ExpenseBillItem[]>([
    {
      id: 'item_1',
      description: '',
      quantity: 1,
      unitPrice: 0,
      taxRate: 0,
      lineTotal: 0
    }
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (bill) {
      const hasTax = (bill.taxAmount || 0) > 0;
      setIncludeTax(hasTax);
      const foundRate = bill.items?.find((it) => it.taxRate > 0)?.taxRate || 15;
      setTaxRate(foundRate);
      setVendorId(bill.vendorId || '');
      setVendorName(bill.vendorName || '');
      setBillNumber(bill.billNumber || '');
      setIssueDate(bill.issueDate || todayStr);
      setDueDate(bill.dueDate || todayStr);
      setCategory(bill.category || 'GOODS');
      setCurrency(bill.currency || 'SAR');
      setNotes(bill.notes || '');
      setItems(bill.items && bill.items.length > 0 ? bill.items : [
        { id: 'item_1', description: '', quantity: 1, unitPrice: 0, taxRate: hasTax ? foundRate : 0, lineTotal: 0 }
      ]);
    } else {
      setIncludeTax(false); // غير شامل لضريبة القيمة المضافة افتراضياً
      setTaxRate(15);
      setVendorId(vendors[0]?.id || '');
      setVendorName(vendors[0]?.name || '');
      setBillNumber(`BILL-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`);
      setIssueDate(todayStr);
      // Default due date = 14 days later
      const nextDue = new Date();
      nextDue.setDate(nextDue.getDate() + 14);
      setDueDate(nextDue.toISOString().split('T')[0]);
      setCategory('GOODS');
      setCurrency('SAR');
      setNotes('');
      setItems([
        { id: 'item_1', description: '', quantity: 1, unitPrice: 0, taxRate: 0, lineTotal: 0 }
      ]);
    }
    setError(null);
  }, [bill, isOpen, vendors]);

  if (!isOpen) return null;

  const handleVendorChange = (id: string) => {
    setVendorId(id);
    const found = vendors.find((v) => v.id === id);
    if (found) {
      setVendorName(found.name);
      if (found.currency) setCurrency(found.currency);
    }
  };

  const handleToggleTax = (enabled: boolean) => {
    setIncludeTax(enabled);
    const currentRate = enabled ? (taxRate || 15) : 0;
    setItems((prev) =>
      prev.map((item) => {
        const base = item.quantity * item.unitPrice;
        const tax = (base * currentRate) / 100;
        return {
          ...item,
          taxRate: currentRate,
          lineTotal: Math.round((base + tax) * 100) / 100
        };
      })
    );
  };

  const handleTaxRateChange = (newRate: number) => {
    setTaxRate(newRate);
    if (includeTax) {
      setItems((prev) =>
        prev.map((item) => {
          const base = item.quantity * item.unitPrice;
          const tax = (base * newRate) / 100;
          return {
            ...item,
            taxRate: newRate,
            lineTotal: Math.round((base + tax) * 100) / 100
          };
        })
      );
    }
  };

  const handleItemChange = (index: number, field: keyof ExpenseBillItem, val: any) => {
    setItems((prev) => {
      const copy = [...prev];
      const item = { ...copy[index], [field]: val };

      const qty = field === 'quantity' ? Number(val) || 0 : item.quantity;
      const price = field === 'unitPrice' ? Number(val) || 0 : item.unitPrice;
      const currentRate = includeTax ? (field === 'taxRate' ? Number(val) || 0 : item.taxRate) : 0;

      const base = qty * price;
      const tax = (base * currentRate) / 100;
      item.lineTotal = Math.round((base + tax) * 100) / 100;
      item.taxRate = currentRate;

      copy[index] = item;
      return copy;
    });
  };

  const handleAddItem = () => {
    const currentRate = includeTax ? (taxRate || 15) : 0;
    setItems((prev) => [
      ...prev,
      {
        id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        description: '',
        quantity: 1,
        unitPrice: 0,
        taxRate: currentRate,
        lineTotal: 0
      }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Totals
  const subtotal = items.reduce((acc, it) => acc + (it.quantity * it.unitPrice), 0);
  const taxAmount = includeTax
    ? items.reduce((acc, it) => acc + ((it.quantity * it.unitPrice * (it.taxRate || 0)) / 100), 0)
    : 0;
  const grandTotal = Math.round((subtotal + taxAmount) * 100) / 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!vendorName.trim()) {
      setError(isAr ? 'يرجى تحديد اسم المورد أو الجهة' : 'Please select or enter vendor name');
      return;
    }
    if (!billNumber.trim()) {
      setError(isAr ? 'يرجى إدخال رقم الفاتورة أو المرجع' : 'Bill reference number is required');
      return;
    }
    if (items.some((i) => !i.description.trim())) {
      setError(isAr ? 'يرجى إدخال وصف لجميع البنود' : 'Please enter description for all items');
      return;
    }
    if (grandTotal <= 0) {
      setError(isAr ? 'إجمالي الفاتورة يجب أن يكون أكبر من صفر' : 'Total must be greater than zero');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        billNumber: billNumber.trim(),
        vendorId: vendorId || 'unknown_vendor',
        vendorName: vendorName.trim(),
        issueDate,
        dueDate,
        category,
        currency,
        items,
        subtotal: Math.round(subtotal * 100) / 100,
        taxAmount: Math.round(taxAmount * 100) / 100,
        grandTotal,
        notes: notes.trim() || undefined
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || (isAr ? 'فشل حفظ الفاتورة' : 'Failed to save bill'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {bill
                ? (isAr ? 'تعديل فاتورة المشتريات / المصروف' : 'Edit Expense Bill')
                : (isAr ? 'تسجيل فاتورة مشتريات أو مصروف جديد' : 'New Expense Bill / Due')}
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-400 font-medium">
              {error}
            </div>
          )}

          {/* Row 1: Vendor Picker & Bill Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isAr ? 'المورد / الجهة المستحقة *' : 'Vendor / Payee *'}
                </label>
                {onOpenNewVendorModal && (
                  <button
                    type="button"
                    onClick={onOpenNewVendorModal}
                    className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    {isAr ? '+ مورد جديد' : '+ New Vendor'}
                  </button>
                )}
              </div>
              {vendors.length > 0 ? (
                <select
                  value={vendorId}
                  onChange={(e) => handleVendorChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">{isAr ? '-- اختر المورد --' : '-- Select Vendor --'}</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} {v.company ? `(${v.company})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  required
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder={isAr ? 'اسم الشركة أو المورد المستحق' : 'Vendor name'}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isAr ? 'رقم الفاتورة / مرجع المورد *' : 'Bill # / Reference *'}
              </label>
              <input
                type="text"
                required
                value={billNumber}
                onChange={(e) => setBillNumber(e.target.value)}
                placeholder="e.g. INV-9042"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
              />
            </div>
          </div>

          {/* Row 2: Category, Issue Date, Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isAr ? 'تصنيف المصروف' : 'Category'}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {isAr ? cat.labelAr : cat.labelEn}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isAr ? 'تاريخ الفاتورة' : 'Issue Date'}
              </label>
              <input
                type="date"
                required
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isAr ? 'تاريخ الاستحقاق' : 'Due Date'}
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Items Section */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {isAr ? 'بنود الفاتورة والمصروف' : 'Bill Line Items'}
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAr ? 'إضافة بند' : 'Add Item'}</span>
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 grid grid-cols-12 gap-2 items-center"
                >
                  <div className="col-span-12 sm:col-span-5">
                    <input
                      type="text"
                      required
                      placeholder={isAr ? 'وصف البند / الخدمة' : 'Description'}
                      value={item.description}
                      onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="col-span-4 sm:col-span-2">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      placeholder={isAr ? 'الكمية' : 'Qty'}
                      value={item.quantity}
                      onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs text-center rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="col-span-4 sm:col-span-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={isAr ? 'السعر' : 'Price'}
                      value={item.unitPrice || ''}
                      onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs text-center rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="col-span-3 sm:col-span-2 flex items-center justify-end font-mono text-xs font-bold text-slate-900 dark:text-white">
                    {item.lineTotal.toFixed(2)}
                  </div>

                  <div className="col-span-1 flex items-center justify-center">
                    <button
                      type="button"
                      disabled={items.length <= 1}
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1 text-slate-400 hover:text-rose-500 disabled:opacity-30 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* VAT Selection Toggle */}
          <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={includeTax}
                onChange={(e) => handleToggleTax(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-600 cursor-pointer"
              />
              <span>{isAr ? 'خاضع لضريبة القيمة المضافة (VAT)' : 'Subject to Value Added Tax (VAT)'}</span>
            </label>

            {includeTax && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                  {isAr ? 'نسبة الضريبة:' : 'Tax Rate:'}
                </span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={taxRate}
                  onChange={(e) => handleTaxRateChange(Number(e.target.value) || 0)}
                  className="w-16 px-2 py-1 text-xs text-center font-bold font-mono rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <span className="text-slate-500 font-bold">%</span>
              </div>
            )}
          </div>

          {/* Notes & Summary Box */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isAr ? 'ملاحظات' : 'Notes'}
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={isAr ? 'ملاحظات الفاتورة أو طريقة السداد...' : 'Bill terms, notes...'}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
              />
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>{isAr ? 'المجموع الفرعي:' : 'Subtotal:'}</span>
                <span className="font-mono">{subtotal.toFixed(2)} {currency}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>
                  {isAr
                    ? (includeTax ? `ضريبة القيمة المضافة (${taxRate}%):` : 'ضريبة القيمة المضافة:')
                    : (includeTax ? `VAT (${taxRate}%):` : 'VAT:')}
                </span>
                <span className="font-mono">
                  {includeTax ? (
                    `${taxAmount.toFixed(2)} ${currency}`
                  ) : (
                    <span className="text-slate-400 text-[11px] font-sans">
                      {isAr ? '0.00 (غير شامل للضريبة)' : '0.00 (Non-taxable)'}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 dark:text-white pt-1 border-t border-slate-200 dark:border-slate-700">
                <span>{isAr ? 'إجمالي المستحق:' : 'Grand Total:'}</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                  {grandTotal.toFixed(2)} {currency}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
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
                ? (isAr ? 'جارٍ التسجيل...' : 'Saving...')
                : (isAr ? 'تسجيل الفاتورة' : 'Save Bill')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
