import { describe, it, expect } from 'vitest';
import { generateCustomerStatement, exportStatementToCSV } from '@/lib/statements';
import type { Customer, Invoice, Payment, StatementDateRange } from '@/types/domain';

describe('Customer Statement Engine (src/lib/statements.ts)', () => {
  const mockCustomer: Customer = {
    id: 'cust-1',
    name: 'شركة الآفاق التقنية (Horizon Tech)',
    email: 'finance@horizon.sa',
    currency: 'SAR',
    outstandingAmount: 1500,
    totalInvoiced: 4000,
    totalPaid: 2500,
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z'
  };

  const mockInvoices: Invoice[] = [
    // Prior to start date (2026-03-01)
    {
      id: 'inv-prior-1',
      invoiceNumber: 'INV-2026-0001',
      customerId: 'cust-1',
      customerName: mockCustomer.name,
      issueDate: '2026-01-15',
      dueDate: '2026-01-30',
      currency: 'SAR',
      items: [],
      subtotal: 1000,
      totalDiscount: 0,
      totalTax: 150,
      grandTotal: 1150,
      amountPaid: 1150,
      amountDue: 0,
      status: 'PAID',
      createdAt: '2026-01-15T09:00:00Z',
      updatedAt: '2026-01-15T09:00:00Z'
    },
    {
      id: 'inv-prior-2',
      invoiceNumber: 'INV-2026-0002',
      customerId: 'cust-1',
      customerName: mockCustomer.name,
      issueDate: '2026-02-10',
      dueDate: '2026-02-25',
      currency: 'SAR',
      items: [],
      subtotal: 2000,
      totalDiscount: 0,
      totalTax: 300,
      grandTotal: 2300,
      amountPaid: 1000,
      amountDue: 1300,
      status: 'PARTIALLY_PAID',
      createdAt: '2026-02-10T11:00:00Z',
      updatedAt: '2026-02-10T11:00:00Z'
    },
    {
      // Cancelled prior invoice - MUST be excluded from opening balance
      id: 'inv-prior-cancelled',
      invoiceNumber: 'INV-2026-0003',
      customerId: 'cust-1',
      customerName: mockCustomer.name,
      issueDate: '2026-02-15',
      dueDate: '2026-02-28',
      currency: 'SAR',
      items: [],
      subtotal: 5000,
      totalDiscount: 0,
      totalTax: 750,
      grandTotal: 5750,
      amountPaid: 0,
      amountDue: 0,
      status: 'CANCELLED',
      createdAt: '2026-02-15T10:00:00Z',
      updatedAt: '2026-02-15T10:00:00Z'
    },
    {
      // Draft prior invoice - MUST be excluded from opening balance
      id: 'inv-prior-draft',
      invoiceNumber: 'INV-2026-0004',
      customerId: 'cust-1',
      customerName: mockCustomer.name,
      issueDate: '2026-02-20',
      dueDate: '2026-03-05',
      currency: 'SAR',
      items: [],
      subtotal: 800,
      totalDiscount: 0,
      totalTax: 120,
      grandTotal: 920,
      amountPaid: 0,
      amountDue: 920,
      status: 'DRAFT',
      createdAt: '2026-02-20T10:00:00Z',
      updatedAt: '2026-02-20T10:00:00Z'
    },
    // In-period invoices (2026-03-01 to 2026-03-31)
    {
      id: 'inv-period-1',
      invoiceNumber: 'INV-2026-0005',
      customerId: 'cust-1',
      customerName: mockCustomer.name,
      issueDate: '2026-03-05',
      dueDate: '2026-03-20',
      currency: 'SAR',
      items: [],
      subtotal: 1500,
      totalDiscount: 0,
      totalTax: 225,
      grandTotal: 1725,
      amountPaid: 0,
      amountDue: 1725,
      status: 'UNPAID',
      createdAt: '2026-03-05T08:00:00Z',
      updatedAt: '2026-03-05T08:00:00Z'
    },
    {
      id: 'inv-period-2',
      invoiceNumber: 'INV-2026-0006',
      customerId: 'cust-1',
      customerName: mockCustomer.name,
      issueDate: '2026-03-15',
      dueDate: '2026-03-30',
      currency: 'SAR',
      items: [],
      subtotal: 800,
      totalDiscount: 50,
      totalTax: 112.5,
      grandTotal: 862.5,
      amountPaid: 0,
      amountDue: 862.5,
      status: 'UNPAID',
      createdAt: '2026-03-15T14:00:00Z',
      updatedAt: '2026-03-15T14:00:00Z'
    },
    {
      // In-period cancelled invoice - MUST be excluded from period debits
      id: 'inv-period-cancelled',
      invoiceNumber: 'INV-2026-0007',
      customerId: 'cust-1',
      customerName: mockCustomer.name,
      issueDate: '2026-03-25',
      dueDate: '2026-04-10',
      currency: 'SAR',
      items: [],
      subtotal: 300,
      totalDiscount: 0,
      totalTax: 45,
      grandTotal: 345,
      amountPaid: 0,
      amountDue: 0,
      status: 'CANCELLED',
      createdAt: '2026-03-25T10:00:00Z',
      updatedAt: '2026-03-25T10:00:00Z'
    }
  ];

  const mockPayments: Payment[] = [
    // Prior payments
    {
      id: 'pay-prior-1',
      paymentNumber: 'PAY-2026-0001',
      invoiceId: 'inv-prior-1',
      invoiceNumber: 'INV-2026-0001',
      customerId: 'cust-1',
      customerName: mockCustomer.name,
      amount: 1150,
      paymentDate: '2026-01-20',
      paymentMethod: 'BANK_TRANSFER',
      createdAt: '2026-01-20T10:00:00Z'
    },
    {
      id: 'pay-prior-2',
      paymentNumber: 'PAY-2026-0002',
      invoiceId: 'inv-prior-2',
      invoiceNumber: 'INV-2026-0002',
      customerId: 'cust-1',
      customerName: mockCustomer.name,
      amount: 1000,
      paymentDate: '2026-02-15',
      paymentMethod: 'CASH',
      createdAt: '2026-02-15T12:00:00Z'
    },
    // In-period payments
    {
      id: 'pay-period-1',
      paymentNumber: 'PAY-2026-0003',
      invoiceId: 'inv-prior-2',
      invoiceNumber: 'INV-2026-0002',
      customerId: 'cust-1',
      customerName: mockCustomer.name,
      amount: 500,
      paymentDate: '2026-03-10',
      paymentMethod: 'BANK_TRANSFER',
      createdAt: '2026-03-10T11:00:00Z'
    },
    {
      id: 'pay-period-2',
      paymentNumber: 'PAY-2026-0004',
      invoiceId: 'inv-period-1',
      invoiceNumber: 'INV-2026-0005',
      customerId: 'cust-1',
      customerName: mockCustomer.name,
      amount: 725,
      paymentDate: '2026-03-15',
      paymentMethod: 'CREDIT_CARD',
      createdAt: '2026-03-15T15:00:00Z'
    }
  ];

  describe('1. generateCustomerStatement', () => {
    it('accurately calculates Opening Balance by subtracting prior payments from prior active invoices', () => {
      // Prior active invoices: 1150 + 2300 = 3450 (cancelled 5750 and draft 920 excluded)
      // Prior payments: 1150 + 1000 = 2150
      // Opening balance: 3450 - 2150 = 1300
      const dateRange: StatementDateRange = {
        startDate: '2026-03-01',
        endDate: '2026-03-31'
      };

      const statement = generateCustomerStatement(mockCustomer, mockInvoices, mockPayments, dateRange);

      expect(statement.openingBalance).toBe(1300);
      expect(statement.customer.id).toBe('cust-1');
    });

    it('interleaves in-period invoices and payments chronologically with running balance', () => {
      const dateRange: StatementDateRange = {
        startDate: '2026-03-01',
        endDate: '2026-03-31'
      };

      const statement = generateCustomerStatement(mockCustomer, mockInvoices, mockPayments, dateRange);

      // Period transactions:
      // 1) 2026-03-05: INVOICE INV-2026-0005 +1725 -> Running: 1300 + 1725 = 3025
      // 2) 2026-03-10: PAYMENT PAY-2026-0003 -500  -> Running: 3025 - 500 = 2525
      // 3) 2026-03-15: INVOICE INV-2026-0006 +862.5 -> Running: 2525 + 862.5 = 3387.5
      // 4) 2026-03-15: PAYMENT PAY-2026-0004 -725   -> Running: 3387.5 - 725 = 2662.5
      expect(statement.entries).toHaveLength(4);

      expect(statement.entries[0].type).toBe('INVOICE');
      expect(statement.entries[0].debit).toBe(1725);
      expect(statement.entries[0].runningBalance).toBe(3025);

      expect(statement.entries[1].type).toBe('PAYMENT');
      expect(statement.entries[1].credit).toBe(500);
      expect(statement.entries[1].runningBalance).toBe(2525);

      expect(statement.entries[2].type).toBe('INVOICE');
      expect(statement.entries[2].debit).toBe(862.5);
      expect(statement.entries[2].runningBalance).toBe(3387.5);

      expect(statement.entries[3].type).toBe('PAYMENT');
      expect(statement.entries[3].credit).toBe(725);
      expect(statement.entries[3].runningBalance).toBe(2662.5);
    });

    it('verifies Closing Balance equals Opening Balance + Total Invoiced - Total Paid', () => {
      const dateRange: StatementDateRange = {
        startDate: '2026-03-01',
        endDate: '2026-03-31'
      };

      const statement = generateCustomerStatement(mockCustomer, mockInvoices, mockPayments, dateRange);

      expect(statement.totalInvoiced).toBe(2587.5); // 1725 + 862.5
      expect(statement.totalPaid).toBe(1225);       // 500 + 725
      expect(statement.netChange).toBe(1362.5);     // 2587.5 - 1225
      expect(statement.closingBalance).toBe(2662.5); // 1300 + 1362.5
    });

    it('rejects invalid date range where startDate is after endDate', () => {
      const invalidRange: StatementDateRange = {
        startDate: '2026-04-01',
        endDate: '2026-03-01'
      };

      expect(() => {
        generateCustomerStatement(mockCustomer, mockInvoices, mockPayments, invalidRange);
      }).toThrow('Start date cannot be after end date');
    });

    it('handles single-day statements correctly', () => {
      const singleDayRange: StatementDateRange = {
        startDate: '2026-03-15',
        endDate: '2026-03-15'
      };

      const statement = generateCustomerStatement(mockCustomer, mockInvoices, mockPayments, singleDayRange);
      // Transactions on 2026-03-15:
      // INV-2026-0006 (+862.5) and PAY-2026-0004 (-725)
      expect(statement.entries).toHaveLength(2);
      expect(statement.entries[0].type).toBe('INVOICE');
      expect(statement.entries[1].type).toBe('PAYMENT');
    });

    it('returns zero totals for a fresh customer with no transaction history', () => {
      const freshCustomer: Customer = {
        ...mockCustomer,
        id: 'cust-fresh',
        name: 'New Customer LLC',
        outstandingAmount: 0,
        totalInvoiced: 0,
        totalPaid: 0
      };

      const statement = generateCustomerStatement(freshCustomer, [], [], {
        startDate: '2026-01-01',
        endDate: '2026-12-31'
      });

      expect(statement.openingBalance).toBe(0);
      expect(statement.totalInvoiced).toBe(0);
      expect(statement.totalPaid).toBe(0);
      expect(statement.closingBalance).toBe(0);
      expect(statement.entries).toHaveLength(0);
    });
  });

  describe('2. exportStatementToCSV', () => {
    it('prepends UTF-8 BOM (\\uFEFF) for Excel Arabic compatibility and escapes RFC 4180 special characters', () => {
      const dateRange: StatementDateRange = {
        startDate: '2026-03-01',
        endDate: '2026-03-31'
      };

      const statement = generateCustomerStatement(mockCustomer, mockInvoices, mockPayments, dateRange);
      const csv = exportStatementToCSV(statement);

      // Verify UTF-8 BOM at index 0
      expect(csv.startsWith('\uFEFF')).toBe(true);

      // Verify CRLF (\r\n) line breaks
      expect(csv.includes('\r\n')).toBe(true);

      // Verify Arabic customer name is present without corruption
      expect(csv).toContain('شركة الآفاق التقنية');

      // Verify header lines
      expect(csv).toContain('STATEMENT OF ACCOUNT');
      expect(csv).toContain('Opening Balance');
      expect(csv).toContain('1300.00');
      expect(csv).toContain('Closing Balance');
      expect(csv).toContain('2662.50');

      // Verify table column headers
      expect(csv).toContain('Debit (+)');
      expect(csv).toContain('Credit (-)');
      expect(csv).toContain('Running Balance');
    });
  });
});
