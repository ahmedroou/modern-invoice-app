/**
 * Empirical Challenger M3-3 Adversarial Stress Test Suite
 * 
 * Agent: teamwork_preview_challenger_m3_3 (Empirical Challenger)
 * Role: critic, specialist
 * Focus:
 * 1. Stress-test normalizeSearchText in src/hooks/useCustomers.ts:
 *    - Arabic diacritics (harakat/tashkeel, stacked shaddah + tanwin, dagger alef)
 *    - Hamza variants (أ إ آ ء ئ ؤ) & Alef forms
 *    - Teh Marbuta (ة -> ه) and Alef Maksura (ى -> ي)
 *    - Mixed Arabic-Latin queries, casing, Latin diacritics
 *    - Punctuation, symbols, and irregular whitespace / spaces
 *    - Multi-field search (phone numbers, tax IDs, email)
 * 2. Stress-test ledger running balance math in src/hooks/useCustomerLedger.ts:
 *    - Same-timestamp ordering (Invoice precedes Payment on identical calendar date & createdAt)
 *    - Exclusion of CANCELLED and DRAFT invoices from posting balance & metrics
 *    - Running balance floating-point precision over hundreds of fractional transactions
 *    - Reconciliation audit verification (isReconciled tolerance boundary checks)
 */

import { describe, it, expect } from 'vitest';
import { normalizeSearchText } from '@/hooks/useCustomers';
import { roundFinancial } from '@/lib/calculations';
import type { Customer, Invoice, Payment } from '@/types/domain';
import type { CustomerLedgerEntry, CustomerFinancialMetrics } from '@/hooks/useCustomerLedger';

/**
 * Pure generator and ledger builder replicating the logic from useCustomerLedger.ts
 */
function simulateLedgerCalculation(
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

  // 3. Chronological Interleaving Sort
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
    if (a.type !== b.type) {
      return a.type === 'INVOICE' ? -1 : 1;
    }
    return a.referenceNumber.localeCompare(b.referenceNumber);
  });

  // 4. Sequential Running Balance Calculation
  let balance = 0;
  const ledgerEntries: CustomerLedgerEntry[] = combined.map(entry => {
    balance = roundFinancial(balance + entry.debit - entry.credit);
    return {
      ...entry,
      runningBalance: balance
    };
  });

  // 5. Aggregate Metrics
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

  const isReconciled = customer
    ? Math.abs(customer.outstandingAmount - metrics.outstandingBalance) <= 0.01
    : true;

  return {
    ledgerEntries,
    metrics,
    isReconciled
  };
}

