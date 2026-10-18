/**
 * Customer Profile & Ledger Hook
 * 
 * Performs an offline-first in-memory join of Invoices and Payments for a customer,
 * interleaves transactions chronologically, computes running balance with epsilon precision,
 * and tracks pending writes for offline synchronization.
 */

import { useState, useMemo } from 'react';
import { useCustomers } from '@/hooks/useCustomers';
import { useInvoices } from '@/hooks/useInvoices';
import { usePayments } from '@/hooks/usePayments';
import { roundFinancial } from '@/lib/calculations';
import type { Customer, Invoice, Payment, InvoiceStatus, PaymentMethod } from '@/types/domain';

export type LedgerEntryType = 'INVOICE' | 'PAYMENT';

export interface CustomerLedgerEntry {
  id: string;
  type: LedgerEntryType;
  date: string; // YYYY-MM-DD
  createdAt: string;
  referenceNumber: string; // e.g. INV-2026-001 or PAY-2026-001
  description: string;
  debit: number; // For Invoice: grandTotal; For Payment: 0
  credit: number; // For Invoice: 0; For Payment: amount
  runningBalance: number; // Chronologically accumulated balance
  currency: string;
  status?: InvoiceStatus; // For invoices
  dueDate?: string; // For invoices
  paymentMethod?: PaymentMethod; // For payments
  rawInvoice?: Invoice;
  rawPayment?: Payment;
}

export interface CustomerFinancialMetrics {
  totalInvoiced: number;
  totalPaid: number;
  outstandingBalance: number;
  invoiceCount: number;
  paymentCount: number;
  overdueCount: number;
  overdueAmount: number;
  financialStatus: 'CLEARED' | 'HAS_BALANCE' | 'OVERDUE';
}

export interface UseCustomerLedgerResult {
  customer: Customer | null;
  ledgerEntries: CustomerLedgerEntry[];
  filteredEntries: CustomerLedgerEntry[];
  metrics: CustomerFinancialMetrics;
  loading: boolean;
  error: Error | null;
  // Controls
  sortOrder: 'desc' | 'asc';
  setSortOrder: (order: 'desc' | 'asc') => void;
  filterType: 'ALL' | 'INVOICES' | 'PAYMENTS';
  setFilterType: (filter: 'ALL' | 'INVOICES' | 'PAYMENTS') => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  isReconciled: boolean;
}

/**
 * Reactive hook that subscribes offline-first to a customer document,
 * their invoices, and their payments from Firestore IndexedDB cache.
 *
 * Implements chronological transaction interleaving and precision running balance
 * calculation using `roundFinancial`.
 */
