/**
 * Accessible Invoice Form Modal with Real-Time Automatic Calculations & Keyboard Navigation
 * 
 * Target: src/components/modules/invoices/InvoiceForm.tsx
 * 
 * Strict specifications:
 * - Real-time calculations: Zero calculate button. Subtotal, taxes, discounts, and Grand Total
 *   recalculate reactively inside useMemo on every single input change.
 * - Element #grand-total-display reflects live totals.
 * - Keyboard grid navigation: Tab/Shift+Tab, Enter on last column (taxRate) adds row and focuses Description,
 *   ArrowUp/ArrowDown navigates vertically, Alt+Delete removes row.
 * - Global shortcuts: Ctrl+S saves invoice, Escape closes modal.
 * - Full Arabic RTL mirroring with <BidiIsolate> and Tajawal/Cairo typography.
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { X, Plus, Trash2, FileText, AlertCircle, Check } from 'lucide-react';
import { useDirection } from '@/context/DirectionContext';
import { useCustomers } from '@/hooks/useCustomers';
import { BidiIsolate } from '@/components/common/BidiIsolate';
import { calculateLineItem, calculateInvoiceTotals } from '@/lib/calculations';
import { handleGridCellKeyDown, useGlobalShortcuts } from '@/lib/keyboard';
import type { Invoice, InvoiceItem, InvoiceStatus } from '@/types/domain';

export interface InvoiceFormProps {
  isOpen: boolean;
  invoice?: Invoice | null;
  initialCustomerId?: string;
  defaultInvoiceNumber?: string;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}

interface FormLineItem {
  id: string;
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  discount: number | string;
  discountType: 'PERCENTAGE' | 'FIXED';
  taxRate: number | string;
}

const createBlankLineItem = (): FormLineItem => ({
  id: 'item-' + Math.random().toString(36).substring(2, 9),
  description: '',
  quantity: 1,
  unitPrice: '',
  discount: 0,
  discountType: 'PERCENTAGE',
  taxRate: 15
});

export const InvoiceForm: React.FC<InvoiceFormProps> = ({
  isOpen,
  invoice,
  initialCustomerId,
  defaultInvoiceNumber,
  onClose,
  onSubmit
}) => {
  const { t, formatCurrency } = useDirection();
  const { customers } = useCustomers();
  const isEdit = Boolean(invoice);

  // Form Fields
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [currency, setCurrency] = useState('SAR');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [items, setItems] = useState<FormLineItem[]>([createBlankLineItem()]);

  // UI State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasError = (field: string) => Boolean(validationErrors[field]);

  const customerSelectRef = useRef<HTMLSelectElement>(null);
  const invoiceNumberRef = useRef<HTMLInputElement>(null);
  const dueDateRef = useRef<HTMLInputElement>(null);

  const prevOpenRef = useRef(false);
  const prevInvoiceIdRef = useRef<string | undefined>(undefined);

  // Initialize or reset form on open
  useEffect(() => {
    if (!isOpen) {
      prevOpenRef.current = false;
      prevInvoiceIdRef.current = undefined;
      return;
    }

    const isJustOpened = !prevOpenRef.current;
    const isDifferentInvoice = invoice?.id !== prevInvoiceIdRef.current;
    if (!isJustOpened && !isDifferentInvoice) return;

    prevOpenRef.current = true;
    prevInvoiceIdRef.current = invoice?.id;

    setValidationErrors({});
    setErrorMessage(null);
    setIsSubmitting(false);

    const todayStr = new Date().toISOString().split('T')[0];
    const twoWeeksLater = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

    if (invoice) {
      setInvoiceNumber(invoice.invoiceNumber || '');
      setCustomerId(invoice.customerId || '');
      setCurrency(invoice.currency || 'SAR');
      setIssueDate(invoice.issueDate || todayStr);
      setDueDate(invoice.dueDate || twoWeeksLater);
      setNotes(invoice.notes || '');
      setTerms(invoice.terms || '');
      setItems(
        invoice.items && invoice.items.length > 0
          ? invoice.items.map((it) => ({
              id: it.id || 'item-' + Math.random().toString(36).substring(2, 9),
              description: it.description || '',
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              discount: it.discount || 0,
              discountType: it.discountType || 'PERCENTAGE',
              taxRate: it.taxRate !== undefined ? it.taxRate : 15
            }))
          : [createBlankLineItem()]
      );
    } else {
      setInvoiceNumber(defaultInvoiceNumber || '');
      const targetCustomerId = initialCustomerId || (customers[0]?.id ?? '');
      setCustomerId(targetCustomerId);
      const targetCustomer = customers.find((c) => c.id === targetCustomerId);
      setCurrency(targetCustomer?.currency || 'SAR');
      setIssueDate(todayStr);
      setDueDate(twoWeeksLater);
      setNotes('');
      setTerms('');
      setItems([createBlankLineItem()]);
    }

    setTimeout(() => {
      if (!isEdit && !initialCustomerId) {
        customerSelectRef.current?.focus();
      } else {
        invoiceNumberRef.current?.focus();
      }
    }, 50);
  }, [isOpen, invoice?.id, defaultInvoiceNumber, initialCustomerId, isEdit]);

  // When customer selection changes, adopt customer's currency
  const handleCustomerChange = (newCustId: string) => {
    setCustomerId(newCustId);
    const matched = customers.find((c) => c.id === newCustId);
    if (matched?.currency) {
      setCurrency(matched.currency);
    }
  };

  // Line item change handler
  const handleItemChange = (index: number, field: keyof FormLineItem, val: any) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: val
      };
      return updated;
    });
  };

  const handleAddItem = useCallback(() => {
    setItems((prev) => [...prev, createBlankLineItem()]);
  }, []);

  const handleDeleteItem = useCallback((index: number) => {
    setItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // REAL-TIME AUTOMATIC CALCULATIONS VIA useMemo
  // Epsilon-safe financial calculations for each row and total invoice
  const calculatedItems = useMemo(() => {
    return items.map((item) => {
      const q = Math.max(0, Number(item.quantity) || 0);
      const p = Math.max(0, Number(item.unitPrice) || 0);
      const d = Math.max(0, Number(item.discount) || 0);
      const t = Math.max(0, Number(item.taxRate) || 0);

      const calculated = calculateLineItem({
        quantity: q,
        unitPrice: p,
        discount: d,
        discountType: item.discountType,
        taxRate: t
      });

      return {
        ...item,
        ...calculated
      };
    });
  }, [items]);

  const totals = useMemo(() => {
    const inputItems = items.map((item) => ({
      quantity: Math.max(0, Number(item.quantity) || 0),
      unitPrice: Math.max(0, Number(item.unitPrice) || 0),
      discount: Math.max(0, Number(item.discount) || 0),
      discountType: item.discountType,
      taxRate: Math.max(0, Number(item.taxRate) || 0)
    }));

    return calculateInvoiceTotals(
      inputItems,
      invoice?.amountPaid || 0,
      dueDate,
      false
    );
  }, [items, invoice?.amountPaid, dueDate]);

  // Form Submission
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    const errors: Record<string, string> = {};

    if (!customerId) {
      errors.customerId = 'Customer is required';
    }
    if (!invoiceNumber.trim()) {
      errors.invoiceNumber = 'Invoice number is required';
    }
    if (!issueDate) {
      errors.issueDate = 'Issue date is required';
    }
    if (!dueDate) {
      errors.dueDate = 'Due date is required';
    } else if (dueDate < issueDate) {
      errors.dueDate = 'Due date cannot be before issue date';
    }

    // Line items validation
    if (items.length === 0) {
      errors.items = 'At least one line item is required';
    } else {
      items.forEach((it, idx) => {
        if (!it.description.trim()) {
          errors[`item-${idx}-description`] = 'Description is required';
        }
        const qtyNum = Number(it.quantity);
        if (isNaN(qtyNum) || qtyNum <= 0) {
          errors[`item-${idx}-quantity`] = 'Qty must be > 0';
        }
        const priceNum = Number(it.unitPrice);
        if (isNaN(priceNum) || priceNum < 0) {
          errors[`item-${idx}-unitPrice`] = 'Price must be >= 0';
        }
      });
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setErrorMessage(Object.values(errors)[0]);

      // Focus first invalid element
      if (errors.customerId) customerSelectRef.current?.focus();
      else if (errors.invoiceNumber) invoiceNumberRef.current?.focus();
      else if (errors.dueDate) dueDateRef.current?.focus();
      else {
        const firstKey = Object.keys(errors).find((k) => k.startsWith('item-'));
        if (firstKey) {
          const el = document.querySelector<HTMLInputElement>(`[data-error-target="${firstKey}"]`);
          el?.focus();
        }
      }
      return;
    }

    setValidationErrors({});
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const selectedCustomer = customers.find((c) => c.id === customerId);
      const finalItems: InvoiceItem[] = calculatedItems.map((it) => ({
        id: it.id,
        description: it.description.trim(),
        quantity: Number(it.quantity) || 0,
        unitPrice: Number(it.unitPrice) || 0,
        discount: Number(it.discount) || 0,
        discountType: it.discountType,
        taxRate: Number(it.taxRate) || 0,
        lineDiscount: it.lineDiscount,
        lineTax: it.lineTax,
        lineTotal: it.lineTotal
      }));

      const payload = {
        invoiceNumber: invoiceNumber.trim(),
        customerId,
        customerName: selectedCustomer?.name || invoice?.customerName || '',
        issueDate,
        dueDate,
        currency,
        items: finalItems,
        subtotal: totals.subtotal,
        totalDiscount: totals.totalDiscount,
        totalTax: totals.totalTax,
        grandTotal: totals.grandTotal,
        amountDue: totals.amountDue,
        status: totals.status as InvoiceStatus,
        notes: notes.trim(),
        terms: terms.trim()
      };

      await onSubmit(payload);
      onClose();
    } catch (err: any) {
      console.error('[InvoiceForm] Submit error:', err);
      setErrorMessage(err.message || 'Failed to save invoice.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Global keyboard shortcuts (Ctrl+S to save, Esc to close)
  useGlobalShortcuts({
    onSave: () => handleSubmit(),
    onCloseModal: onClose,
    enabled: isOpen
  });

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invoice-form-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div
        className="relative w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50">
              <FileText className="w-4 h-4" />
            </div>
            <h2 id="invoice-form-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {isEdit ? t('invoice.editInvoice') : t('invoice.newInvoice')}
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

        {/* Modal Scrollable Content */}
        <form noValidate onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-lg flex items-center gap-2 text-rose-700 dark:rose-300 text-xs sm:text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Primary Meta Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Customer Select */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('invoice.customer')} *
              </label>
              <select
                ref={customerSelectRef}
                data-testid="customer-select"
                value={customerId}
                onChange={(e) => handleCustomerChange(e.target.value)}
                disabled={isEdit}
                className={`w-full px-3 py-1.5 text-xs sm:text-sm bg-white dark:bg-slate-800 border ${
                  hasError('customerId') ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'
                } rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white disabled:opacity-60`}
              >
                <option value="">{t('invoice.selectCustomer')}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.currency ? `(${c.currency})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Invoice Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('invoice.invoiceNumber')} *
              </label>
              <input
                ref={invoiceNumberRef}
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="INV-2026-0001"
                className="w-full px-3 py-1.5 text-xs sm:text-sm font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
              />
            </div>

            {/* Currency */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('statement.currency', 'Currency')}
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
              >
                <option value="SAR">SAR (ر.س)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="AED">AED (د.إ)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>

            {/* Issue Date */}
            <div>
              <label htmlFor="invoice-issue-date" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('invoice.issueDate')} *
              </label>
              <input
                id="invoice-issue-date"
                aria-label="Issue Date"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
              />
            </div>

            {/* Due Date */}
            <div>
              <label htmlFor="invoice-due-date" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('invoice.dueDate')} *
              </label>
              <input
                ref={dueDateRef}
                id="invoice-due-date"
                aria-label="Due Date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Line Items Section */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                {t('invoice.lineItems')}
              </h3>
              <span className="text-[11px] text-slate-400">
                {t('invoice.addLineItem', 'Press Enter in Tax to add row')}
              </span>
            </div>

            {/* Line Items Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto bg-slate-50/50 dark:bg-slate-900/40">
              <table className="w-full text-xs text-start">
                <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-2.5 py-2 text-start min-w-[180px]">{t('invoice.description')}</th>
                    <th className="px-2 py-2 text-start w-20">{t('invoice.qty')}</th>
                    <th className="px-2 py-2 text-start w-28">{t('invoice.unitPrice')}</th>
                    <th className="px-2 py-2 text-start w-24">{t('invoice.discount')}</th>
                    <th className="px-2 py-2 text-start w-20">{t('invoice.tax')} %</th>
                    <th className="px-2.5 py-2 text-end w-28">{t('invoice.total')}</th>
                    <th className="px-1.5 py-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {items.map((item, index) => {
                    const rowCalc = calculatedItems[index];
                    return (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        {/* Description */}
                        <td className="p-1.5">
                          <input
                            type="text"
                            value={item.description}
                            data-grid-cell={`${index}-description`}
                            data-testid={`item-${index}-description`}
                            data-error-target={`item-${index}-description`}
                            onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                            onKeyDown={(e) =>
                              handleGridCellKeyDown(e, index, 'description', {
                                itemsCount: items.length,
                                onAddNewRow: handleAddItem,
                                onDeleteRow: handleDeleteItem
                              })
                            }
                            placeholder="Service or product name"
                            className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded focus:ring-1 focus:ring-emerald-500 focus:outline-hidden text-slate-900 dark:text-white"
                          />
                        </td>

                        {/* Quantity */}
                        <td className="p-1.5">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={item.quantity}
                            data-grid-cell={`${index}-quantity`}
                            data-testid={`item-${index}-quantity`}
                            data-error-target={`item-${index}-quantity`}
                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                            onKeyDown={(e) =>
                              handleGridCellKeyDown(e, index, 'quantity', {
                                itemsCount: items.length,
                                onAddNewRow: handleAddItem,
                                onDeleteRow: handleDeleteItem
                              })
                            }
                            className="w-full px-2 py-1 font-mono text-end bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded focus:ring-1 focus:ring-emerald-500 focus:outline-hidden text-slate-900 dark:text-white"
                          />
                        </td>

                        {/* Unit Price */}
                        <td className="p-1.5">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unitPrice}
                            data-grid-cell={`${index}-unitPrice`}
                            data-testid={`item-${index}-unitPrice`}
                            data-error-target={`item-${index}-unitPrice`}
                            onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                            onKeyDown={(e) =>
                              handleGridCellKeyDown(e, index, 'unitPrice', {
                                itemsCount: items.length,
                                onAddNewRow: handleAddItem,
                                onDeleteRow: handleDeleteItem
                              })
                            }
                            placeholder="0.00"
                            className="w-full px-2 py-1 font-mono text-end bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded focus:ring-1 focus:ring-emerald-500 focus:outline-hidden text-slate-900 dark:text-white"
                          />
                        </td>

                        {/* Discount */}
                        <td className="p-1.5">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={item.discount}
                              data-grid-cell={`${index}-discount`}
                              data-testid={`item-${index}-discount`}
                              onChange={(e) => handleItemChange(index, 'discount', e.target.value)}
                              onKeyDown={(e) =>
                                handleGridCellKeyDown(e, index, 'discount', {
                                  itemsCount: items.length,
                                  onAddNewRow: handleAddItem,
                                  onDeleteRow: handleDeleteItem
                                })
                              }
                              className="w-full px-1.5 py-1 font-mono text-end bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded focus:ring-1 focus:ring-emerald-500 focus:outline-hidden text-slate-900 dark:text-white text-xs"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                handleItemChange(
                                  index,
                                  'discountType',
                                  item.discountType === 'PERCENTAGE' ? 'FIXED' : 'PERCENTAGE'
                                )
                              }
                              className="px-1.5 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded text-[10px] font-bold"
                            >
                              {item.discountType === 'PERCENTAGE' ? '%' : currency}
                            </button>
                          </div>
                        </td>

                        {/* Tax Rate (%) */}
                        <td className="p-1.5">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={item.taxRate}
                            data-grid-cell={`${index}-taxRate`}
                            data-testid={`item-${index}-taxRate`}
                            onChange={(e) => handleItemChange(index, 'taxRate', e.target.value)}
                            onKeyDown={(e) =>
                              handleGridCellKeyDown(e, index, 'taxRate', {
                                itemsCount: items.length,
                                onAddNewRow: handleAddItem,
                                onDeleteRow: handleDeleteItem
                              })
                            }
                            className="w-full px-2 py-1 font-mono text-end bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded focus:ring-1 focus:ring-emerald-500 focus:outline-hidden text-slate-900 dark:text-white"
                          />
                        </td>

                        {/* Line Total Display */}
                        <td className="px-2.5 py-1.5 text-end font-mono font-semibold text-slate-900 dark:text-white">
                          <BidiIsolate>{rowCalc?.lineTotal?.toFixed(2) || '0.00'}</BidiIsolate>
                        </td>

                        {/* Delete Row Button */}
                        <td className="p-1 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(index)}
                            disabled={items.length <= 1}
                            title="Delete Line Item (Alt+Delete)"
                            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 disabled:opacity-30 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-2 flex justify-between items-center">
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-800/60 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {t('invoice.addLineItem', 'Add Line Item')}
              </button>
            </div>
          </div>

          {/* Financial Breakdown & Grand Total (REAL-TIME, NO BUTTON) */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Notes & Terms */}
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('payment.notes', 'Notes')}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Thank you for your business..."
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-hidden text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Financial Summary Card */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700/60 space-y-2">
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>{t('invoice.subtotal')}</span>
                <span className="font-mono font-semibold">
                  <BidiIsolate>{formatCurrency(totals.subtotal, currency)}</BidiIsolate>
                </span>
              </div>

              {totals.totalDiscount > 0 && (
                <div className="flex justify-between text-xs text-rose-600 dark:text-rose-400">
                  <span>{t('invoice.totalDiscount')}</span>
                  <span className="font-mono font-semibold">
                    -<BidiIsolate>{formatCurrency(totals.totalDiscount, currency)}</BidiIsolate>
                  </span>
                </div>
              )}

              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>{t('invoice.totalTax')}</span>
                <span className="font-mono font-semibold">
                  <BidiIsolate>{formatCurrency(totals.totalTax, currency)}</BidiIsolate>
                </span>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('invoice.grandTotal')}
                </span>
                <div id="grand-total-display" className="text-base sm:text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  <BidiIsolate>{formatCurrency(totals.grandTotal, currency)}</BidiIsolate>
                </div>
              </div>

              {invoice && invoice.amountPaid > 0 && (
                <div className="flex justify-between text-xs text-slate-500 pt-1">
                  <span>{t('invoice.amountPaid')}</span>
                  <span className="font-mono">
                    <BidiIsolate>{formatCurrency(invoice.amountPaid, currency)}</BidiIsolate>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              {t('action.cancel')} (Esc)
            </button>
            <button
              type="submit"
              data-testid="invoice-submit-btn"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow-sm transition-all"
            >
              {isSubmitting ? (
                <span>{t('sync.syncing')}</span>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{t('action.save')} (Ctrl+S)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
