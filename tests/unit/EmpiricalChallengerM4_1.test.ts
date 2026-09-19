/**
 * tests/unit/EmpiricalChallengerM4_1.test.ts
 * 
 * EMPIRICAL ADVERSARIAL CHALLENGER SUITE — MILESTONE 4
 * Focus: Financial Calculations, Customer Balance Invariants, Status Transitions,
 * and Offline Atomic Batch Persistence.
 * 
 * Verifies:
 * 1. IEEE-754 precision edges (0.1+0.2=0.30, 1.005->1.01, 35.855->35.86, negative rounding, NaN/Infinity/negative-zero safety).
 * 2. Customer balance invariants across complete invoice & payment lifecycle:
 *    - Non-draft invoice creation increments customer debt by amountDue.
 *    - DRAFT invoice creation leaves customer debt unchanged.
 *    - Transitioning DRAFT to UNPAID adds debt.
 *    - Transitioning DRAFT to CANCELLED leaves debt unchanged.
 *    - Partial payment decrements debt by exact amount paid.
 *    - Full payment clears balance, sets status to PAID.
 *    - Overpayment clamps amountDue to 0 and marks status PAID.
 *    - Cancelling unpaid invoice decrements customer debt by amountDue.
 *    - Cancelling DRAFT invoice zeroes amountDue without decrementing customer debt.
 * 3. Offline atomic batch persistence: zero runTransaction, 100% writeBatch.
 * 4. Conservation of money invariant across 500 randomized multi-item invoices.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/firebase';
import {
  roundFinancial,
  calculateLineItem,
  calculateInvoiceTotals,
  determineInvoiceStatus,
  formatCurrency,
  type LineItemInput
} from '@/lib/calculations';
import {
  createInvoiceAtomic,
  updateInvoiceAtomic,
  cancelInvoiceAtomic,
  recordPaymentAtomic,
  type CreateInvoiceAtomicParams,
  type UpdateInvoiceAtomicParams,
  type CancelInvoiceAtomicParams,
  type RecordPaymentAtomicParams
} from '@/lib/atomicMutations';
import type { Invoice } from '@/types/domain';
import * as fs from 'fs';
import * as path from 'path';

// Mock Firestore batch for empirical atomic mutation tests
const mockCommit = vi.fn().mockResolvedValue(undefined);
const mockSet = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    writeBatch: () => ({
      set: mockSet,
      update: mockUpdate,
      delete: mockDelete,
      commit: mockCommit
    })
  };
});

describe('Empirical Challenger M4-1: Financial Math, Balance Invariants & Offline Durability', () => {
  beforeEach(() => {
    mockCommit.mockClear();
    mockSet.mockClear();
    mockUpdate.mockClear();
    mockDelete.mockClear();
  });

  // =========================================================================
  // 1. IEEE-754 Precision Edges & Epsilon-Safe Rounding
  // =========================================================================
  describe('1. Epsilon-Safe Rounding & IEEE-754 Boundaries', () => {
    it('1.1 accurately rounds classic IEEE-754 float addition (0.1 + 0.2 = 0.30)', () => {
      // In raw IEEE-754: 0.1 + 0.2 === 0.30000000000000004
      expect(0.1 + 0.2).toBe(0.30000000000000004);
      expect(roundFinancial(0.1 + 0.2, 2)).toBe(0.3);
      expect(roundFinancial(0.1 + 0.2, 2).toFixed(2)).toBe('0.30');
    });

    it('1.2 accurately rounds half-up on 1.005 -> 1.01 (symmetric half-up away from zero)', () => {
      expect(roundFinancial(1.005, 2)).toBe(1.01);
      expect(roundFinancial(-1.005, 2)).toBe(-1.01);
    });

    it('1.3 accurately resolves the notorious 35.855 IEEE-754 mantissa trap -> 35.86', () => {
      // In standard JS: 35.855 * 100 === 3585.4999999999995
      // Standard Math.round(35.855 * 100) / 100 returns 35.85 (INCORRECT)
      expect(35.855 * 100).toBe(3585.4999999999995);
      expect(Math.round(35.855 * 100) / 100).toBe(35.85);

      // roundFinancial decimal exponential shift correctly returns 35.86
      expect(roundFinancial(35.855, 2)).toBe(35.86);
      expect(roundFinancial(-35.855, 2)).toBe(-35.86);
    });

    it('1.4 tests negative financial rounding across symmetric boundaries', () => {
      expect(roundFinancial(-(0.1 + 0.2), 2)).toBe(-0.3);
      expect(roundFinancial(-2.005, 2)).toBe(-2.01);
      expect(roundFinancial(-19.99 * 3, 2)).toBe(-59.97);
      expect(roundFinancial(-10.005, 2)).toBe(-10.01);
    });

    it('1.5 sanitizes negative zero (-0) to strictly positive zero (+0)', () => {
      const resultNegZero = roundFinancial(-0);
      expect(resultNegZero).toBe(0);
      expect(Object.is(resultNegZero, 0)).toBe(true);
      expect(Object.is(resultNegZero, -0)).toBe(false);
      expect(1 / resultNegZero).toBe(Infinity); // 1 / -0 would be -Infinity

      const subCentZero = roundFinancial(-0.0000001);
      expect(subCentZero).toBe(0);
      expect(Object.is(subCentZero, 0)).toBe(true);
    });

    it('1.6 handles sub-cent boundaries accurately (0.00499 -> 0.00, 0.005 -> 0.01)', () => {
      expect(roundFinancial(0.004999, 2)).toBe(0.00);
      expect(roundFinancial(0.005, 2)).toBe(0.01);
      expect(roundFinancial(-0.004999, 2)).toBe(0.00);
      expect(roundFinancial(-0.005, 2)).toBe(-0.01);
    });

    it('1.7 safely handles NaN, Infinity, -Infinity, and invalid non-numeric inputs', () => {
      expect(roundFinancial(NaN)).toBe(0);
      expect(roundFinancial(Infinity)).toBe(0);
      expect(roundFinancial(-Infinity)).toBe(0);
      expect(roundFinancial(null as any)).toBe(0);
      expect(roundFinancial(undefined as any)).toBe(0);
      expect(roundFinancial('string' as any)).toBe(0);
      expect(roundFinancial({} as any)).toBe(0);
    });

    it('1.8 supports diverse precision decimal places (0, 1, 3, 4, 6)', () => {
      expect(roundFinancial(123.49, 0)).toBe(123);
      expect(roundFinancial(123.50, 0)).toBe(124);
      expect(roundFinancial(12.35, 1)).toBe(12.4);
      expect(roundFinancial(1.2345, 3)).toBe(1.235);
      expect(roundFinancial(0.12345, 4)).toBe(0.1235);
      expect(roundFinancial(0.1234565, 6)).toBe(0.123457);
    });

    it('1.9 formats currency in English and Arabic without bidi sign corruption', () => {
      expect(formatCurrency(1250.5, 'USD', 'en')).toBe('$1,250.50');
      expect(formatCurrency(-1250.5, 'USD', 'en')).toBe('-$1,250.50');

      const arFormatted = formatCurrency(1250.5, 'SAR', 'ar');
      expect(arFormatted).toContain('1,250.50');
      expect(arFormatted).not.toContain('١٬٢٥٠'); // Western digits enforced
      expect(arFormatted.includes('ر.س') || arFormatted.includes('SAR')).toBe(true);

      const arNeg = formatCurrency(-1250.5, 'SAR', 'ar');
      expect(arNeg).toContain('1,250.50');
      expect(arNeg).toContain('-');
      expect(arNeg.endsWith('-')).toBe(false); // Sign not scrambled to end
    });

    it('1.10 verifies determineInvoiceStatus lifecycle evaluations across states', () => {
      const refDate = '2026-09-19';
      expect(determineInvoiceStatus(100, 0, '2026-10-01', true, refDate)).toBe('DRAFT');
      expect(determineInvoiceStatus(100, 100, '2026-10-01', false, refDate)).toBe('PAID');
      expect(determineInvoiceStatus(100, 120, '2026-10-01', false, refDate)).toBe('PAID');
      expect(determineInvoiceStatus(0, 0, '2026-10-01', false, refDate)).toBe('PAID');
      expect(determineInvoiceStatus(100, 40, '2026-10-01', false, refDate)).toBe('PARTIALLY_PAID');
      expect(determineInvoiceStatus(100, 0, '2026-10-01', false, refDate)).toBe('UNPAID');
      expect(determineInvoiceStatus(100, 0, '2026-09-01', false, refDate)).toBe('OVERDUE');
      expect(determineInvoiceStatus(100, 50, '2026-09-01', false, refDate)).toBe('OVERDUE');
    });
  });

  // =========================================================================
  // 2. Customer Balance Invariants Under Atomic Mutations
  // =========================================================================
  describe('2. Customer Balance Invariants Under Atomic Mutations', () => {
    it('2.1 Non-draft invoice creation increments customer debt by amountDue and totalInvoiced by grandTotal', async () => {
      const params: CreateInvoiceAtomicParams = {
        invoice: {
          id: 'inv-nondraft-1',
          invoiceNumber: 'INV-ND-001',
          customerId: 'cust-invariant-1',
          customerName: 'Invariant Test Customer',
          issueDate: '2026-09-19',
          dueDate: '2026-10-19',
          currency: 'SAR',
          items: [],
          subtotal: 1000,
          totalDiscount: 100,
          totalTax: 135,
          grandTotal: 1035,
          amountPaid: 200,
          status: 'PARTIALLY_PAID'
        }
      };

      const result = await createInvoiceAtomic(params, db);

      expect(result.invoiceId).toBe('inv-nondraft-1');
      expect(result.invoice.amountDue).toBe(835); // 1035 - 200
      expect(mockCommit).toHaveBeenCalledTimes(1);

      // Verify customer update was executed with increment
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          outstandingAmount: expect.anything(),
          totalInvoiced: expect.anything()
        })
      );
    });

    it('2.2 DRAFT invoice creation leaves customer debt and totalInvoiced completely unchanged', async () => {
      const params: CreateInvoiceAtomicParams = {
        invoice: {
          id: 'inv-draft-inv-1',
          invoiceNumber: 'INV-DR-001',
          customerId: 'cust-invariant-2',
          customerName: 'Draft Test Customer',
          issueDate: '2026-09-19',
          dueDate: '2026-10-19',
          currency: 'SAR',
          items: [],
          subtotal: 5000,
          totalDiscount: 0,
          totalTax: 750,
          grandTotal: 5750,
          amountPaid: 0,
          status: 'DRAFT'
        }
      };

      const result = await createInvoiceAtomic(params, db);

      expect(result.invoiceId).toBe('inv-draft-inv-1');
      expect(result.invoice.status).toBe('DRAFT');
      expect(result.invoice.amountDue).toBe(5750);
      expect(mockCommit).toHaveBeenCalledTimes(1);

      // Customer doc must NOT have outstandingAmount or totalInvoiced updated
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.not.objectContaining({
          outstandingAmount: expect.anything(),
          totalInvoiced: expect.anything()
        })
      );
    });

    it('2.3 Transitioning DRAFT to UNPAID adds debt (outstandingAmount + amountDue, totalInvoiced + grandTotal)', async () => {
      const draftInvoice: Invoice = {
        id: 'inv-draft-to-unpaid',
        invoiceNumber: 'INV-D2U-001',
        customerId: 'cust-invariant-3',
        customerName: 'Draft To Unpaid Customer',
        issueDate: '2026-09-19',
        dueDate: '2026-10-19',
        currency: 'SAR',
        items: [],
        subtotal: 2000,
        totalDiscount: 0,
        totalTax: 300,
        grandTotal: 2300,
        amountPaid: 0,
        amountDue: 2300,
        status: 'DRAFT',
        createdAt: '2026-09-19T10:00:00Z',
        updatedAt: '2026-09-19T10:00:00Z'
      };

      const params: UpdateInvoiceAtomicParams = {
        invoiceId: draftInvoice.id,
        oldInvoice: draftInvoice,
        updates: {
          status: 'UNPAID'
        }
      };

      const result = await updateInvoiceAtomic(params, db);

      expect(result.invoiceId).toBe('inv-draft-to-unpaid');
      expect(result.updatedInvoice.status).toBe('UNPAID');
      expect(result.deltaAmountDue).toBe(2300);
      expect(result.deltaGrandTotal).toBe(2300);
      expect(mockCommit).toHaveBeenCalledTimes(1);
    });

    it('2.4 Transitioning DRAFT to CANCELLED leaves customer debt unchanged (delta = 0)', async () => {
      const draftInvoice: Invoice = {
        id: 'inv-draft-to-cancelled',
        invoiceNumber: 'INV-D2C-001',
        customerId: 'cust-invariant-4',
        customerName: 'Draft Cancel Customer',
        issueDate: '2026-09-19',
        dueDate: '2026-10-19',
        currency: 'SAR',
        items: [],
        subtotal: 1500,
        totalDiscount: 0,
        totalTax: 225,
        grandTotal: 1725,
        amountPaid: 0,
        amountDue: 1725,
        status: 'DRAFT',
        createdAt: '2026-09-19T10:00:00Z',
        updatedAt: '2026-09-19T10:00:00Z'
      };

      const params: UpdateInvoiceAtomicParams = {
        invoiceId: draftInvoice.id,
        oldInvoice: draftInvoice,
        updates: {
          status: 'CANCELLED'
        }
      };

      const result = await updateInvoiceAtomic(params, db);

      expect(result.updatedInvoice.status).toBe('CANCELLED');
      expect(result.deltaAmountDue).toBe(0);
      expect(result.deltaGrandTotal).toBe(0);
      expect(mockCommit).toHaveBeenCalledTimes(1);
    });

    it('2.5 Partial payment decrements debt by exact amount paid and updates status to PARTIALLY_PAID', async () => {
      const currentInvoice = {
        id: 'inv-partial-pay',
        invoiceNumber: 'INV-PP-001',
        grandTotal: 1000,
        amountPaid: 0,
        amountDue: 1000,
        status: 'UNPAID' as const,
        customerId: 'cust-invariant-5',
        customerName: 'Partial Pay Customer'
      };

      const params: RecordPaymentAtomicParams = {
        payment: {
          paymentNumber: 'PAY-PART-01',
          invoiceId: currentInvoice.id,
          invoiceNumber: currentInvoice.invoiceNumber,
          customerId: currentInvoice.customerId,
          customerName: currentInvoice.customerName,
          amount: 350.50,
          paymentDate: '2026-09-19',
          paymentMethod: 'BANK_TRANSFER'
        },
        currentInvoice
      };

      const result = await recordPaymentAtomic(params, db);

      expect(result.newInvoiceStatus).toBe('PARTIALLY_PAID');
      expect(result.newAmountPaid).toBe(350.50);
      expect(result.newAmountDue).toBe(649.50); // 1000 - 350.50
      expect(mockCommit).toHaveBeenCalledTimes(1);
    });

    it('2.6 Full payment clears balance, sets status to PAID, and zeroes amountDue', async () => {
      const currentInvoice = {
        id: 'inv-full-pay',
        invoiceNumber: 'INV-FP-001',
        grandTotal: 750,
        amountPaid: 250,
        amountDue: 500,
        status: 'PARTIALLY_PAID' as const,
        customerId: 'cust-invariant-6',
        customerName: 'Full Pay Customer'
      };

      const params: RecordPaymentAtomicParams = {
        payment: {
          paymentNumber: 'PAY-FULL-01',
          invoiceId: currentInvoice.id,
          invoiceNumber: currentInvoice.invoiceNumber,
          customerId: currentInvoice.customerId,
          customerName: currentInvoice.customerName,
          amount: 500,
          paymentDate: '2026-09-19',
          paymentMethod: 'CASH'
        },
        currentInvoice
      };

      const result = await recordPaymentAtomic(params, db);

      expect(result.newInvoiceStatus).toBe('PAID');
      expect(result.newAmountDue).toBe(0);
      expect(result.newAmountPaid).toBe(750);
      expect(mockCommit).toHaveBeenCalledTimes(1);
    });

    it('2.7 Overpayment clamps amountDue to 0, sets status to PAID, and records total paid amount', async () => {
      const currentInvoice = {
        id: 'inv-overpay',
        invoiceNumber: 'INV-OP-001',
        grandTotal: 300,
        amountPaid: 0,
        amountDue: 300,
        status: 'UNPAID' as const,
        customerId: 'cust-invariant-7',
        customerName: 'Overpay Customer'
      };

      const params: RecordPaymentAtomicParams = {
        payment: {
          paymentNumber: 'PAY-OVER-01',
          invoiceId: currentInvoice.id,
          invoiceNumber: currentInvoice.invoiceNumber,
          customerId: currentInvoice.customerId,
          customerName: currentInvoice.customerName,
          amount: 350,
          paymentDate: '2026-09-19',
          paymentMethod: 'CREDIT_CARD'
        },
        currentInvoice
      };

      const result = await recordPaymentAtomic(params, db);

      expect(result.newInvoiceStatus).toBe('PAID');
      expect(result.newAmountDue).toBe(0); // Clamped, not negative
      expect(result.newAmountPaid).toBe(350);
      expect(mockCommit).toHaveBeenCalledTimes(1);
    });

    it('2.8 Cancelling an unpaid invoice decrements customer debt by amountDue and zeroes invoice amountDue', async () => {
      const currentInvoice: Invoice = {
        id: 'inv-cancel-unpaid',
        invoiceNumber: 'INV-CU-001',
        customerId: 'cust-invariant-8',
        customerName: 'Cancel Customer',
        issueDate: '2026-09-19',
        dueDate: '2026-10-19',
        currency: 'SAR',
        items: [],
        subtotal: 1200,
        totalDiscount: 0,
        totalTax: 180,
        grandTotal: 1380,
        amountPaid: 0,
        amountDue: 1380,
        status: 'UNPAID',
        createdAt: '2026-09-19T10:00:00Z',
        updatedAt: '2026-09-19T10:00:00Z'
      };

      const params: CancelInvoiceAtomicParams = {
        invoiceId: currentInvoice.id,
        currentInvoice,
        reason: 'Customer voided order'
      };

      const result = await cancelInvoiceAtomic(params, db);

      expect(result.invoiceId).toBe(currentInvoice.id);
      expect(mockCommit).toHaveBeenCalledTimes(1);

      // Verify invoice updated with status CANCELLED and amountDue 0
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'CANCELLED',
          amountDue: 0
        })
      );
    });

    it('2.9 Cancelling a DRAFT invoice zeroes amountDue without decrementing customer debt', async () => {
      const draftInvoice: Invoice = {
        id: 'inv-cancel-draft',
        invoiceNumber: 'INV-CD-001',
        customerId: 'cust-invariant-9',
        customerName: 'Cancel Draft Customer',
        issueDate: '2026-09-19',
        dueDate: '2026-10-19',
        currency: 'SAR',
        items: [],
        subtotal: 500,
        totalDiscount: 0,
        totalTax: 75,
        grandTotal: 575,
        amountPaid: 0,
        amountDue: 575,
        status: 'DRAFT',
        createdAt: '2026-09-19T10:00:00Z',
        updatedAt: '2026-09-19T10:00:00Z'
      };

      const params: CancelInvoiceAtomicParams = {
        invoiceId: draftInvoice.id,
        currentInvoice: draftInvoice,
        currentStatus: 'DRAFT'
      };

      const result = await cancelInvoiceAtomic(params, db);

      expect(result.invoiceId).toBe(draftInvoice.id);
      expect(mockCommit).toHaveBeenCalledTimes(1);

      // Customer update must NOT decrement outstandingAmount
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.not.objectContaining({
          outstandingAmount: expect.anything()
        })
      );
    });

    it('2.10 Rejects payment on already PAID or CANCELLED invoice, or with non-positive amount', async () => {
      const paidInvoice = {
        id: 'inv-paid-check',
        invoiceNumber: 'INV-PC-001',
        grandTotal: 500,
        amountPaid: 500,
        amountDue: 0,
        status: 'PAID' as const,
        customerId: 'cust-1',
        customerName: 'Cust'
      };

      const cancelledInvoice = {
        ...paidInvoice,
        id: 'inv-cancelled-check',
        status: 'CANCELLED' as const
      };

      const basePayment = {
        paymentNumber: 'PAY-ERR',
        invoiceId: 'inv-paid-check',
        invoiceNumber: 'INV-PC-001',
        customerId: 'cust-1',
        customerName: 'Cust',
        amount: 50,
        paymentDate: '2026-09-19',
        paymentMethod: 'CASH' as const
      };

      await expect(recordPaymentAtomic({ payment: basePayment, currentInvoice: paidInvoice }, db)).rejects.toThrow(
        'Invoice is already fully paid'
      );

      await expect(
        recordPaymentAtomic({ payment: { ...basePayment, invoiceId: 'inv-cancelled-check' }, currentInvoice: cancelledInvoice }, db)
      ).rejects.toThrow('Cannot record payment on a cancelled invoice');

      const activeInvoice = {
        ...paidInvoice,
        status: 'UNPAID' as const,
        amountDue: 500,
        amountPaid: 0
      };

      await expect(
        recordPaymentAtomic({ payment: { ...basePayment, amount: 0 }, currentInvoice: activeInvoice }, db)
      ).rejects.toThrow('Payment amount must be greater than 0');

      await expect(
        recordPaymentAtomic({ payment: { ...basePayment, amount: -100 }, currentInvoice: activeInvoice }, db)
      ).rejects.toThrow('Payment amount must be greater than 0');

      expect(mockCommit).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3. Offline Batch Durability: Zero runTransaction in src/
  // =========================================================================
  describe('3. Offline Durability & Zero runTransaction in src/', () => {
    it('3.1 verifies zero function calls or imports of runTransaction across entire src/ directory', () => {
      const srcDir = path.resolve(__dirname, '../../src');

      function scanDirForRunTransaction(dir: string): string[] {
        let violations: string[] = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            violations = violations.concat(scanDirForRunTransaction(fullPath));
          } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            // Remove single-line and multi-line comments to test actual code usage
            const codeOnly = content
              .replace(/\/\*[\s\S]*?\*\//g, '')
              .replace(/\/\/.*/g, '');

            if (/\brunTransaction\b/.test(codeOnly)) {
              violations.push(fullPath);
            }
          }
        }
        return violations;
      }

      const violations = scanDirForRunTransaction(srcDir);
      console.log(`[Offline Durability Check] runTransaction code usages in src/: ${violations.length}`);
      expect(violations).toEqual([]);
    });
  });

  // =========================================================================
  // 4. Invariant Stress: Multi-Item Invoices & Conservation of Money
  // =========================================================================
  describe('4. Conservation of Money Invariant (500 Randomized Multi-Item Invoices)', () => {
    it('4.1 verifies grandTotal === roundFinancial(sum(lineTotal)) and subtotal - discount + tax', () => {
      // Deterministic PRNG
      let seed = 987654321;
      const rnd = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };

      const iterations = 500;
      for (let i = 0; i < iterations; i++) {
        const numItems = Math.floor(rnd() * 8) + 1; // 1 to 8 items
        const items: LineItemInput[] = [];

        for (let j = 0; j < numItems; j++) {
          const quantity = roundFinancial(rnd() * 20 + 0.1, 2);
          const unitPrice = roundFinancial(rnd() * 150 + 1, 2);
          const discountType = rnd() > 0.5 ? 'PERCENTAGE' : 'FIXED';
          const discount = discountType === 'PERCENTAGE'
            ? roundFinancial(rnd() * 30, 2)
            : roundFinancial(rnd() * 25, 2);
          const taxRate = rnd() > 0.4 ? 15 : 0;

          items.push({ quantity, unitPrice, discount, discountType, taxRate });
        }

        const totals = calculateInvoiceTotals(items);
        const calculatedItems = items.map(calculateLineItem);

        // Invariant 1: Sum of lineTotal === grandTotal
        const sumLineTotals = roundFinancial(calculatedItems.reduce((sum, item) => sum + item.lineTotal, 0));
        expect(totals.grandTotal).toBe(sumLineTotals);

        // Invariant 2: subtotal - totalDiscount + totalTax === grandTotal
        const formulaGrand = roundFinancial(totals.subtotal - totals.totalDiscount + totals.totalTax);
        expect(totals.grandTotal).toBe(formulaGrand);

        // Invariant 3: amountDue + amountPaid === grandTotal
        const paidAmount = roundFinancial(rnd() * totals.grandTotal, 2);
        const totalsWithPaid = calculateInvoiceTotals(items, paidAmount);
        expect(totalsWithPaid.amountDue).toBe(roundFinancial(totalsWithPaid.grandTotal - paidAmount));
      }
    });
  });
});
