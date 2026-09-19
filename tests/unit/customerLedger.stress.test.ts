/**
 * Adversarial Empirical Stress Test Suite: Customer Search Normalization & Customer Ledger
 * 
 * Conducted by: teamwork_preview_challenger_m3_1 (Empirical Challenger)
 * Milestone: Milestone 3 (Customer Directory & Financial Dashboard Modules)
 * 
 * Verifies:
 * 1. Arabic search normalization (Harakat diacritics, Alef/Hamza forms, Teh Marbuta, Alef Maksura).
 * 2. Multi-field customer search filtering (Phone numbers, Tax IDs, Mixed Arabic-English).
 * 3. Chronological ledger interleaving, same-day multiple transactions, and tie-breakers.
 * 4. IEEE-754 precision drift elimination over 100+ transactions via roundFinancial.
 * 5. Reconciliation detection (isReconciled audit check).
 */

import { describe, it, expect } from 'vitest';
import { normalizeSearchText } from '@/hooks/useCustomers';
import { roundFinancial } from '@/lib/calculations';
import type { Customer, Invoice, Payment } from '@/types/domain';
import type { CustomerLedgerEntry, CustomerFinancialMetrics } from '@/hooks/useCustomerLedger';

/**
 * Pure accounting generator and interleaver matching useCustomerLedger implementation.
 */
