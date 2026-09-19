/**
 * Customer Statement State Management Hook
 * 
 * Target: src/hooks/useStatements.ts
 * Integrates real-time customer, invoice, and payment data to generate
 * customer statements of account with opening balance, chronological interleaving
 * of invoices (debit) and payments (credit), running balance, and closing balance.
 */

import { useState, useMemo, useCallback } from 'react';
import { useCustomers } from '@/hooks/useCustomers';
import { useInvoices } from '@/hooks/useInvoices';
import { usePayments } from '@/hooks/usePayments';
import { generateCustomerStatement, exportStatementToCSV } from '@/lib/statements';
import type { Customer, StatementDateRange, StatementSummary } from '@/types/domain';

export type StatementPreset = 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_QUARTER' | 'YEAR_TO_DATE' | 'ALL_TIME' | 'CUSTOM';

export interface UseStatementsOptions {
  initialCustomerId?: string;
  initialDateRange?: StatementDateRange;
}

export interface UseStatementsReturn {
  customers: Customer[];
  selectedCustomer: Customer | null;
  selectedCustomerId: string;
  setSelectedCustomerId: (id: string) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  activePreset: StatementPreset;
  applyPreset: (preset: StatementPreset) => void;
  dateError: string | null;
  statement: StatementSummary | null;
  loading: boolean;
  exportCSV: () => Promise<string | null>;
  exportPDF: () => Promise<{ success: boolean; filePath?: string; error?: string }>;
}

export function useStatements(options: UseStatementsOptions = {}): UseStatementsReturn {
  const { customers, loading: loadingCustomers } = useCustomers();
  const { rawInvoices, loading: loadingInvoices } = useInvoices();
  const { rawPayments, loading: loadingPayments } = usePayments();

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(options.initialCustomerId || '');

  // Default to THIS_MONTH
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const pad = (n: number) => String(n).padStart(2, '0');
  const defaultFirstDay = `${year}-${pad(month + 1)}-01`;
  const defaultLastDay = `${year}-${pad(month + 1)}-${pad(new Date(year, month + 1, 0).getDate())}`;

  const [startDate, setStartDate] = useState<string>(options.initialDateRange?.startDate || defaultFirstDay);
  const [endDate, setEndDate] = useState<string>(options.initialDateRange?.endDate || defaultLastDay);
  const [activePreset, setActivePreset] = useState<StatementPreset>('THIS_MONTH');

  // Auto-select first customer if none selected
  const activeCustomerId = selectedCustomerId || (customers.length > 0 ? customers[0].id : '');

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === activeCustomerId) || null;
  }, [customers, activeCustomerId]);

  const applyPreset = useCallback((preset: StatementPreset) => {
    setActivePreset(preset);
    const currentDate = new Date();
    const currYear = currentDate.getFullYear();
    const currMonth = currentDate.getMonth();

    if (preset === 'THIS_MONTH') {
      const firstDay = `${currYear}-${pad(currMonth + 1)}-01`;
      const lastDayObj = new Date(currYear, currMonth + 1, 0);
      const lastDay = `${currYear}-${pad(currMonth + 1)}-${pad(lastDayObj.getDate())}`;
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === 'LAST_MONTH') {
      const prevMonthObj = new Date(currYear, currMonth - 1, 1);
      const prevYear = prevMonthObj.getFullYear();
      const prevMonth = prevMonthObj.getMonth();
      const firstDay = `${prevYear}-${pad(prevMonth + 1)}-01`;
      const lastDayObj = new Date(prevYear, prevMonth + 1, 0);
      const lastDay = `${prevYear}-${pad(prevMonth + 1)}-${pad(lastDayObj.getDate())}`;
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === 'THIS_QUARTER') {
      const quarter = Math.floor(currMonth / 3);
      const startQuarterMonth = quarter * 3;
      const endQuarterMonth = startQuarterMonth + 2;
      const firstDay = `${currYear}-${pad(startQuarterMonth + 1)}-01`;
      const lastDayObj = new Date(currYear, endQuarterMonth + 1, 0);
      const lastDay = `${currYear}-${pad(endQuarterMonth + 1)}-${pad(lastDayObj.getDate())}`;
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === 'YEAR_TO_DATE') {
      const firstDay = `${currYear}-01-01`;
      const today = `${currYear}-${pad(currMonth + 1)}-${pad(currentDate.getDate())}`;
      setStartDate(firstDay);
      setEndDate(today);
    } else if (preset === 'ALL_TIME') {
      const firstDay = '2020-01-01';
      const today = `${currYear}-${pad(currMonth + 1)}-${pad(currentDate.getDate())}`;
      setStartDate(firstDay);
      setEndDate(today);
    }
  }, []);

  const dateError = useMemo(() => {
    if (startDate && endDate && startDate > endDate) {
      return 'Start date cannot be after end date';
    }
    return null;
  }, [startDate, endDate]);

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
      console.error('[useStatements] Calculation error:', err);
      return null;
    }
  }, [selectedCustomer, rawInvoices, rawPayments, startDate, endDate, dateError]);

  const exportCSV = useCallback(async (): Promise<string | null> => {
    if (!statement) return null;
    const csvContent = exportStatementToCSV(statement);
    const suggestedFilename = `Statement_${statement.customer.name.replace(/\s+/g, '_')}_${statement.dateRange.startDate}_${statement.dateRange.endDate}.csv`;

    if (typeof window !== 'undefined' && (window as any).electronAPI?.exportFile) {
      try {
        await (window as any).electronAPI.exportFile({
          format: 'csv',
          data: csvContent,
          suggestedFilename
        });
        return csvContent;
      } catch (err) {
        console.warn('Native export failed, falling back to browser download:', err);
      }
    }

    if (typeof document !== 'undefined') {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', suggestedFilename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }

    return csvContent;
  }, [statement]);

  const exportPDF = useCallback(async (): Promise<{ success: boolean; filePath?: string; error?: string }> => {
    if (!statement) {
      return { success: false, error: 'No active statement to export' };
    }

    if (typeof window !== 'undefined' && (window as any).electronAPI?.printInvoicePDF) {
      try {
        const result = await (window as any).electronAPI.printInvoicePDF({
          invoiceId: `stmt-${statement.customer.id}`,
          invoiceNumber: `Statement-${statement.customer.name}`
        });
        return result;
      } catch (err: any) {
        console.warn('Native PDF print failed, falling back to window.print():', err);
        window.print();
        return { success: true };
      }
    }

    if (typeof window !== 'undefined') {
      window.print();
      return { success: true };
    }

    return { success: false, error: 'Window not defined' };
  }, [statement]);

  return {
    customers,
    selectedCustomer,
    selectedCustomerId: activeCustomerId,
    setSelectedCustomerId,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    activePreset,
    applyPreset,
    dateError,
    statement,
    loading: loadingCustomers || loadingInvoices || loadingPayments,
    exportCSV,
    exportPDF
  };
}