export function useCustomerLedger(customerId: string | undefined): UseCustomerLedgerResult {
  const customerData = useCustomers();
  const invoiceData = useInvoices();
  const paymentData = usePayments();
  const customer = customerData.rawCustomers.find(item => item.id === customerId) || null;
  const invoices = useMemo(() => invoiceData.rawInvoices.filter(item => item.customerId === customerId), [invoiceData.rawInvoices, customerId]);
  const payments = useMemo(() => paymentData.rawPayments.filter(item => item.customerId === customerId), [paymentData.rawPayments, customerId]);
  const loading = !customer && customerData.loading;
  const error = customerData.error || invoiceData.error || paymentData.error;
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [filterType, setFilterType] = useState<'ALL' | 'INVOICES' | 'PAYMENTS'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Interleave and compute chronological running balance
  const { chronologicalEntries, metrics } = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const currency = customer?.currency || 'SAR';

    // 1. Transform Invoices into ledger raw entries
    // Exclude CANCELLED and DRAFT invoices from posting balance
    const invoiceRows: Omit<CustomerLedgerEntry, 'runningBalance'>[] = invoices
      .filter(inv => inv.status !== 'CANCELLED' && inv.status !== 'DRAFT')
      .map(inv => ({
        id: inv.id,
        type: 'INVOICE' as const,
        date: inv.issueDate,
        createdAt: inv.createdAt,
        referenceNumber: inv.invoiceNumber,
        description: `Invoice #${inv.invoiceNumber}`,
        debit: roundFinancial(inv.grandTotal),
        credit: 0,
        currency: inv.currency || currency,
        status: inv.status,
        dueDate: inv.dueDate,
        rawInvoice: inv
      }));

    // 2. Transform Payments into ledger raw entries
    const paymentRows: Omit<CustomerLedgerEntry, 'runningBalance'>[] = payments.map(pay => ({
      id: pay.id,
      type: 'PAYMENT' as const,
      date: pay.paymentDate,
      createdAt: pay.createdAt,
      referenceNumber: pay.paymentNumber,
      description: `Payment for #${pay.invoiceNumber}${pay.referenceNumber ? ` (Ref: ${pay.referenceNumber})` : ''}`,
      debit: 0,
      credit: roundFinancial(pay.amount),
      currency: customer?.currency || currency,
      paymentMethod: pay.paymentMethod,
      rawPayment: pay
    }));

    // 3. Merge and Sort chronologically (Oldest First for accurate balance accrual)
    const combined = [...invoiceRows, ...paymentRows];
    combined.sort((a, b) => {
      // Primary: Transaction date
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      // Secondary: ISO createdAt timestamp
      if (a.createdAt !== b.createdAt) {
        return a.createdAt.localeCompare(b.createdAt);
      }
      // Tertiary Tie-breaker: Invoices (Debit) precede Payments (Credit)
      // to avoid momentary negative running balance on same-day invoices/payments
      if (a.type !== b.type) {
        return a.type === 'INVOICE' ? -1 : 1;
      }
      return a.referenceNumber.localeCompare(b.referenceNumber);
    });

    // 4. Calculate Running Balance sequentially using roundFinancial
    let balance = 0;
    const computed: CustomerLedgerEntry[] = combined.map(entry => {
      balance = roundFinancial(balance + entry.debit - entry.credit);
      return {
        ...entry,
        runningBalance: balance
      };
    });

    // 5. Compute Financial Metrics
    const totalInvoiced = roundFinancial(
      invoiceRows.reduce((sum, inv) => sum + inv.debit, 0)
    );
    const totalPaid = roundFinancial(
      paymentRows.reduce((sum, pay) => sum + pay.credit, 0)
    );
    const outstandingBalance = roundFinancial(totalInvoiced - totalPaid);

    let overdueCount = 0;
    let overdueAmount = 0;
    invoices.forEach(inv => {
      if (inv.status !== 'CANCELLED' && inv.status !== 'DRAFT' && inv.status !== 'PAID') {
        if (inv.dueDate && inv.dueDate < today && inv.amountDue > 0) {
          overdueCount++;
          overdueAmount = roundFinancial(overdueAmount + inv.amountDue);
        }
      }
    });

    let financialStatus: 'CLEARED' | 'HAS_BALANCE' | 'OVERDUE' = 'CLEARED';
    if (outstandingBalance > 0.001) {
      financialStatus = overdueCount > 0 ? 'OVERDUE' : 'HAS_BALANCE';
    }

    const calculatedMetrics: CustomerFinancialMetrics = {
      totalInvoiced,
      totalPaid,
      outstandingBalance,
      invoiceCount: invoiceRows.length,
      paymentCount: paymentRows.length,
      overdueCount,
      overdueAmount,
      financialStatus
    };

    return {
      chronologicalEntries: computed,
      metrics: calculatedMetrics
    };
  }, [customer, invoices, payments]);

  // Apply User Display Sorting (Ascending vs Descending) and Filters
  const { ledgerEntries, filteredEntries } = useMemo(() => {
    // Preserve chronological running balance per row, but order list for view
    const displayEntries = sortOrder === 'desc'
      ? [...chronologicalEntries].reverse()
      : [...chronologicalEntries];

    const searchLower = searchTerm.trim().toLowerCase();

    const filtered = displayEntries.filter(entry => {
      // Type filter
      if (filterType === 'INVOICES' && entry.type !== 'INVOICE') return false;
      if (filterType === 'PAYMENTS' && entry.type !== 'PAYMENT') return false;

      // Search term filter
      if (searchLower) {
        const matchesRef = entry.referenceNumber.toLowerCase().includes(searchLower);
        const matchesDesc = entry.description.toLowerCase().includes(searchLower);
        const matchesDate = entry.date.includes(searchLower);
        const matchesAmount = entry.debit.toString().includes(searchLower) || entry.credit.toString().includes(searchLower);
        if (!matchesRef && !matchesDesc && !matchesDate && !matchesAmount) {
          return false;
        }
      }

      return true;
    });

    return {
      ledgerEntries: displayEntries,
      filteredEntries: filtered
    };
  }, [chronologicalEntries, sortOrder, filterType, searchTerm]);

  // Check reconciliation against Customer.outstandingAmount
  const isReconciled = useMemo(() => {
    if (!customer) return true;
    const diff = Math.abs(customer.outstandingAmount - metrics.outstandingBalance);
    return diff <= 0.01;
  }, [customer, metrics.outstandingBalance]);

  return {
    customer,
    ledgerEntries,
    filteredEntries,
    metrics,
    loading,
    error,
    sortOrder,
    setSortOrder,
    filterType,
    setFilterType,
    searchTerm,
    setSearchTerm,
    isReconciled
  };
}