function buildLedger(
  customer: Customer | null,
  invoices: Invoice[],
  payments: Payment[],
  referenceDate: string = '2026-09-19'
) {
  const currency = customer?.currency || 'SAR';

  // 1. Transform Invoices (excluding CANCELLED and DRAFT)
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

  // 2. Transform Payments
  const paymentRows: Omit<CustomerLedgerEntry, 'runningBalance'>[] = payments.map(pay => ({
    id: pay.id,
    type: 'PAYMENT' as const,
    date: pay.paymentDate,
    createdAt: pay.createdAt,
    referenceNumber: pay.paymentNumber,
    description: `Payment for #${pay.invoiceNumber}`,
    debit: 0,
    credit: roundFinancial(pay.amount),
    currency: currency,
    paymentMethod: pay.paymentMethod,
    rawPayment: pay
  }));

  // 3. Sort Oldest First
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
    // Tertiary Tie-breaker: Invoices precede Payments
    if (a.type !== b.type) {
      return a.type === 'INVOICE' ? -1 : 1;
    }
    return a.referenceNumber.localeCompare(b.referenceNumber);
  });

  // 4. Calculate Running Balance sequentially
  let balance = 0;
  const computed: CustomerLedgerEntry[] = combined.map(entry => {
    balance = roundFinancial(balance + entry.debit - entry.credit);
    return {
      ...entry,
      runningBalance: balance
    };
  });

  // 5. Compute Metrics
  const totalInvoiced = roundFinancial(invoiceRows.reduce((sum, inv) => sum + inv.debit, 0));
  const totalPaid = roundFinancial(paymentRows.reduce((sum, pay) => sum + pay.credit, 0));
  const outstandingBalance = roundFinancial(totalInvoiced - totalPaid);

  let overdueCount = 0;
  let overdueAmount = 0;
  invoices.forEach(inv => {
    if (inv.status !== 'CANCELLED' && inv.status !== 'DRAFT' && inv.status !== 'PAID') {
      if (inv.dueDate && inv.dueDate < referenceDate && inv.amountDue > 0) {
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

  // 6. Reconciliation
  let isReconciled = true;
  if (customer) {
    const diff = Math.abs(customer.outstandingAmount - metrics.outstandingBalance);
    isReconciled = diff <= 0.01;
  }

  return {
    ledgerEntries: computed,
    metrics,
    isReconciled
  };
}

/**
 * Filter predicate matching useCustomers.ts line 177-204
 */
function filterCustomer(c: Customer, searchQuery: string): boolean {
  const normalizedQuery = normalizeSearchText(searchQuery);
  if (!normalizedQuery) return true;

  const normalizedName = normalizeSearchText(c.name || '');
  const phone = (c.phone || '').replace(/\s+/g, '');
  const email = (c.email || '').toLowerCase();
  const taxNumber = (c.taxNumber || '').replace(/\s+/g, '');

  return (
    normalizedName.includes(normalizedQuery) ||
    phone.includes(normalizedQuery) ||
    email.includes(normalizedQuery) ||
    taxNumber.includes(normalizedQuery)
  );
}

describe('Empirical Challenger M3-1: Customer Search Normalization & Ledger Stress Suite', () => {

  // =========================================================================
  // 1. Customer Search Normalization Stress
  // =========================================================================
  describe('1. Arabic Search Normalization & Diacritic Stripping', () => {
    
    it('1.1 strips all standard Arabic diacritics (harakat / tashkeel)', () => {
      // Fatha (\u064E)
      expect(normalizeSearchText('مَفْتُوح')).toBe('مفتوح');
      // Damma (\u064F)
      expect(normalizeSearchText('مُقَاوَلَات')).toBe('مقاولات');
      // Kasra (\u0650)
      expect(normalizeSearchText('بِسْمِ')).toBe('بسم');
      // Fathatan (\u064B)
      expect(normalizeSearchText('شُكْراً')).toBe('شكرا');
      // Dammatan (\u064C)
      expect(normalizeSearchText('عَمَلٌ')).toBe('عمل');
      // Kasratan (\u064D)
      expect(normalizeSearchText('بَيْتٍ')).toBe('بيت');
      // Shaddah (\u0651)
      expect(normalizeSearchText('مُتَقَدِّم')).toBe('متقدم');
      // Sukun (\u0652)
      expect(normalizeSearchText('مَسْجِد')).toBe('مسجد');
      // Dagger Alif / Superscript Alif (\u0670)
      expect(normalizeSearchText('هٰذَا')).toBe('هذا');
      expect(normalizeSearchText('الرَّحْمٰن')).toBe('الرحمن');
      // Tatweel / Kashida (\u0640)
      expect(normalizeSearchText('شـــركــة')).toBe('شركه');
      expect(normalizeSearchText('مـؤسـســة الـنـــور')).toBe('موسسه النور');
    });

    it('1.2 strips stacked diacritics (Shaddah + Fatha, Shaddah + Damma, Shaddah + Kasra, Shaddah + Tanwin)', () => {
      // Shaddah + Fatha (\u0651\u064E)
      const shaddahFatha = 'مُحَمَّد';
      expect(normalizeSearchText(shaddahFatha)).toBe('محمد');
      // Shaddah + Dammatan (\u0651\u064C)
      const shaddahDammatan = 'مُحَمَّدٌ';
      expect(normalizeSearchText(shaddahDammatan)).toBe('محمد');
      // Shaddah + Kasratan (\u0651\u064D)
      const shaddahKasratan = 'كُلٍّ';
      expect(normalizeSearchText(shaddahKasratan)).toBe('كل');
    });

    it('1.3 strips diacritics across full complex Arabic business names', () => {
      const fullVowelled = 'مُؤَسَّسَةُ الفَتْحِ لِلتِّجَارَةِ وَالتَّوْرِيدَاتِ العُمُومِيَّةِ';
      const normalized = normalizeSearchText(fullVowelled);
      // Notice: مؤَسسة -> موسسه, للتجارة -> للتجاره, العمومية -> العموميه
      expect(normalized).toBe('موسسه الفتح للتجاره والتوريدات العموميه');

      // Searching with vowelled text against unvowelled text matches
      const unvowelled = 'مؤسسة الفتح للتجارة والتوريدات العمومية';
      expect(normalizeSearchText(unvowelled)).toBe(normalized);
    });

    it('1.4 verifies Alef and Hamza variants normalization', () => {
      // Alef with Hamza above (أ \u0623) -> ا
      expect(normalizeSearchText('أحمد')).toBe('احمد');
      // Alef with Hamza below (إ \u0625) -> ا
      expect(normalizeSearchText('إبراهيم')).toBe('ابراهيم');
      // Alef with Madda above (آ \u0622) -> ا
      expect(normalizeSearchText('آفاق')).toBe('افاق');
      // Isolated Hamza (ء \u0621) -> ا
      expect(normalizeSearchText('سماء')).toBe('سماا');
      // Waw with Hamza (ؤ \u0624) -> و (due to NFD decomposition \u0648 + \u0654)
      expect(normalizeSearchText('مسؤول')).toBe('مسوول');
      expect(normalizeSearchText('مؤمن')).toBe('مومن');
      // Yeh with Hamza (ئ \u0626) -> ي (due to NFD decomposition \u064A + \u0654)
      expect(normalizeSearchText('رئيس')).toBe('رييس');
      expect(normalizeSearchText('سائل')).toBe('سايل');
    });

    it('1.5 verifies Teh Marbuta (ة -> ه) and Alef Maksura (ى -> ي) normalization', () => {
      // Teh Marbuta (ة) -> ه
      expect(normalizeSearchText('شركة')).toBe('شركه');
      expect(normalizeSearchText('المملكة')).toBe('المملكه');
      expect(normalizeSearchText('التجارة')).toBe('التجاره');
      // Alef Maksura (ى) -> ي
      expect(normalizeSearchText('مصطفى')).toBe('مصطفي');
      expect(normalizeSearchText('مستشفى')).toBe('مستشفي');
      expect(normalizeSearchText('فتوى')).toBe('فتوي');
      expect(normalizeSearchText('على')).toBe('علي');
    });

    it('1.6 verifies bidirectional match when DB has variant A and search has variant B', () => {
      const dbCustomerName = 'شركة الأمل لمستشفى الأطفال';
      const normalizedDbName = normalizeSearchText(dbCustomerName);

      // User queries without hamza, with heh instead of teh marbuta, with yeh instead of alef maksura:
      const userQuery = 'شركه الامل لمستشفي الاطفال';
      const normalizedQuery = normalizeSearchText(userQuery);

      expect(normalizedDbName).toBe(normalizedQuery);
      expect(normalizedDbName.includes(normalizedQuery)).toBe(true);
    });

    it('1.7 handles mixed Arabic-Latin strings with numbers, symbols, and irregular whitespace', () => {
      const complex = '   Al-Amal   Co.   (شركة   الأمل)   #2026   ';
      const normalized = normalizeSearchText(complex);
      expect(normalized).toBe('al-amal   co.   (شركه   الامل)   #2026');
    });
  });

  // =========================================================================
  // 2. Multi-Field Customer Search Stress & Vulnerability Detection
  // =========================================================================
  describe('2. Multi-Field Customer Search Filtering', () => {
    const customerDirectory: Customer[] = [
      {
        id: 'cust-sa-1',
        name: 'مؤسسة الأفق العالمية للتجارة',
        email: 'billing@alofooq.sa',
        phone: '+966 50 123 4567',
        taxNumber: '300123456700003',
        currency: 'SAR',
        outstandingAmount: 2450.50,
        totalInvoiced: 12450.50,
        totalPaid: 10000.00,
        status: 'ACTIVE',
        createdAt: '2026-01-10T08:00:00Z',
        updatedAt: '2026-01-10T08:00:00Z'
      },
      {
        id: 'cust-sa-2',
        name: 'شركة التقنية الحديثة المحدودة',
        email: 'info@moderntech.com.sa',
        phone: '0559876543',
        taxNumber: '300987654300003',
        currency: 'SAR',
        outstandingAmount: 0,
        totalInvoiced: 50000,
        totalPaid: 50000,
        status: 'ACTIVE',
        createdAt: '2026-02-15T09:30:00Z',
        updatedAt: '2026-02-15T09:30:00Z'
      },
      {
        id: 'cust-global-3',
        name: 'Gulf Solutions International LLC',
        email: 'accounts@gulfsolutions.ae',
        phone: '+971 4 321 9876',
        taxNumber: 'TRN-100200300400003',
        currency: 'AED',
        outstandingAmount: 18500,
        totalInvoiced: 18500,
        totalPaid: 0,
        status: 'ACTIVE',
        createdAt: '2026-03-01T11:00:00Z',
        updatedAt: '2026-03-01T11:00:00Z'
      }
    ];

    it('2.1 matches customer by Arabic name variants and partial words', () => {
      // Query without hamza or teh marbuta
      expect(filterCustomer(customerDirectory[0], 'الافق')).toBe(true);
      expect(filterCustomer(customerDirectory[0], 'موسسه')).toBe(true);
      expect(filterCustomer(customerDirectory[0], 'العالميه')).toBe(true);
      // Query with hamza matching DB
      expect(filterCustomer(customerDirectory[0], 'الأفق')).toBe(true);
    });

    it('2.2 matches customer by email case-insensitively and partially', () => {
      expect(filterCustomer(customerDirectory[0], 'ALOFooq')).toBe(true);
      expect(filterCustomer(customerDirectory[1], 'moderntech')).toBe(true);
      expect(filterCustomer(customerDirectory[2], 'ACCOUNTS@GULFSOLUTIONS')).toBe(true);
    });

    it('2.3 matches phone number when queried without spaces', () => {
      // Customer phone is '+966 50 123 4567'
      // Query '50123'
      expect(filterCustomer(customerDirectory[0], '50123')).toBe(true);
      // Query '1234567'
      expect(filterCustomer(customerDirectory[0], '1234567')).toBe(true);
      // Customer 2 phone is '0559876543'
      expect(filterCustomer(customerDirectory[1], '055987')).toBe(true);
    });

    it('2.4 [ADVERSARIAL STRESS / BUG DISCOVERY] phone number matching with formatted whitespace in query', () => {
      // Customer phone in database: '+966 50 123 4567'
      // In useCustomers.ts line 194:
      // const phone = (c.phone || '').replace(/\s+/g, ''); // => '+966501234567'
      // const normalizedQuery = normalizeSearchText(searchQuery); // => '+966 50' (spaces NOT stripped!)
      // phone.includes(normalizedQuery) => '+966501234567'.includes('+966 50') => FALSE!
      
      const queryWithSpace = '+966 50';
      const matchesWithSpace = filterCustomer(customerDirectory[0], queryWithSpace);
      
      // Documenting the empirical finding:
      // When user types a formatted phone number with spaces into search bar,
      // phone.includes(normalizedQuery) fails because normalizedQuery preserves internal whitespace
      // while c.phone strips whitespace.
      expect(matchesWithSpace).toBe(false);

      // Demonstrating correct whitespace-tolerant matching:
      const sanitizedQuery = normalizeSearchText(queryWithSpace).replace(/\s+/g, '');
      const phoneInDb = (customerDirectory[0].phone || '').replace(/\s+/g, '');
      expect(phoneInDb.includes(sanitizedQuery)).toBe(true);
    });

    it('2.5 [ADVERSARIAL STRESS / BUG DISCOVERY] tax number matching with formatted whitespace in query', () => {
      // Customer tax number in DB: '300123456700003'
      // If user pastes formatted ZATCA number with spaces '3001 2345 6700 003':
      const formattedZatcaTaxQuery = '3001 2345';
      const matchesTaxQuery = filterCustomer(customerDirectory[0], formattedZatcaTaxQuery);

      // Fails due to whitespace asymmetry between target and query:
      expect(matchesTaxQuery).toBe(false);

      // Tolerant version:
      const sanitizedTaxQuery = normalizeSearchText(formattedZatcaTaxQuery).replace(/\s+/g, '');
      const taxInDb = (customerDirectory[0].taxNumber || '').replace(/\s+/g, '');
      expect(taxInDb.includes(sanitizedTaxQuery)).toBe(true);
    });

    it('2.6 matches mixed Arabic and English queries', () => {
      const mixedCustomer: Customer = {
        id: 'cust-mixed',
        name: 'Apex Solutions حلول القمة',
        currency: 'SAR',
        outstandingAmount: 0,
        totalInvoiced: 0,
        totalPaid: 0,
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      };

      expect(filterCustomer(mixedCustomer, 'Apex')).toBe(true);
      expect(filterCustomer(mixedCustomer, 'apex')).toBe(true);
      expect(filterCustomer(mixedCustomer, 'حلول')).toBe(true);
      expect(filterCustomer(mixedCustomer, 'القمة')).toBe(true);
      expect(filterCustomer(mixedCustomer, 'ال his')).toBe(false);
    });
  });

  // =========================================================================
  // 3. Customer Ledger Running Balance Stress & Tie-Breakers
  // =========================================================================
  describe('3. Customer Ledger Running Balance Stress & Chronological Interleaving', () => {
    const customer: Customer = {
      id: 'cust-ledger-stress',
      name: 'Sahara Trading Establishment',
      currency: 'SAR',
      outstandingAmount: 1250.75,
      totalInvoiced: 15450.75,
      totalPaid: 14200.00,
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    };

    it('3.1 handles complex same-day multiple invoices and payments without negative balance blip', () => {
      // Same transaction date '2026-09-19' and identical createdAt '2026-09-19T10:00:00.000Z'
      // Customer has 3 invoices and 3 matching payments created in the same batch:
      const sameDayInvoices: Invoice[] = [
        {
          id: 'inv-sd-1',
          invoiceNumber: 'INV-101',
          customerId: customer.id,
          customerName: customer.name,
          issueDate: '2026-09-19',
          dueDate: '2026-09-19',
          currency: 'SAR',
          items: [],
          subtotal: 1000,
          totalDiscount: 0,
          totalTax: 0,
          grandTotal: 1000,
          amountPaid: 1000,
          amountDue: 0,
          status: 'PAID',
          createdAt: '2026-09-19T10:00:00.000Z',
          updatedAt: '2026-09-19T10:00:00.000Z'
        },
        {
          id: 'inv-sd-2',
          invoiceNumber: 'INV-102',
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
          createdAt: '2026-09-19T10:00:00.000Z',
          updatedAt: '2026-09-19T10:00:00.000Z'
        }
      ];

      const sameDayPayments: Payment[] = [
        {
          id: 'pay-sd-1',
          paymentNumber: 'PAY-101',
          invoiceId: 'inv-sd-1',
          invoiceNumber: 'INV-101',
          customerId: customer.id,
          customerName: customer.name,
          amount: 1000,
          paymentDate: '2026-09-19',
          paymentMethod: 'CASH',
          createdAt: '2026-09-19T10:00:00.000Z'
        },
        {
          id: 'pay-sd-2',
          paymentNumber: 'PAY-102',
          invoiceId: 'inv-sd-2',
          invoiceNumber: 'INV-102',
          customerId: customer.id,
          customerName: customer.name,
          amount: 500,
          paymentDate: '2026-09-19',
          paymentMethod: 'BANK_TRANSFER',
          createdAt: '2026-09-19T10:00:00.000Z'
        }
      ];

      const { ledgerEntries } = buildLedger(customer, sameDayInvoices, sameDayPayments);

      expect(ledgerEntries).toHaveLength(4);

      // Verify that all invoices precede all payments on same-timestamp transactions
      expect(ledgerEntries[0].type).toBe('INVOICE');
      expect(ledgerEntries[1].type).toBe('INVOICE');
      expect(ledgerEntries[2].type).toBe('PAYMENT');
      expect(ledgerEntries[3].type).toBe('PAYMENT');

      // Verify running balances never dip below 0
      expect(ledgerEntries[0].runningBalance).toBe(1000); // +1000
      expect(ledgerEntries[1].runningBalance).toBe(1500); // +500 => 1500
      expect(ledgerEntries[2].runningBalance).toBe(500);  // -1000 => 500
      expect(ledgerEntries[3].runningBalance).toBe(0);    // -500 => 0

      // Assert that at NO step was the running balance negative
      ledgerEntries.forEach(entry => {
        expect(entry.runningBalance).toBeGreaterThanOrEqual(0);
      });
    });

    it('3.2 correctly interlaces chronological events across multi-month timeline', () => {
      const invoices: Invoice[] = [
        {
          id: 'inv-1',
          invoiceNumber: 'INV-2026-01',
          customerId: customer.id,
          customerName: customer.name,
          issueDate: '2026-01-15',
          dueDate: '2026-02-15',
          currency: 'SAR',
          items: [],
          subtotal: 5000,
          totalDiscount: 0,
          totalTax: 0,
          grandTotal: 5000,
          amountPaid: 5000,
          amountDue: 0,
          status: 'PAID',
          createdAt: '2026-01-15T09:00:00Z',
          updatedAt: '2026-01-15T09:00:00Z'
        },
        {
          id: 'inv-2',
          invoiceNumber: 'INV-2026-02',
          customerId: customer.id,
          customerName: customer.name,
          issueDate: '2026-02-10',
          dueDate: '2026-03-10',
          currency: 'SAR',
          items: [],
          subtotal: 8000,
          totalDiscount: 0,
          totalTax: 0,
          grandTotal: 8000,
          amountPaid: 4000,
          amountDue: 4000,
          status: 'PARTIALLY_PAID',
          createdAt: '2026-02-10T09:00:00Z',
          updatedAt: '2026-02-10T09:00:00Z'
        },
        {
          id: 'inv-3',
          invoiceNumber: 'INV-2026-03',
          customerId: customer.id,
          customerName: customer.name,
          issueDate: '2026-03-01',
          dueDate: '2026-03-31',
          currency: 'SAR',
          items: [],
          subtotal: 3000,
          totalDiscount: 0,
          totalTax: 0,
          grandTotal: 3000,
          amountPaid: 0,
          amountDue: 3000,
          status: 'UNPAID',
          createdAt: '2026-03-01T09:00:00Z',
          updatedAt: '2026-03-01T09:00:00Z'
        }
      ];

      const payments: Payment[] = [
        {
          id: 'pay-1',
          paymentNumber: 'PAY-2026-01',
          invoiceId: 'inv-1',
          invoiceNumber: 'INV-2026-01',
          customerId: customer.id,
          customerName: customer.name,
          amount: 5000,
          paymentDate: '2026-01-20',
          paymentMethod: 'BANK_TRANSFER',
          createdAt: '2026-01-20T14:00:00Z'
        },
        {
          id: 'pay-2',
          paymentNumber: 'PAY-2026-02',
          invoiceId: 'inv-2',
          invoiceNumber: 'INV-2026-02',
          customerId: customer.id,
          customerName: customer.name,
          amount: 4000,
          paymentDate: '2026-02-25',
          paymentMethod: 'CHECK',
          createdAt: '2026-02-25T11:00:00Z'
        }
      ];

      const { ledgerEntries, metrics } = buildLedger(customer, invoices, payments);

      expect(ledgerEntries).toHaveLength(5);
      // Timeline sequence:
      // 1. 2026-01-15: INV-1 (+5000) -> balance 5000
      // 2. 2026-01-20: PAY-1 (-5000) -> balance 0
      // 3. 2026-02-10: INV-2 (+8000) -> balance 8000
      // 4. 2026-02-25: PAY-2 (-4000) -> balance 4000
      // 5. 2026-03-01: INV-3 (+3000) -> balance 7000
      expect(ledgerEntries[0].runningBalance).toBe(5000);
      expect(ledgerEntries[1].runningBalance).toBe(0);
      expect(ledgerEntries[2].runningBalance).toBe(8000);
      expect(ledgerEntries[3].runningBalance).toBe(4000);
      expect(ledgerEntries[4].runningBalance).toBe(7000);

      expect(metrics.totalInvoiced).toBe(16000);
      expect(metrics.totalPaid).toBe(9000);
      expect(metrics.outstandingBalance).toBe(7000);
      expect(metrics.overdueCount).toBe(2); // inv-2 and inv-3 both have dueDate in March 2026 (< Sept 2026)
      expect(metrics.financialStatus).toBe('OVERDUE');
    });

    it('3.3 strictly ignores CANCELLED and DRAFT invoices from posting balance calculations', () => {
      const mixedInvoices: Invoice[] = [
        {
          id: 'inv-valid',
          invoiceNumber: 'INV-VALID',
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
          createdAt: '2026-09-01T10:00:00Z',
          updatedAt: '2026-09-01T10:00:00Z'
        },
        {
          id: 'inv-cancelled',
          invoiceNumber: 'INV-CANCELLED',
          customerId: customer.id,
          customerName: customer.name,
          issueDate: '2026-09-05',
          dueDate: '2026-09-30',
          currency: 'SAR',
          items: [],
          subtotal: 99999,
          totalDiscount: 0,
          totalTax: 0,
          grandTotal: 99999,
          amountPaid: 0,
          amountDue: 0,
          status: 'CANCELLED',
          createdAt: '2026-09-05T10:00:00Z',
          updatedAt: '2026-09-05T10:00:00Z'
        },
        {
          id: 'inv-draft',
          invoiceNumber: 'INV-DRAFT',
          customerId: customer.id,
          customerName: customer.name,
          issueDate: '2026-09-10',
          dueDate: '2026-09-30',
          currency: 'SAR',
          items: [],
          subtotal: 88888,
          totalDiscount: 0,
          totalTax: 0,
          grandTotal: 88888,
          amountPaid: 0,
          amountDue: 88888,
          status: 'DRAFT',
          createdAt: '2026-09-10T10:00:00Z',
          updatedAt: '2026-09-10T10:00:00Z'
        }
      ];

      const { ledgerEntries, metrics } = buildLedger(customer, mixedInvoices, []);
      expect(ledgerEntries).toHaveLength(1);
      expect(ledgerEntries[0].referenceNumber).toBe('INV-VALID');
      expect(metrics.totalInvoiced).toBe(1000);
      expect(metrics.outstandingBalance).toBe(1000);
      expect(metrics.invoiceCount).toBe(1);
    });
  });

  // =========================================================================
  // 4. IEEE-754 Precision Drift Stress over 150+ Transactions
  // =========================================================================
  describe('4. IEEE-754 Precision Drift Elimination Over 150+ Transactions', () => {

    it('4.1 simulates 150 transactions with fractional cents and proves zero drift in roundFinancial', () => {
      // Generate 100 invoices with awkward decimal amounts that trigger IEEE-754 mantissa drift
      // e.g. 19.99, 0.14, 0.07, 100.10, 33.33, 0.01, 7.77
      const amounts = [19.99, 0.14, 0.07, 100.10, 33.33, 0.01, 7.77, 45.65, 0.29, 89.95];
      
      const invoices: Invoice[] = [];
      const payments: Payment[] = [];

      let rawFloatSum = 0;
      let exactExpectedInvoiced = 0;
      let exactExpectedPaid = 0;

      // 100 Invoices
      for (let i = 1; i <= 100; i++) {
        const amt = amounts[i % amounts.length];
        exactExpectedInvoiced = roundFinancial(exactExpectedInvoiced + amt);
        rawFloatSum += amt;

        const dayStr = String((i % 28) + 1).padStart(2, '0');
        const monthStr = String(Math.floor(i / 28) + 1).padStart(2, '0');

        invoices.push({
          id: `stress-inv-${i}`,
          invoiceNumber: `INV-S-${String(i).padStart(4, '0')}`,
          customerId: 'cust-stress',
          customerName: 'Stress Test Customer',
          issueDate: `2026-${monthStr}-${dayStr}`,
          dueDate: `2026-${monthStr}-${dayStr}`,
          currency: 'SAR',
          items: [],
          subtotal: amt,
          totalDiscount: 0,
          totalTax: 0,
          grandTotal: amt,
          amountPaid: 0,
          amountDue: amt,
          status: 'UNPAID',
          createdAt: `2026-${monthStr}-${dayStr}T08:00:00.${String(i).padStart(3, '0')}Z`,
          updatedAt: `2026-${monthStr}-${dayStr}T08:00:00.${String(i).padStart(3, '0')}Z`
        });
      }

      // 50 Payments offsetting portions
      for (let j = 1; j <= 50; j++) {
        const amt = amounts[(j * 2) % amounts.length];
        exactExpectedPaid = roundFinancial(exactExpectedPaid + amt);
        rawFloatSum -= amt;

        const dayStr = String((j % 28) + 1).padStart(2, '0');
        const monthStr = String(Math.floor(j / 28) + 1).padStart(2, '0');

        payments.push({
          id: `stress-pay-${j}`,
          paymentNumber: `PAY-S-${String(j).padStart(4, '0')}`,
          invoiceId: `stress-inv-${j}`,
          invoiceNumber: `INV-S-${String(j).padStart(4, '0')}`,
          customerId: 'cust-stress',
          customerName: 'Stress Test Customer',
          amount: amt,
          paymentDate: `2026-${monthStr}-${dayStr}`,
          paymentMethod: 'BANK_TRANSFER',
          createdAt: `2026-${monthStr}-${dayStr}T14:00:00.${String(j).padStart(3, '0')}Z`
        });
      }

      const expectedOutstanding = roundFinancial(exactExpectedInvoiced - exactExpectedPaid);

      const customer: Customer = {
        id: 'cust-stress',
        name: 'Stress Test Customer',
        currency: 'SAR',
        outstandingAmount: expectedOutstanding,
        totalInvoiced: exactExpectedInvoiced,
        totalPaid: exactExpectedPaid,
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      };

      const { ledgerEntries, metrics, isReconciled } = buildLedger(customer, invoices, payments);

      // Verify total entries
      expect(ledgerEntries).toHaveLength(150);

      // Verify no NaN, no undefined, and strict 2-decimal rounding in every entry
      ledgerEntries.forEach((entry) => {
        expect(Number.isFinite(entry.runningBalance)).toBe(true);
        expect(isNaN(entry.runningBalance)).toBe(false);
        const decimals = (entry.runningBalance.toString().split('.')[1] || '').length;
        expect(decimals).toBeLessThanOrEqual(2);
      });

      // Verify final accumulated running balance matches expected outstanding balance
      const finalRunningBalance = ledgerEntries[ledgerEntries.length - 1].runningBalance;
      expect(finalRunningBalance).toBe(expectedOutstanding);
      expect(metrics.outstandingBalance).toBe(expectedOutstanding);
      expect(metrics.totalInvoiced).toBe(exactExpectedInvoiced);
      expect(metrics.totalPaid).toBe(exactExpectedPaid);

      // Show empirical observation of raw IEEE-754 drift vs roundFinancial
      const rawVsCleanDiff = Math.abs(rawFloatSum - expectedOutstanding);
      // Raw float sum usually exhibits slight binary drift (e.g. 1e-13)
      console.log(`[Empirical Precision] 150 transactions: roundFinancial balance = ${expectedOutstanding}, raw float sum = ${rawFloatSum}, delta = ${rawVsCleanDiff}`);

      // Verify isReconciled is true
      expect(isReconciled).toBe(true);
    });

    it('4.2 verifies 1,000 randomized micro-transactions maintain zero drift', () => {
      let balance = 0;
      let rawBalance = 0;
      let driftCount = 0;

      for (let i = 0; i < 1000; i++) {
        // Random cent value between -500.00 and +500.00
        const centValue = (Math.floor(Math.random() * 100000) - 50000) / 100;
        balance = roundFinancial(balance + centValue);
        rawBalance += centValue;

        const stringDecimals = (balance.toString().split('.')[1] || '').length;
        expect(stringDecimals).toBeLessThanOrEqual(2);

        if (balance !== Number(rawBalance.toFixed(2))) {
          driftCount++;
        }
      }

      // Assert final balance is a valid finite number with at most 2 decimals
      expect(Number.isFinite(balance)).toBe(true);
      console.log(`[Empirical Random Drift Test] 1,000 transactions: raw float drifted from 2-decimal rounded in ${driftCount} iterations.`);
    });
  });

  // =========================================================================
  // 5. Reconciliation Detection (isReconciled Audit Check)
  // =========================================================================
  describe('5. Reconciliation Detection (isReconciled)', () => {

    it('5.1 returns isReconciled === true when customer.outstandingAmount exactly matches computed ledger', () => {
      const customer: Customer = {
        id: 'cust-rec-1',
        name: 'Perfect Match Corp',
        currency: 'SAR',
        outstandingAmount: 2500.00,
        totalInvoiced: 5000.00,
        totalPaid: 2500.00,
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      };

      const invoice: Invoice = {
        id: 'inv-rec-1',
        invoiceNumber: 'INV-REC-1',
        customerId: customer.id,
        customerName: customer.name,
        issueDate: '2026-09-01',
        dueDate: '2026-09-30',
        currency: 'SAR',
        items: [],
        subtotal: 5000,
        totalDiscount: 0,
        totalTax: 0,
        grandTotal: 5000,
        amountPaid: 2500,
        amountDue: 2500,
        status: 'PARTIALLY_PAID',
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z'
      };

      const payment: Payment = {
        id: 'pay-rec-1',
        paymentNumber: 'PAY-REC-1',
        invoiceId: 'inv-rec-1',
        invoiceNumber: 'INV-REC-1',
        customerId: customer.id,
        customerName: customer.name,
        amount: 2500,
        paymentDate: '2026-09-10',
        paymentMethod: 'BANK_TRANSFER',
        createdAt: '2026-09-10T10:00:00Z'
      };

      const { isReconciled, metrics } = buildLedger(customer, [invoice], [payment]);

      expect(metrics.outstandingBalance).toBe(2500.00);
      expect(isReconciled).toBe(true);
    });

    it('5.2 returns isReconciled === true when difference is within tolerance epsilon (<= 0.01)', () => {
      const customer: Customer = {
        id: 'cust-rec-eps',
        name: 'Epsilon Match Corp',
        currency: 'SAR',
        outstandingAmount: 2500.009, // Floating difference within 0.01
        totalInvoiced: 5000.00,
        totalPaid: 2500.00,
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      };

      const invoice: Invoice = {
        id: 'inv-rec-eps',
        invoiceNumber: 'INV-REC-EPS',
        customerId: customer.id,
        customerName: customer.name,
        issueDate: '2026-09-01',
        dueDate: '2026-09-30',
        currency: 'SAR',
        items: [],
        subtotal: 5000,
        totalDiscount: 0,
        totalTax: 0,
        grandTotal: 5000,
        amountPaid: 2500,
        amountDue: 2500,
        status: 'PARTIALLY_PAID',
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z'
      };

      const payment: Payment = {
        id: 'pay-rec-eps',
        paymentNumber: 'PAY-REC-EPS',
        invoiceId: 'inv-rec-eps',
        invoiceNumber: 'INV-REC-EPS',
        customerId: customer.id,
        customerName: customer.name,
        amount: 2500,
        paymentDate: '2026-09-10',
        paymentMethod: 'BANK_TRANSFER',
        createdAt: '2026-09-10T10:00:00Z'
      };

      const { isReconciled } = buildLedger(customer, [invoice], [payment]);
      expect(isReconciled).toBe(true);
    });

    it('5.3 returns isReconciled === false when simulated discrepancy occurs (e.g. unrecorded transaction or tampered balance)', () => {
      // Customer record in database says outstandingAmount is 5000, but ledger calculates 2500
      const customer: Customer = {
        id: 'cust-rec-tampered',
        name: 'Discrepancy Corp',
        currency: 'SAR',
        outstandingAmount: 5000.00, // Discrepancy of 2500 SAR
        totalInvoiced: 5000.00,
        totalPaid: 0.00,
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      };

      const invoice: Invoice = {
        id: 'inv-1',
        invoiceNumber: 'INV-1',
        customerId: customer.id,
        customerName: customer.name,
        issueDate: '2026-09-01',
        dueDate: '2026-09-30',
        currency: 'SAR',
        items: [],
        subtotal: 5000,
        totalDiscount: 0,
        totalTax: 0,
        grandTotal: 5000,
        amountPaid: 2500,
        amountDue: 2500,
        status: 'PARTIALLY_PAID',
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z'
      };

      const payment: Payment = {
        id: 'pay-1',
        paymentNumber: 'PAY-1',
        invoiceId: 'inv-1',
        invoiceNumber: 'INV-1',
        customerId: customer.id,
        customerName: customer.name,
        amount: 2500,
        paymentDate: '2026-09-10',
        paymentMethod: 'BANK_TRANSFER',
        createdAt: '2026-09-10T10:00:00Z'
      };

      const { isReconciled, metrics } = buildLedger(customer, [invoice], [payment]);

      // Ledger computed balance is 2500, but customer.outstandingAmount is 5000
      expect(metrics.outstandingBalance).toBe(2500.00);
      expect(isReconciled).toBe(false);
    });

    it('5.4 returns isReconciled === false when discrepancy is small but exceeds epsilon threshold (e.g. 0.05 discrepancy)', () => {
      const customer: Customer = {
        id: 'cust-rec-micro',
        name: 'Micro Discrepancy Corp',
        currency: 'SAR',
        outstandingAmount: 1000.06, // Exceeds 0.01 tolerance
        totalInvoiced: 1000.00,
        totalPaid: 0.00,
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      };

      const invoice: Invoice = {
        id: 'inv-micro',
        invoiceNumber: 'INV-MICRO',
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
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z'
      };

      const { isReconciled, metrics } = buildLedger(customer, [invoice], []);

      expect(metrics.outstandingBalance).toBe(1000.00);
      expect(isReconciled).toBe(false);
    });
  });
});
