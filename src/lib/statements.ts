/**
 * Customer Statement of Account Generator & Exporter
 * 
 * Target: src/lib/statements.ts
 * Pure financial utility functions for calculating Opening Balance,
 * chronological ledger entries with running balance, Closing Balance,
 * and RFC 4180 CSV export with UTF-8 BOM (\uFEFF) for Arabic Excel compatibility.
 */

import { roundFinancial } from '@/lib/calculations';
import type { Customer, Invoice, Payment, StatementDateRange, StatementEntry, StatementSummary } from '@/types/domain';

/**
 * Calculates opening balance, chronological transaction ledger, and closing balance
 * for a customer within a specified date range.
 * 
 * Strict accounting invariants:
 * - Opening Balance = Invoices before startDate (excluding CANCELLED & DRAFT) - Payments before startDate
 * - In-Period Invoices: issueDate in [startDate, endDate], status not CANCELLED or DRAFT
 * - In-Period Payments: paymentDate in [startDate, endDate]
 * - Debits (invoices) and Credits (payments) interleaved with running balance:
 *   R_k = roundFinancial(R_{k-1} + debit_k - credit_k)
 * - Closing Balance = Opening Balance + Total Invoiced - Total Paid
 */
export function generateCustomerStatement(
  customer: Customer,
  invoices: Invoice[],
  payments: Payment[],
  dateRange: StatementDateRange
): StatementSummary {
  const { startDate, endDate } = dateRange;

  if (startDate > endDate) {
    throw new Error('Start date cannot be after end date');
  }

  const currency = customer.currency || 'SAR';

  // 1. Calculate Opening Balance: Net unpaid balance strictly prior to startDate
  // Exclude CANCELLED and DRAFT invoices
  const priorInvoicesTotal = roundFinancial(
    invoices
      .filter((inv) => inv.issueDate < startDate && inv.status !== 'CANCELLED' && inv.status !== 'DRAFT')
      .reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0)
  );

  const priorPaymentsTotal = roundFinancial(
    payments
      .filter((pay) => pay.paymentDate < startDate)
      .reduce((sum, pay) => sum + (Number(pay.amount) || 0), 0)
  );

  const openingBalance = roundFinancial(priorInvoicesTotal - priorPaymentsTotal);

  // 2. Filter In-Period Invoices
  const periodInvoiceEntries: Omit<StatementEntry, 'runningBalance'>[] = invoices
    .filter(
      (inv) =>
        inv.issueDate >= startDate &&
        inv.issueDate <= endDate &&
        inv.status !== 'CANCELLED' &&
        inv.status !== 'DRAFT'
    )
    .map((inv) => ({
      id: inv.id,
      type: 'INVOICE' as const,
      date: inv.issueDate,
      createdAt: inv.createdAt,
      referenceNumber: inv.invoiceNumber,
      description: inv.notes ? `Invoice #${inv.invoiceNumber} - ${inv.notes}` : `Invoice #${inv.invoiceNumber}`,
      debit: roundFinancial(Number(inv.grandTotal) || 0),
      credit: 0,
      currency: inv.currency || currency,
      status: inv.status
    }));

  // 3. Filter In-Period Payments
  const periodPaymentEntries: Omit<StatementEntry, 'runningBalance'>[] = payments
    .filter((pay) => pay.paymentDate >= startDate && pay.paymentDate <= endDate)
    .map((pay) => ({
      id: pay.id,
      type: 'PAYMENT' as const,
      date: pay.paymentDate,
      createdAt: pay.createdAt,
      referenceNumber: pay.paymentNumber,
      description: `Payment for #${pay.invoiceNumber}${pay.referenceNumber ? ` (Ref: ${pay.referenceNumber})` : ''}`,
      debit: 0,
      credit: roundFinancial(Number(pay.amount) || 0),
      currency: currency,
      paymentMethod: pay.paymentMethod
    }));

  // 4. Merge and Chronologically Sort
  const merged = [...periodInvoiceEntries, ...periodPaymentEntries];
  merged.sort((a, b) => {
    // 1) Primary: date asc
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    // 2) Secondary: createdAt asc
    if (a.createdAt !== b.createdAt) return a.createdAt.localeCompare(b.createdAt);
    // 3) Debits (invoices) before Credits (payments) on same day/timestamp
    if (a.type !== b.type) return a.type === 'INVOICE' ? -1 : 1;
    // 4) Reference number tie-breaker
    return a.referenceNumber.localeCompare(b.referenceNumber);
  });

  // 5. Calculate Sequential Running Balance
  let currentBalance = openingBalance;
  const entries: StatementEntry[] = merged.map((item) => {
    currentBalance = roundFinancial(currentBalance + item.debit - item.credit);
    return {
      ...item,
      runningBalance: currentBalance
    };
  });

  const totalInvoiced = roundFinancial(entries.reduce((sum, e) => sum + e.debit, 0));
  const totalPaid = roundFinancial(entries.reduce((sum, e) => sum + e.credit, 0));
  const netChange = roundFinancial(totalInvoiced - totalPaid);
  const closingBalance = roundFinancial(openingBalance + netChange);

  return {
    customer,
    dateRange,
    openingBalance,
    totalInvoiced,
    totalPaid,
    netChange,
    closingBalance,
    entries,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Escapes an individual cell value for RFC 4180 CSV compliance.
 */
function escapeCSVCell(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '""';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Generates an RFC 4180 compliant CSV string with UTF-8 BOM (\uFEFF)
 * for seamless Arabic rendering in Microsoft Excel.
 */
export function exportStatementToCSV(statement: StatementSummary): string {
  const rows: string[] = [];

  // Header section
  rows.push([escapeCSVCell('STATEMENT OF ACCOUNT'), escapeCSVCell(statement.customer.name)].join(','));
  rows.push(
    [
      escapeCSVCell('Date Range'),
      escapeCSVCell(`${statement.dateRange.startDate} to ${statement.dateRange.endDate}`)
    ].join(',')
  );
  rows.push([escapeCSVCell('Currency'), escapeCSVCell(statement.customer.currency || 'SAR')].join(','));
  rows.push([escapeCSVCell('Opening Balance'), escapeCSVCell(statement.openingBalance.toFixed(2))].join(','));
  rows.push([escapeCSVCell('Total Invoiced'), escapeCSVCell(statement.totalInvoiced.toFixed(2))].join(','));
  rows.push([escapeCSVCell('Total Paid'), escapeCSVCell(statement.totalPaid.toFixed(2))].join(','));
  rows.push([escapeCSVCell('Closing Balance'), escapeCSVCell(statement.closingBalance.toFixed(2))].join(','));
  rows.push(''); // Blank row before table

  // Table header
  rows.push(
    [
      escapeCSVCell('Date'),
      escapeCSVCell('Type'),
      escapeCSVCell('Reference #'),
      escapeCSVCell('Description'),
      escapeCSVCell('Debit (+)'),
      escapeCSVCell('Credit (-)'),
      escapeCSVCell('Running Balance')
    ].join(',')
  );

  // Ledger entries
  for (const entry of statement.entries) {
    rows.push(
      [
        escapeCSVCell(entry.date),
        escapeCSVCell(entry.type),
        escapeCSVCell(entry.referenceNumber),
        escapeCSVCell(entry.description),
        escapeCSVCell(entry.debit > 0 ? entry.debit.toFixed(2) : ''),
        escapeCSVCell(entry.credit > 0 ? entry.credit.toFixed(2) : ''),
        escapeCSVCell(entry.runningBalance.toFixed(2))
      ].join(',')
    );
  }

  // Prepend UTF-8 BOM (\uFEFF) and join lines with CRLF (\r\n) per RFC 4180
  return '\uFEFF' + rows.join('\r\n');
}