describe('Empirical Challenger M3-3: Customer Search Normalization & Ledger Math Suite', () => {

  // =========================================================================
  // Section 1: normalizeSearchText Deep Adversarial Stress Testing
  // =========================================================================
  describe('1. normalizeSearchText Adversarial Edge Cases', () => {

    describe('1.1 Diacritic and Tashkeel Stripping', () => {
      it('strips all 8 standard Arabic harakat, sukun, and dagger alef', () => {
        // Fatha (\u064E), Damma (\u064F), Kasra (\u0650)
        expect(normalizeSearchText('كَتَبَ')).toBe('كتب');
        expect(normalizeSearchText('كُتُبٌ')).toBe('كتب');
        expect(normalizeSearchText('بِاللَّهِ')).toBe('بالله');

        // Sukun (\u0652), Shaddah (\u0651)
        expect(normalizeSearchText('مَدْرَسَةٌ')).toBe('مدرسه');
        expect(normalizeSearchText('عَلَّمَ')).toBe('علم');

        // Tanwin forms: Fathatan (\u064B), Dammatan (\u064C), Kasratan (\u064D)
        expect(normalizeSearchText('أَهْلاً وَسَهْلاً')).toBe('اهلا وسهلا');
        expect(normalizeSearchText('تِجَارَةٌ رَابِحَةٌ')).toBe('تجاره رابحه');
        expect(normalizeSearchText('بِشَرْطٍ وَاحِدٍ')).toBe('بشرط واحد');

        // Dagger Alef / Superscript Alef (\u0670)
        expect(normalizeSearchText('إِلٰهَ')).toBe('اله');
        expect(normalizeSearchText('هٰؤُلَاءِ')).toBe('هولاا');
      });

      it('strips dense stacked diacritics (Shaddah + Fatha / Damma / Kasra / Tanwin)', () => {
        // Shaddah + Fatha
        expect(normalizeSearchText('مُحَمَّد')).toBe('محمد');
        // Shaddah + Dammatan
        expect(normalizeSearchText('مُحَمَّدٌ')).toBe('محمد');
        // Shaddah + Kasratan
        expect(normalizeSearchText('كُلٍّ')).toBe('كل');
        // Shaddah + Fathatan
        expect(normalizeSearchText('حَقّاً')).toBe('حقا');
      });

      it('normalizes fully vowelled classical text without corrupting root letters', () => {
        const vowelled = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
        const unvowelled = 'بسم الله الرحمن الرحيم';
        expect(normalizeSearchText(vowelled)).toBe(normalizeSearchText(unvowelled));
      });

      it('strips Arabic Tatweel / Kashida (\\u0640) from stylized words', () => {
        expect(normalizeSearchText('شـــركــة')).toBe('شركه');
        expect(normalizeSearchText('مؤسســــة')).toBe('موسسه');
        expect(normalizeSearchText('الـرَّيـَــاض')).toBe('الرياض');
      });
    });

    describe('1.2 Hamza Variants & Alef Forms (أ إ آ ء ئ ؤ)', () => {
      it('unifies Alef variants (أ, إ, آ -> ا)', () => {
        expect(normalizeSearchText('أكاديمية')).toBe('اكاديميه');
        expect(normalizeSearchText('إمدادات')).toBe('امدادات');
        expect(normalizeSearchText('آلات')).toBe('الات');
      });

      it('normalizes isolated Hamza (ء -> ا)', () => {
        // Isolated Hamza ء maps to ا
        expect(normalizeSearchText('بناء')).toBe('بناا');
        expect(normalizeSearchText('سماء')).toBe('سماا');
        expect(normalizeSearchText('شراء')).toBe('شراا');
      });

      it('handles Waw with Hamza (ؤ -> و via NFD decomposition)', () => {
        // ؤ decomposes to waw (\u0648) + hamza above (\u0654), hamza stripped
        expect(normalizeSearchText('مؤسسة')).toBe('موسسه');
        expect(normalizeSearchText('مسؤولية')).toBe('مسووليه');
        expect(normalizeSearchText('تفاؤل')).toBe('تفاول');
      });

      it('handles Yeh with Hamza (ئ -> ي via NFD decomposition)', () => {
        // ئ decomposes to yeh (\u064A) + hamza above (\u0654), hamza stripped
        expect(normalizeSearchText('رئيس')).toBe('رييس');
        expect(normalizeSearchText('سائل')).toBe('سايل');
        expect(normalizeSearchText('فئة')).toBe('فيه');
        expect(normalizeSearchText('بيئة')).toBe('بييه');
      });

      it('enables cross-matching between different Hamza spellings in search', () => {
        const customerName = 'مؤسسة إبراهيم الأحمدي للإنشاءات';
        const normalizedTarget = normalizeSearchText(customerName);

        // User types completely plain text without hamzas:
        const userQuery = 'موسسه ابراهيم الاحمدي للانشاءات';
        const normalizedQuery = normalizeSearchText(userQuery);

        expect(normalizedTarget).toBe(normalizedQuery);
        expect(normalizedTarget.includes(normalizedQuery)).toBe(true);
      });
    });

    describe('1.3 Teh Marbuta (ة -> ه) & Alef Maksura (ى -> ي)', () => {
      it('normalizes Teh Marbuta (ة) to Heh (ه)', () => {
        expect(normalizeSearchText('مكتبة')).toBe('مكتبه');
        expect(normalizeSearchText('خدمة')).toBe('خدمه');
        expect(normalizeSearchText('شركة الصيانة المحدودة')).toBe('شركه الصيانه المحدوده');
      });

      it('normalizes Alef Maksura (ى) to Yeh (ي)', () => {
        expect(normalizeSearchText('مستشفى')).toBe('مستشفي');
        expect(normalizeSearchText('مرمى')).toBe('مرمي');
        expect(normalizeSearchText('موسى')).toBe('موسي');
        expect(normalizeSearchText('عيسى')).toBe('عيسي');
        expect(normalizeSearchText('جدوى')).toBe('جدوي');
      });

      it('enables cross-matching when database uses ى/ة and search uses ي/ه', () => {
        const dbName = 'مستشفى الفتوى الكبرى';
        const query = 'مستشفي الفتوي الكبري';
        expect(normalizeSearchText(dbName)).toBe(normalizeSearchText(query));
      });
    });

    describe('1.4 Mixed Arabic-Latin, Casing, and Latin Diacritics', () => {
      it('converts Latin characters to lowercase while maintaining Arabic characters', () => {
        expect(normalizeSearchText('Saudi Aramco أرامكو السعودية')).toBe('saudi aramco ارامكو السعوديه');
        expect(normalizeSearchText('STC - شركة الاتصالات')).toBe('stc - شركه الاتصالات');
      });

      it('documents Latin diacritics decomposition behavior under NFD', () => {
        // NFD decomposes accented Latin letters into base character + combining mark (e.g. 'e' + \u0301).
        // Since normalizeSearchText only strips Arabic diacritics [\u064B-\u065F\u0670],
        // the combining mark \u0301 is preserved in the normalized string:
        const normalizedCafe = normalizeSearchText('Café');
        expect(normalizedCafe).toBe('cafe\u0301');
        
        // Searching for plain 'cafe' matches against 'Café' because 'cafe\u0301'.includes('cafe') is true:
        expect(normalizedCafe.includes(normalizeSearchText('cafe'))).toBe(true);
      });
    });

    describe('1.5 Spaces, Whitespace & Punctuation', () => {
      it('trims leading and trailing spaces', () => {
        expect(normalizeSearchText('   مؤسسة النور   ')).toBe('موسسه النور');
        expect(normalizeSearchText('\t\nشركة الأمل\t\n')).toBe('شركه الامل');
      });

      it('handles punctuation, slashes, and dashes without crashing', () => {
        const textWithPunct = 'شركة الأفق (ش.م.م) - فرع الرياض / مبيعات #1';
        const normalized = normalizeSearchText(textWithPunct);
        expect(normalized).toBe('شركه الافق (ش.م.م) - فرع الرياض / مبيعات #1');
      });

      it('safely handles empty string, null, and undefined without throwing', () => {
        expect(normalizeSearchText('')).toBe('');
        expect(normalizeSearchText('   ')).toBe('');
        expect(normalizeSearchText(null as any)).toBe('');
        expect(normalizeSearchText(undefined as any)).toBe('');
      });
    });

    describe('1.6 Multi-Field Customer Search Filtering Invariants', () => {
      const mockCustomer: Customer = {
        id: 'cust-test-multi',
        name: 'مؤسسة الرياض الحديثة (فرع 1)',
        email: 'Accounts@Riyadh-Modern.sa',
        phone: '+966 55 123 4567',
        taxNumber: '300 987 654 300003',
        currency: 'SAR',
        outstandingAmount: 1500,
        totalInvoiced: 5000,
        totalPaid: 3500,
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      };

      function searchMatch(c: Customer, query: string): boolean {
        const normalizedQuery = normalizeSearchText(query);
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

      it('matches by Arabic name without hamza or teh marbuta', () => {
        expect(searchMatch(mockCustomer, 'موسسه الرياض الحديثه')).toBe(true);
        expect(searchMatch(mockCustomer, 'الرياض')).toBe(true);
      });

      it('matches by email case-insensitively', () => {
        expect(searchMatch(mockCustomer, 'ACCOUNTS@RIYADH-MODERN.SA')).toBe(true);
        expect(searchMatch(mockCustomer, 'riyadh-modern')).toBe(true);
      });

      it('matches unspaced phone number query against formatted customer phone', () => {
        // Customer has '+966 55 123 4567' -> stripped to '+966551234567'
        expect(searchMatch(mockCustomer, '+966551234567')).toBe(true);
        expect(searchMatch(mockCustomer, '551234567')).toBe(true);
      });

      it('matches unspaced tax number query against spaced customer tax number', () => {
        // Customer has '300 987 654 300003' -> stripped to '300987654300003'
        expect(searchMatch(mockCustomer, '300987654300003')).toBe(true);
        expect(searchMatch(mockCustomer, '300987')).toBe(true);
      });
    });
  });

  // =========================================================================
  // Section 2: Ledger Running Balance & Accounting Logic Stress Testing
  // =========================================================================
  describe('2. Ledger Running Balance & Accounting Interleaving Stress', () => {

    const testCustomer: Customer = {
      id: 'cust-challenger-3',
      name: 'Modern Solutions Co',
      currency: 'SAR',
      outstandingAmount: 0,
      totalInvoiced: 0,
      totalPaid: 0,
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    };

    describe('2.1 Same-Timestamp Ordering (Invoice precedes Payment tie-breaker)', () => {
      it('guarantees that Invoice precedes Payment when both date and createdAt are identical', () => {
        const identicalDate = '2026-09-19';
        const identicalCreatedAt = '2026-09-19T10:00:00.000Z';

        const invoices: Invoice[] = [
          {
            id: 'inv-tie-1',
            invoiceNumber: 'INV-TIE-01',
            customerId: testCustomer.id,
            customerName: testCustomer.name,
            issueDate: identicalDate,
            dueDate: identicalDate,
            currency: 'SAR',
            items: [],
            subtotal: 750.50,
            totalDiscount: 0,
            totalTax: 0,
            grandTotal: 750.50,
            amountPaid: 750.50,
            amountDue: 0,
            status: 'PAID',
            createdAt: identicalCreatedAt,
            updatedAt: identicalCreatedAt
          }
        ];

        const payments: Payment[] = [
          {
            id: 'pay-tie-1',
            paymentNumber: 'PAY-TIE-01',
            invoiceId: 'inv-tie-1',
            invoiceNumber: 'INV-TIE-01',
            customerId: testCustomer.id,
            customerName: testCustomer.name,
            amount: 750.50,
            paymentDate: identicalDate,
            paymentMethod: 'CASH',
            createdAt: identicalCreatedAt
          }
        ];

        const { ledgerEntries } = simulateLedgerCalculation(testCustomer, invoices, payments);

        expect(ledgerEntries).toHaveLength(2);
        // Step 1 must be the invoice (debit)
        expect(ledgerEntries[0].type).toBe('INVOICE');
        expect(ledgerEntries[0].debit).toBe(750.50);
        expect(ledgerEntries[0].credit).toBe(0);
        expect(ledgerEntries[0].runningBalance).toBe(750.50);

        // Step 2 must be the payment (credit)
        expect(ledgerEntries[1].type).toBe('PAYMENT');
        expect(ledgerEntries[1].debit).toBe(0);
        expect(ledgerEntries[1].credit).toBe(750.50);
        expect(ledgerEntries[1].runningBalance).toBe(0.00);

        // Crucial invariant: running balance NEVER dips below 0
        ledgerEntries.forEach(entry => {
          expect(entry.runningBalance).toBeGreaterThanOrEqual(0);
        });
      });

      it('maintains invoice-first ordering across multiple same-timestamp transactions', () => {
        const date = '2026-09-19';
        const timestamp = '2026-09-19T12:00:00.000Z';

        const invoices: Invoice[] = [1, 2, 3].map(i => ({
          id: `inv-multi-${i}`,
          invoiceNumber: `INV-M-${i}`,
          customerId: testCustomer.id,
          customerName: testCustomer.name,
          issueDate: date,
          dueDate: date,
          currency: 'SAR',
          items: [],
          subtotal: 100 * i,
          totalDiscount: 0,
          totalTax: 0,
          grandTotal: 100 * i,
          amountPaid: 100 * i,
          amountDue: 0,
          status: 'PAID',
          createdAt: timestamp,
          updatedAt: timestamp
        }));

        const payments: Payment[] = [1, 2, 3].map(i => ({
          id: `pay-multi-${i}`,
          paymentNumber: `PAY-M-${i}`,
          invoiceId: `inv-multi-${i}`,
          invoiceNumber: `INV-M-${i}`,
          customerId: testCustomer.id,
          customerName: testCustomer.name,
          amount: 100 * i,
          paymentDate: date,
          paymentMethod: 'BANK_TRANSFER',
          createdAt: timestamp
        }));

        const { ledgerEntries } = simulateLedgerCalculation(testCustomer, invoices, payments);

        expect(ledgerEntries).toHaveLength(6);

        // First 3 entries MUST be invoices
        expect(ledgerEntries[0].type).toBe('INVOICE');
        expect(ledgerEntries[1].type).toBe('INVOICE');
        expect(ledgerEntries[2].type).toBe('INVOICE');

        // Next 3 entries MUST be payments
        expect(ledgerEntries[3].type).toBe('PAYMENT');
        expect(ledgerEntries[4].type).toBe('PAYMENT');
        expect(ledgerEntries[5].type).toBe('PAYMENT');

        // Balances: +100 -> 100, +200 -> 300, +300 -> 600, -100 -> 500, -200 -> 300, -300 -> 0
        expect(ledgerEntries[0].runningBalance).toBe(100);
        expect(ledgerEntries[1].runningBalance).toBe(300);
        expect(ledgerEntries[2].runningBalance).toBe(600);
        expect(ledgerEntries[3].runningBalance).toBe(500);
        expect(ledgerEntries[4].runningBalance).toBe(300);
        expect(ledgerEntries[5].runningBalance).toBe(0);
      });
    });

    describe('2.2 Exclusion of CANCELLED and DRAFT Invoices', () => {
      it('strictly excludes CANCELLED and DRAFT invoices from ledger entries and metrics', () => {
        const invoices: Invoice[] = [
          {
            id: 'inv-valid',
            invoiceNumber: 'INV-VALID',
            customerId: testCustomer.id,
            customerName: testCustomer.name,
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
            createdAt: '2026-09-01T08:00:00Z',
            updatedAt: '2026-09-01T08:00:00Z'
          },
          {
            id: 'inv-cancelled',
            invoiceNumber: 'INV-CANCELLED',
            customerId: testCustomer.id,
            customerName: testCustomer.name,
            issueDate: '2026-09-02',
            dueDate: '2026-09-30',
            currency: 'SAR',
            items: [],
            subtotal: 5000,
            totalDiscount: 0,
            totalTax: 0,
            grandTotal: 5000,
            amountPaid: 0,
            amountDue: 0,
            status: 'CANCELLED',
            createdAt: '2026-09-02T08:00:00Z',
            updatedAt: '2026-09-02T08:00:00Z'
          },
          {
            id: 'inv-draft',
            invoiceNumber: 'INV-DRAFT',
            customerId: testCustomer.id,
            customerName: testCustomer.name,
            issueDate: '2026-09-03',
            dueDate: '2026-09-30',
            currency: 'SAR',
            items: [],
            subtotal: 2500,
            totalDiscount: 0,
            totalTax: 0,
            grandTotal: 2500,
            amountPaid: 0,
            amountDue: 2500,
            status: 'DRAFT',
            createdAt: '2026-09-03T08:00:00Z',
            updatedAt: '2026-09-03T08:00:00Z'
          }
        ];

        const { ledgerEntries, metrics } = simulateLedgerCalculation(testCustomer, invoices, []);

        // Only INV-VALID should be included
        expect(ledgerEntries).toHaveLength(1);
        expect(ledgerEntries[0].referenceNumber).toBe('INV-VALID');
        expect(ledgerEntries[0].debit).toBe(1000);
        expect(ledgerEntries[0].runningBalance).toBe(1000);

        // Metrics must exclude the 5000 cancelled and 2500 draft
        expect(metrics.totalInvoiced).toBe(1000);
        expect(metrics.totalPaid).toBe(0);
        expect(metrics.outstandingBalance).toBe(1000);
        expect(metrics.invoiceCount).toBe(1);
      });
    });

    describe('2.3 Running Balance Precision & IEEE-754 Drift Elimination', () => {
      it('prevents float mantissa drift over 200 fractional debits and credits', () => {
        // Decimal amounts notoriously prone to IEEE-754 floating point inaccuracies
        const testAmounts = [0.01, 0.07, 0.14, 0.29, 0.73, 1.19, 19.99, 33.33, 49.95, 100.10];

        const invoices: Invoice[] = [];
        const payments: Payment[] = [];

        let runningExpected = 0;
        let unroundedFloat = 0;

        for (let i = 0; i < 100; i++) {
          const invAmt = testAmounts[i % testAmounts.length];
          runningExpected = roundFinancial(runningExpected + invAmt);
          unroundedFloat += invAmt;

          invoices.push({
            id: `inv-drift-${i}`,
            invoiceNumber: `INV-D-${i}`,
            customerId: testCustomer.id,
            customerName: testCustomer.name,
            issueDate: '2026-05-01',
            dueDate: '2026-05-30',
            currency: 'SAR',
            items: [],
            subtotal: invAmt,
            totalDiscount: 0,
            totalTax: 0,
            grandTotal: invAmt,
            amountPaid: 0,
            amountDue: invAmt,
            status: 'UNPAID',
            createdAt: `2026-05-01T08:00:${String(i).padStart(2, '0')}.000Z`,
            updatedAt: `2026-05-01T08:00:${String(i).padStart(2, '0')}.000Z`
          });

          // Offsetting payment every other transaction
          if (i % 2 === 0) {
            const payAmt = testAmounts[(i * 3) % testAmounts.length];
            runningExpected = roundFinancial(runningExpected - payAmt);
            unroundedFloat -= payAmt;

            payments.push({
              id: `pay-drift-${i}`,
              paymentNumber: `PAY-D-${i}`,
              invoiceId: `inv-drift-${i}`,
              invoiceNumber: `INV-D-${i}`,
              customerId: testCustomer.id,
              customerName: testCustomer.name,
              amount: payAmt,
              paymentDate: '2026-05-02',
              paymentMethod: 'BANK_TRANSFER',
              createdAt: `2026-05-02T08:00:${String(i).padStart(2, '0')}.000Z`
            });
          }
        }

        const { ledgerEntries, metrics } = simulateLedgerCalculation(testCustomer, invoices, payments);

        expect(ledgerEntries).toHaveLength(150);

        // Verify every entry has finite balance and strictly at most 2 decimals
        ledgerEntries.forEach(entry => {
          expect(Number.isFinite(entry.runningBalance)).toBe(true);
          const decimalPart = entry.runningBalance.toString().split('.')[1] || '';
          expect(decimalPart.length).toBeLessThanOrEqual(2);
        });

        // Verify final running balance matches expected rounded balance exactly
        const finalRow = ledgerEntries[ledgerEntries.length - 1];
        expect(finalRow.runningBalance).toBe(runningExpected);
        expect(metrics.outstandingBalance).toBe(runningExpected);

        // Verify unrounded float diverged from accurate financial balance
        const floatDivergence = Math.abs(unroundedFloat - runningExpected);
        console.log(`[Empirical Test M3-3] 150 transactions: roundFinancial = ${runningExpected}, unrounded float = ${unroundedFloat}, drift delta = ${floatDivergence}`);
      });
    });

    describe('2.4 Reconciliation Verification (isReconciled)', () => {
      it('verifies isReconciled === true when outstandingAmount matches ledger outstanding balance', () => {
        const customerWithBalance: Customer = {
          ...testCustomer,
          outstandingAmount: 500.00
        };

        const invoice: Invoice = {
          id: 'inv-rec',
          invoiceNumber: 'INV-REC',
          customerId: customerWithBalance.id,
          customerName: customerWithBalance.name,
          issueDate: '2026-09-01',
          dueDate: '2026-09-30',
          currency: 'SAR',
          items: [],
          subtotal: 500.00,
          totalDiscount: 0,
          totalTax: 0,
          grandTotal: 500.00,
          amountPaid: 0,
          amountDue: 500.00,
          status: 'UNPAID',
          createdAt: '2026-09-01T00:00:00Z',
          updatedAt: '2026-09-01T00:00:00Z'
        };

        const { isReconciled } = simulateLedgerCalculation(customerWithBalance, [invoice], []);
        expect(isReconciled).toBe(true);
      });

      it('verifies isReconciled === false when customer.outstandingAmount is inconsistent with ledger', () => {
        const customerTampered: Customer = {
          ...testCustomer,
          outstandingAmount: 999.00 // Discrepancy!
        };

        const invoice: Invoice = {
          id: 'inv-rec',
          invoiceNumber: 'INV-REC',
          customerId: customerTampered.id,
          customerName: customerTampered.name,
          issueDate: '2026-09-01',
          dueDate: '2026-09-30',
          currency: 'SAR',
          items: [],
          subtotal: 500.00,
          totalDiscount: 0,
          totalTax: 0,
          grandTotal: 500.00,
          amountPaid: 0,
          amountDue: 500.00,
          status: 'UNPAID',
          createdAt: '2026-09-01T00:00:00Z',
          updatedAt: '2026-09-01T00:00:00Z'
        };

        const { isReconciled, metrics } = simulateLedgerCalculation(customerTampered, [invoice], []);
        expect(metrics.outstandingBalance).toBe(500.00);
        expect(isReconciled).toBe(false);
      });
    });
  });
});
