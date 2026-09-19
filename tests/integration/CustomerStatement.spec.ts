import { describe, it, expect } from 'vitest';
import { generateCustomerStatement, exportStatementToCSV } from '@/lib/statements';
import type { Customer, Invoice, Payment } from '@/types/domain';

describe('Integration Test: Customer Statement Workflow (F-STMT-01, F-STMT-02)', () => {
  const customer: Customer = {
    id: 'cust-statement-1',
    name: 'مؤسسة الرياض التجارية (Riyadh Trading Est)',
    currency: 'SAR',
    outstandingAmount: 2000,
    totalInvoiced: 8000,
    totalPaid: 6000,
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  };

  const invoices: Invoice[] = [
    // Prior invoice (Opening Balance)
    {
      id: 'inv-1',
      invoiceNumber: 'INV-2026-0010',
      customerId: customer.id,
      customerName: customer.name,
      issueDate: '2026-01-10',
      dueDate: '2026-01-25',
      currency: 'SAR',
      items: [],
      subtotal: 3000,
      totalDiscount: 0,
      totalTax: 450,
      grandTotal: 3450,
      amountPaid: 2000,
      amountDue: 1450,
      status: 'PARTIALLY_PAID',
      createdAt: '2026-01-10T10:00:00Z',
      updatedAt: '2026-01-10T10:00:00Z'
    },
    // In-period invoice 1
    {
      id: 'inv-2',
      invoiceNumber: 'INV-2026-0020',
      customerId: customer.id,
      customerName: customer.name,
      issueDate: '2026-02-05',
      dueDate: '2026-02-20',
      currency: 'SAR',
      items: [],
      subtotal: 1000,
      totalDiscount: 0,
      totalTax: 150,
      grandTotal: 1150,
      amountPaid: 0,
      amountDue: 1150,
      status: 'UNPAID',
      createdAt: '2026-02-05T09:00:00Z',
      updatedAt: '2026-02-05T09:00:00Z'
    },
    // In-period invoice 2
    {
      id: 'inv-3',
      invoiceNumber: 'INV-2026-0030',
      customerId: customer.id,
      customerName: customer.name,
      issueDate: '2026-02-18',
      dueDate: '2026-03-05',
      currency: 'SAR',
      items: [],
      subtotal: 2000,
      totalDiscount: 200,
      totalTax: 270,
      grandTotal: 2070,
      amountPaid: 0,
      amountDue: 2070,
      status: 'UNPAID',
      createdAt: '2026-02-18T14:00:00Z',
      updatedAt: '2026-02-18T14:00:00Z'
    }
  ];

  const payments: Payment[] = [
    // Prior payment
    {
      id: 'pay-1',
      paymentNumber: 'PAY-2026-0005',
      invoiceId: 'inv-1',
      invoiceNumber: 'INV-2026-0010',
      customerId: customer.id,
      customerName: customer.name,
      amount: 2000,
      paymentDate: '2026-01-15',
      paymentMethod: 'BANK_TRANSFER',
      createdAt: '2026-01-15T11:00:00Z'
    },
    // In-period payment 1
    {
      id: 'pay-2',
      paymentNumber: 'PAY-2026-0015',
      invoiceId: 'inv-1',
      invoiceNumber: 'INV-2026-0010',
      customerId: customer.id,
      customerName: customer.name,
      amount: 1450,
      paymentDate: '2026-02-10',
      paymentMethod: 'BANK_TRANSFER',
      createdAt: '2026-02-10T10:00:00Z'
    },
    // In-period payment 2
    {
      id: 'pay-3',
      paymentNumber: 'PAY-2026-0025',
      invoiceId: 'inv-2',
      invoiceNumber: 'INV-2026-0020',
      customerId: customer.id,
      customerName: customer.name,
      amount: 500,
      paymentDate: '2026-02-20',
      paymentMethod: 'CASH',
      createdAt: '2026-02-20T16:00:00Z'
    }
  ];

  it('generates accurate statement of account for February 2026', () => {
    const statement = generateCustomerStatement(customer, invoices, payments, {
      startDate: '2026-02-01',
      endDate: '2026-02-28'
    });

    // Opening Balance prior to 2026-02-01:
    // Invoices: 3450 - Payments: 2000 = 1450.00
    expect(statement.openingBalance).toBe(1450);

    // Period entries:
    // 1) 2026-02-05: INVOICE INV-2026-0020 (debit: 1150) -> Running: 1450 + 1150 = 2600
    // 2) 2026-02-10: PAYMENT PAY-2026-0015 (credit: 1450) -> Running: 2600 - 1450 = 1150
    // 3) 2026-02-18: INVOICE INV-2026-0030 (debit: 2070) -> Running: 1150 + 2070 = 3220
    // 4) 2026-02-20: PAYMENT PAY-2026-0025 (credit: 500)  -> Running: 3220 - 500 = 2720
    expect(statement.entries).toHaveLength(4);

    expect(statement.entries[0].debit).toBe(1150);
    expect(statement.entries[0].runningBalance).toBe(2600);

    expect(statement.entries[1].credit).toBe(1450);
    expect(statement.entries[1].runningBalance).toBe(1150);

    expect(statement.entries[2].debit).toBe(2070);
    expect(statement.entries[2].runningBalance).toBe(3220);

    expect(statement.entries[3].credit).toBe(500);
    expect(statement.entries[3].runningBalance).toBe(2720);

    // Totals verification
    expect(statement.totalInvoiced).toBe(3220); // 1150 + 2070
    expect(statement.totalPaid).toBe(1950);     // 1450 + 500
    expect(statement.netChange).toBe(1270);     // 3220 - 1950
    expect(statement.closingBalance).toBe(2720); // 1450 + 1270
  });

  it('exports statement to RFC 4180 CSV with UTF-8 BOM for Arabic Excel fidelity', () => {
    const statement = generateCustomerStatement(customer, invoices, payments, {
      startDate: '2026-02-01',
      endDate: '2026-02-28'
    });

    const csvString = exportStatementToCSV(statement);

    // Assert UTF-8 BOM exists as first character
    expect(csvString.charCodeAt(0)).toBe(0xfeff);

    // Assert rows and columns exist
    expect(csvString).toContain('STATEMENT OF ACCOUNT');
    expect(csvString).toContain('مؤسسة الرياض التجارية');
    expect(csvString).toContain('Opening Balance');
    expect(csvString).toContain('1450.00');
    expect(csvString).toContain('Closing Balance');
    expect(csvString).toContain('2720.00');
    expect(csvString).toContain('INV-2026-0020');
    expect(csvString).toContain('PAY-2026-0015');
  });
});
