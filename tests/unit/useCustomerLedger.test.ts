import { describe, it, expect } from 'vitest';
import { roundFinancial } from '@/lib/calculations';
import type { Customer, Invoice, Payment } from '@/types/domain';
import type { CustomerLedgerEntry, CustomerFinancialMetrics } from '@/hooks/useCustomerLedger';

describe('Customer Ledger Accounting Logic & Interleaving', () => {
  const customer: Customer = {
    id: 'cust-ledger-test',
    name: 'Atlas Trading Co',
    currency: 'SAR',
    outstandingAmount: 0,
    totalInvoiced: 0,
    totalPaid: 0,
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  };

  // Helper pure simulation of interleaving and running balance as implemented in useCustomerLedger
  function computeLedger(invoices: Invoice[], payments: Payment[], today: string = '2026-09-19') {
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
        currency: inv.currency || 'SAR',
        status: inv.status,
        dueDate: inv.dueDate,
        rawInvoice: inv
      }));

    const paymentRows: Omit<CustomerLedgerEntry, 'runningBalance'>[] = payments.map(pay => ({
      id: pay.id,
      type: 'PAYMENT' as const,
      date: pay.paymentDate,
      createdAt: pay.createdAt,
      referenceNumber: pay.paymentNumber,
      description: `Payment for #${pay.invoiceNumber}`,
      debit: 0,
      credit: roundFinancial(pay.amount),
      currency: 'SAR',
      paymentMethod: pay.paymentMethod,
      rawPayment: pay
    }));

    const combined = [...invoiceRows, ...paymentRows];
    combined.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.createdAt !== b.createdAt) return a.createdAt.localeCompare(b.createdAt);
      if (a.type !== b.type) return a.type === 'INVOICE' ? -1 : 1;
      return a.referenceNumber.localeCompare(b.referenceNumber);
    });

    let balance = 0;
    const computed: CustomerLedgerEntry[] = combined.map(entry => {
      balance = roundFinancial(balance + entry.debit - entry.credit);
      return { ...entry, runningBalance: balance };
    });

    const totalInvoiced = roundFinancial(invoiceRows.reduce((sum, inv) => sum + inv.debit, 0));
    const totalPaid = roundFinancial(paymentRows.reduce((sum, pay) => sum + pay.credit, 0));
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

    const metrics: CustomerFinancialMetrics = {
      totalInvoiced,
      totalPaid,
      outstandingBalance,
      invoiceCount: invoiceRows.length,
      paymentCount: paymentRows.length,
      overdueCount,
      overdueAmount,
      financialStatus
    };

    return { entries: computed, metrics };
  }

  it('1. calculates chronological running balance correctly: +1000 -> +600 -> +1100 -> 0.00', () => {
    const invoices: Invoice[] = [
      {
        id: 'inv-1',
        invoiceNumber: 'INV-001',
        customerId: customer.id,
        customerName: customer.name,
        issueDate: '2026-09-01',
        dueDate: '2026-09-30',
        currency: 'SAR',
        items: [],
        subtotal: 1000,
        totalDiscount: 0,
        totalTax: 0,
        grandTotal: 1000,
        amountPaid: 400,
        amountDue: 600,
        status: 'PARTIALLY_PAID',
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z'
      },
      {
        id: 'inv-2',
        invoiceNumber: 'INV-002',
        customerId: customer.id,
        customerName: customer.name,
        issueDate: '2026-09-10',
        dueDate: '2026-10-10',
        currency: 'SAR',
        items: [],
        subtotal: 500,
        totalDiscount: 0,
        totalTax: 0,
        grandTotal: 500,
        amountPaid: 0,
        amountDue: 500,
        status: 'UNPAID',
        createdAt: '2026-09-10T10:00:00Z',
        updatedAt: '2026-09-10T10:00:00Z'
      }
    ];

    const payments: Payment[] = [
      {
        id: 'pay-1',
        paymentNumber: 'PAY-001',
        invoiceId: 'inv-1',
        invoiceNumber: 'INV-001',
        customerId: customer.id,
        customerName: customer.name,
        amount: 400,
        paymentDate: '2026-09-05',
        paymentMethod: 'BANK_TRANSFER',
        createdAt: '2026-09-05T12:00:00Z'
      },
      {
        id: 'pay-2',
        paymentNumber: 'PAY-002',
        invoiceId: 'inv-2',
        invoiceNumber: 'INV-002',
        customerId: customer.id,
        customerName: customer.name,
        amount: 1100,
        paymentDate: '2026-09-15',
        paymentMethod: 'CASH',
        createdAt: '2026-09-15T14:00:00Z'
      }
    ];

    const { entries, metrics } = computeLedger(invoices, payments);

    expect(entries).toHaveLength(4);
    expect(entries[0].runningBalance).toBe(1000);
    expect(entries[1].runningBalance).toBe(600);
    expect(entries[2].runningBalance).toBe(1100);
    expect(entries[3].runningBalance).toBe(0);

    expect(metrics.totalInvoiced).toBe(1500);
    expect(metrics.totalPaid).toBe(1500);
    expect(metrics.outstandingBalance).toBe(0);
    expect(metrics.financialStatus).toBe('CLEARED');
  });

  it('2. sorts same-day Invoice before Payment (tie-breaker) to avoid negative balance dips', () => {
    const invoices: Invoice[] = [
      {
        id: 'inv-cash',
        invoiceNumber: 'INV-CASH',
        customerId: customer.id,
        customerName: customer.name,
        issueDate: '2026-09-19',
        dueDate: '2026-09-19',
        currency: 'SAR',
        items: [],
        subtotal: 500,
        totalDiscount: 0,
        totalTax: 0,
        grandTotal: 500,
        amountPaid: 500,
        amountDue: 0,
        status: 'PAID',
        createdAt: '2026-09-19T10:00:00Z',
        updatedAt: '2026-09-19T10:00:00Z'
      }
    ];

    const payments: Payment[] = [
      {
        id: 'pay-cash',
        paymentNumber: 'PAY-CASH',
        invoiceId: 'inv-cash',
        invoiceNumber: 'INV-CASH',
        customerId: customer.id,
        customerName: customer.name,
        amount: 500,
        paymentDate: '2026-09-19',
        paymentMethod: 'CASH',
        createdAt: '2026-09-19T10:00:00Z'
      }
    ];

    const { entries } = computeLedger(invoices, payments);

    expect(entries).toHaveLength(2);
    // Invoice must be first
    expect(entries[0].type).toBe('INVOICE');
    expect(entries[0].runningBalance).toBe(500);
    // Payment second
    expect(entries[1].type).toBe('PAYMENT');
    expect(entries[1].runningBalance).toBe(0);
  });

  it('3. eliminates float mantissa drift using roundFinancial', () => {
    const invoices: Invoice[] = [1, 2, 3].map(i => ({
      id: `inv-f-${i}`,
      invoiceNumber: `INV-F-${i}`,
      customerId: customer.id,
      customerName: customer.name,
      issueDate: `2026-09-0${i}`,
      dueDate: '2026-09-30',
      currency: 'SAR',
      items: [],
      subtotal: 19.99,
      totalDiscount: 0,
      totalTax: 0,
      grandTotal: 19.99,
      amountPaid: 0,
      amountDue: 19.99,
      status: 'UNPAID',
      createdAt: `2026-09-0${i}T00:00:00Z`,
      updatedAt: `2026-09-0${i}T00:00:00Z`
    }));

    const payments: Payment[] = [
      {
        id: 'pay-f-1',
        paymentNumber: 'PAY-F-1',
        invoiceId: 'inv-f-1',
        invoiceNumber: 'INV-F-1',
        customerId: customer.id,
        customerName: customer.name,
        amount: 59.97,
        paymentDate: '2026-09-04',
        paymentMethod: 'BANK_TRANSFER',
        createdAt: '2026-09-04T00:00:00Z'
      }
    ];

    const { entries, metrics } = computeLedger(invoices, payments);

    expect(metrics.totalInvoiced).toBe(59.97);
    expect(metrics.totalPaid).toBe(59.97);
    expect(metrics.outstandingBalance).toBe(0);
    expect(entries[3].runningBalance).toBe(0);
  });

  it('4. excludes CANCELLED and DRAFT invoices from posting balance', () => {
    const invoices: Invoice[] = [
      {
        id: 'inv-active',
        invoiceNumber: 'INV-ACT',
        customerId: customer.id,
        customerName: customer.name,
        issueDate: '2026-09-01',
        dueDate: '2026-09-30',
        currency: 'SAR',
        items: [],
        subtotal: 1000,
        totalDiscount: 0,
        totalTax: 0,
        grandTotal: 1000,
        amountPaid: 0,
        amountDue: 1000,
        status: 'UNPAID',
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z'
      },
      {
        id: 'inv-cancelled',
        invoiceNumber: 'INV-CAN',
        customerId: customer.id,
        customerName: customer.name,
        issueDate: '2026-09-02',
        dueDate: '2026-09-30',
        currency: 'SAR',
        items: [],
        subtotal: 500,
        totalDiscount: 0,
        totalTax: 0,
        grandTotal: 500,
        amountPaid: 0,
        amountDue: 0,
        status: 'CANCELLED',
        createdAt: '2026-09-02T00:00:00Z',
        updatedAt: '2026-09-02T00:00:00Z'
      },
      {
        id: 'inv-draft',
        invoiceNumber: 'INV-DRF',
        customerId: customer.id,
        customerName: customer.name,
        issueDate: '2026-09-03',
        dueDate: '2026-09-30',
        currency: 'SAR',
        items: [],
        subtotal: 800,
        totalDiscount: 0,
        totalTax: 0,
        grandTotal: 800,
        amountPaid: 0,
        amountDue: 800,
        status: 'DRAFT',
        createdAt: '2026-09-03T00:00:00Z',
        updatedAt: '2026-09-03T00:00:00Z'
      }
    ];

    const { entries, metrics } = computeLedger(invoices, []);

    expect(entries).toHaveLength(1);
    expect(entries[0].referenceNumber).toBe('INV-ACT');
    expect(metrics.totalInvoiced).toBe(1000);
    expect(metrics.outstandingBalance).toBe(1000);
    expect(metrics.invoiceCount).toBe(1);
  });

  it('5. evaluates financial status OVERDUE when past due date with remaining amountDue', () => {
    const invoices: Invoice[] = [
      {
        id: 'inv-overdue',
        invoiceNumber: 'INV-OD',
        customerId: customer.id,
        customerName: customer.name,
        issueDate: '2026-08-01',
        dueDate: '2026-08-31', // Past due date relative to referenceDate 2026-09-19
        currency: 'SAR',
        items: [],
        subtotal: 2000,
        totalDiscount: 0,
        totalTax: 0,
        grandTotal: 2000,
        amountPaid: 500,
        amountDue: 1500,
        status: 'PARTIALLY_PAID',
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z'
      }
    ];

    const { metrics } = computeLedger(invoices, [], '2026-09-19');

    expect(metrics.overdueCount).toBe(1);
    expect(metrics.overdueAmount).toBe(1500);
    expect(metrics.financialStatus).toBe('OVERDUE');
  });
});
