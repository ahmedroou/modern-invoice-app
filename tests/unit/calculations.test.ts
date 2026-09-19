import { describe, it, expect } from 'vitest';
import {
  roundFinancial,
  calculateLineItem,
  calculateInvoiceTotals,
  determineInvoiceStatus,
  formatCurrency,
  type LineItemInput
} from '@/lib/calculations';

describe('Financial Math & Calculation Engine (src/lib/calculations.ts)', () => {
  describe('1. roundFinancial: Epsilon-Safe Financial Rounding', () => {
    it('accurately resolves binary floating-point multiplication (1.05 * 3 = 3.15, 19.99 * 3 = 59.97)', () => {
      const raw = 1.05 * 3;
      expect(raw).toBe(3.1500000000000004);
      expect(roundFinancial(raw)).toBe(3.15);
      expect(roundFinancial(19.99 * 3)).toBe(59.97);
    });

    it('accurately resolves binary floating-point addition (0.1 + 0.2 = 0.3)', () => {
      const raw = 0.1 + 0.2;
      expect(raw).toBe(0.30000000000000004);
      expect(roundFinancial(raw)).toBe(0.3);
    });

    it('correctly rounds half-up on IEEE-754 representation boundary (1.005 -> 1.01)', () => {
      // Standard Math.round(1.005 * 100) / 100 fails and produces 1.00
      expect(Math.round(1.005 * 100) / 100).toBe(1);
      expect(roundFinancial(1.005)).toBe(1.01);
    });

    it('correctly rounds half-up on precision boundary where Number.EPSILON fails (35.855 -> 35.86)', () => {
      // Standard (35.855 + Number.EPSILON) * 100 fails and produces 35.85
      expect(Math.round((35.855 + Number.EPSILON) * 100) / 100).toBe(35.85);
      expect(roundFinancial(35.855)).toBe(35.86);
    });

    it('rounds numbers just below and above the half boundary', () => {
      expect(roundFinancial(1.004)).toBe(1.00);
      expect(roundFinancial(1.0049)).toBe(1.00);
      expect(roundFinancial(1.0051)).toBe(1.01);
      expect(roundFinancial(1.006)).toBe(1.01);
    });

    it('implements symmetric half-up rounding for negative amounts (round away from zero)', () => {
      expect(roundFinancial(-1.005)).toBe(-1.01);
      expect(roundFinancial(-35.855)).toBe(-35.86);
      expect(roundFinancial(-(19.99 * 3))).toBe(-59.97);
    });

    it('supports custom decimal precision', () => {
      expect(roundFinancial(123.456, 0)).toBe(123);
      expect(roundFinancial(123.5, 0)).toBe(124);
      expect(roundFinancial(123.456, 1)).toBe(123.5);
      expect(roundFinancial(123.4567, 3)).toBe(123.457);
      expect(roundFinancial(123.4564, 3)).toBe(123.456);
    });

    it('defensively sanitizes non-finite numbers, NaN, and negative zero', () => {
      expect(roundFinancial(0)).toBe(0);
      expect(roundFinancial(-0)).toBe(0);
      expect(Object.is(roundFinancial(-0), 0)).toBe(true);
      expect(roundFinancial(NaN)).toBe(0);
      expect(roundFinancial(Infinity)).toBe(0);
      expect(roundFinancial(-Infinity)).toBe(0);
      expect(roundFinancial(null as any)).toBe(0);
      expect(roundFinancial(undefined as any)).toBe(0);
    });
  });

  describe('2. calculateLineItem: Line-Level Financial Computation', () => {
    it('calculates standard line item with percentage discount and VAT', () => {
      const item: LineItemInput = {
        quantity: 2,
        unitPrice: 100,
        discount: 10,
        discountType: 'PERCENTAGE',
        taxRate: 15
      };

      const result = calculateLineItem(item);
      expect(result.grossAmount).toBe(200.00);
      expect(result.lineDiscount).toBe(20.00);
      expect(result.taxableAmount).toBe(180.00);
      expect(result.lineTax).toBe(27.00);
      expect(result.lineTotal).toBe(207.00);
    });

    it('calculates standard line item with fixed discount and VAT', () => {
      const item: LineItemInput = {
        quantity: 1,
        unitPrice: 50,
        discount: 10,
        discountType: 'FIXED',
        taxRate: 15
      };

      const result = calculateLineItem(item);
      expect(result.grossAmount).toBe(50.00);
      expect(result.lineDiscount).toBe(10.00);
      expect(result.taxableAmount).toBe(40.00);
      expect(result.lineTax).toBe(6.00);
      expect(result.lineTotal).toBe(46.00);
    });

    it('caps fixed discount at gross amount and prevents negative taxable/total amounts', () => {
      const item: LineItemInput = {
        quantity: 1,
        unitPrice: 50,
        discount: 100, // Fixed discount exceeds gross
        discountType: 'FIXED',
        taxRate: 15
      };

      const result = calculateLineItem(item);
      expect(result.grossAmount).toBe(50.00);
      expect(result.lineDiscount).toBe(50.00); // Capped at gross
      expect(result.taxableAmount).toBe(0.00);
      expect(result.lineTax).toBe(0.00);
      expect(result.lineTotal).toBe(0.00);
    });

    it('caps percentage discount at 100% and prevents negative line totals', () => {
      const item: LineItemInput = {
        quantity: 1,
        unitPrice: 50,
        discount: 150, // Percentage discount exceeds 100%
        discountType: 'PERCENTAGE',
        taxRate: 15
      };

      const result = calculateLineItem(item);
      expect(result.grossAmount).toBe(50.00);
      expect(result.lineDiscount).toBe(50.00);
      expect(result.taxableAmount).toBe(0.00);
      expect(result.lineTax).toBe(0.00);
      expect(result.lineTotal).toBe(0.00);
    });

    it('accurately calculates fractional quantities (hours, kg, fractional units)', () => {
      const item: LineItemInput = {
        quantity: 1.5,
        unitPrice: 75.50,
        discount: 0,
        discountType: 'FIXED',
        taxRate: 15
      };

      const result = calculateLineItem(item);
      expect(result.grossAmount).toBe(113.25);
      expect(result.lineDiscount).toBe(0.00);
      expect(result.taxableAmount).toBe(113.25);
      expect(result.lineTax).toBe(16.99); // 113.25 * 0.15 = 16.9875 -> 16.99
      expect(result.lineTotal).toBe(130.24); // 113.25 + 16.99
    });

    it('handles floating-point item pricing without binary precision artifacts', () => {
      const item: LineItemInput = {
        quantity: 3,
        unitPrice: 19.99,
        discount: 0,
        discountType: 'FIXED',
        taxRate: 15
      };

      const result = calculateLineItem(item);
      expect(result.grossAmount).toBe(59.97);
      expect(result.lineDiscount).toBe(0.00);
      expect(result.taxableAmount).toBe(59.97);
      expect(result.lineTax).toBe(9.00); // 59.97 * 0.15 = 8.9955 -> 9.00
      expect(result.lineTotal).toBe(68.97);
    });

    it('safely handles zero quantity, zero price, and zero tax rate', () => {
      const zeroQty = calculateLineItem({
        quantity: 0,
        unitPrice: 100,
        discount: 5,
        discountType: 'PERCENTAGE',
        taxRate: 15
      });
      expect(zeroQty.grossAmount).toBe(0);
      expect(zeroQty.lineDiscount).toBe(0);
      expect(zeroQty.taxableAmount).toBe(0);
      expect(zeroQty.lineTax).toBe(0);
      expect(zeroQty.lineTotal).toBe(0);

      const zeroPrice = calculateLineItem({
        quantity: 5,
        unitPrice: 0,
        discount: 0,
        discountType: 'FIXED',
        taxRate: 15
      });
      expect(zeroPrice.grossAmount).toBe(0);
      expect(zeroPrice.lineTotal).toBe(0);

      const zeroTax = calculateLineItem({
        quantity: 2,
        unitPrice: 50,
        discount: 0,
        discountType: 'FIXED',
        taxRate: 0
      });
      expect(zeroTax.grossAmount).toBe(100);
      expect(zeroTax.lineTax).toBe(0);
      expect(zeroTax.lineTotal).toBe(100);
    });

    it('sanitizes negative inputs to non-negative zero', () => {
      const result = calculateLineItem({
        quantity: -5,
        unitPrice: -20,
        discount: -10,
        discountType: 'FIXED',
        taxRate: -15
      });
      expect(result.grossAmount).toBe(0);
      expect(result.lineDiscount).toBe(0);
      expect(result.taxableAmount).toBe(0);
      expect(result.lineTax).toBe(0);
      expect(result.lineTotal).toBe(0);
    });
  });

  describe('3. calculateInvoiceTotals & Status State Machine', () => {
    const sampleItems: LineItemInput[] = [
      { quantity: 2, unitPrice: 100, discount: 10, discountType: 'PERCENTAGE', taxRate: 15 },
      { quantity: 3, unitPrice: 19.99, discount: 0, discountType: 'FIXED', taxRate: 15 }
    ];

    it('aggregates multi-item invoice totals with 2-decimal precision', () => {
      const totals = calculateInvoiceTotals(sampleItems, 0, '2026-10-01', false, '2026-09-19');

      expect(totals.subtotal).toBe(259.97); // 200.00 + 59.97
      expect(totals.totalDiscount).toBe(20.00); // 20.00 + 0.00
      expect(totals.totalTax).toBe(36.00); // 27.00 + 9.00
      expect(totals.grandTotal).toBe(275.97); // 259.97 - 20.00 + 36.00
      expect(totals.amountDue).toBe(275.97);
      expect(totals.status).toBe('UNPAID');

      // Invariant: grandTotal equals sum of line totals
      const sumOfLineTotals = roundFinancial(
        sampleItems.reduce((acc, it) => acc + calculateLineItem(it).lineTotal, 0)
      );
      expect(totals.grandTotal).toBe(sumOfLineTotals);
    });

    it('handles empty line item collection safely', () => {
      const emptyTotals = calculateInvoiceTotals([], 0);
      expect(emptyTotals.subtotal).toBe(0);
      expect(emptyTotals.totalDiscount).toBe(0);
      expect(emptyTotals.totalTax).toBe(0);
      expect(emptyTotals.grandTotal).toBe(0);
      expect(emptyTotals.amountDue).toBe(0);
      expect(emptyTotals.status).toBe('PAID');
    });

    it('transitions to PARTIALLY_PAID when partial payment is recorded', () => {
      const totals = calculateInvoiceTotals(sampleItems, 100.00, '2026-10-01', false, '2026-09-19');
      expect(totals.grandTotal).toBe(275.97);
      expect(totals.amountDue).toBe(175.97);
      expect(totals.status).toBe('PARTIALLY_PAID');
    });

    it('transitions to PAID when payment exactly matches or exceeds grand total', () => {
      const exactPaid = calculateInvoiceTotals(sampleItems, 275.97, '2026-10-01', false, '2026-09-19');
      expect(exactPaid.amountDue).toBe(0.00);
      expect(exactPaid.status).toBe('PAID');

      // Overpayment clamps amountDue at 0
      const overPaid = calculateInvoiceTotals(sampleItems, 300.00, '2026-10-01', false, '2026-09-19');
      expect(overPaid.amountDue).toBe(0.00);
      expect(overPaid.status).toBe('PAID');
    });

    it('transitions to OVERDUE when due date has passed for unpaid or partially paid invoices', () => {
      // Unpaid past due date
      const unpaidOverdue = calculateInvoiceTotals(sampleItems, 0, '2026-09-01', false, '2026-09-19');
      expect(unpaidOverdue.status).toBe('OVERDUE');

      // Partially paid past due date
      const partialOverdue = calculateInvoiceTotals(sampleItems, 100, '2026-09-01', false, '2026-09-19');
      expect(partialOverdue.status).toBe('OVERDUE');

      // Fully paid past due date remains PAID (paid status takes priority)
      const paidPastDue = calculateInvoiceTotals(sampleItems, 275.97, '2026-09-01', false, '2026-09-19');
      expect(paidPastDue.status).toBe('PAID');
    });

    it('respects DRAFT flag regardless of due date or payments', () => {
      const draftTotals = calculateInvoiceTotals(sampleItems, 0, '2026-09-01', true, '2026-09-19');
      expect(draftTotals.status).toBe('DRAFT');
    });

    it('marks 100% discounted invoice as PAID immediately', () => {
      const freeItem: LineItemInput[] = [
        { quantity: 1, unitPrice: 100, discount: 100, discountType: 'PERCENTAGE', taxRate: 0 }
      ];
      const freeTotals = calculateInvoiceTotals(freeItem, 0);
      expect(freeTotals.grandTotal).toBe(0);
      expect(freeTotals.amountDue).toBe(0);
      expect(freeTotals.status).toBe('PAID');
    });

    it('exports determineInvoiceStatus for standalone status evaluation', () => {
      expect(determineInvoiceStatus(100, 0, '2026-10-01', false, '2026-09-19')).toBe('UNPAID');
      expect(determineInvoiceStatus(100, 50, '2026-10-01', false, '2026-09-19')).toBe('PARTIALLY_PAID');
      expect(determineInvoiceStatus(100, 100, '2026-10-01', false, '2026-09-19')).toBe('PAID');
      expect(determineInvoiceStatus(100, 0, '2026-09-01', false, '2026-09-19')).toBe('OVERDUE');
      expect(determineInvoiceStatus(100, 50, '2026-09-01', false, '2026-09-19')).toBe('OVERDUE');
      expect(determineInvoiceStatus(100, 0, '2026-09-01', true, '2026-09-19')).toBe('DRAFT');
    });
  });

  describe('4. formatCurrency: Arabic RTL & Localization Standards', () => {
    it('formats positive and negative amounts in English locale', () => {
      expect(formatCurrency(1250.5, 'USD', 'en')).toBe('$1,250.50');
      expect(formatCurrency(-1250.5, 'USD', 'en')).toBe('-$1,250.50');
      expect(formatCurrency(0, 'USD', 'en')).toBe('$0.00');
    });

    it('formats Saudi Riyal (SAR) in English locale', () => {
      const formatted = formatCurrency(1250.5, 'SAR', 'en');
      expect(formatted).toContain('1,250.50');
      expect(formatted).toContain('SAR');
    });

    it('uses Western Arabic numerals (1, 2, 3...) in Arabic locale (not Eastern numerals)', () => {
      const formatted = formatCurrency(1250.5, 'SAR', 'ar');
      // Must contain standard Western digits '1,250.50'
      expect(formatted).toContain('1,250.50');
      // Must NOT contain Eastern Arabic-Indic numerals
      expect(formatted).not.toContain('١٬٢٥٠');
      // Must contain the Arabic Riyal symbol or SAR code
      expect(formatted.includes('ر.س') || formatted.includes('SAR')).toBe(true);
    });

    it('ensures bidirectional protection for negative Arabic amounts without sign inversion', () => {
      const formatted = formatCurrency(-1250.5, 'SAR', 'ar');
      expect(formatted).toContain('1,250.50');
      expect(formatted).toContain('-');
      // Verify the negative sign does not get pushed to the far end after currency symbol
      expect(formatted.endsWith('-')).toBe(false);
    });

    it('handles USD in Arabic locale with Latin numerals', () => {
      const formatted = formatCurrency(1250.5, 'USD', 'ar');
      expect(formatted).toContain('1,250.50');
      expect(formatted.includes('US$') || formatted.includes('USD') || formatted.includes('$')).toBe(true);
    });

    it('defensively sanitizes non-numeric and boundary amounts', () => {
      expect(formatCurrency(NaN, 'USD', 'en')).toBe('$0.00');
      expect(formatCurrency(Infinity, 'USD', 'en')).toBe('$0.00');
      expect(formatCurrency(-0, 'USD', 'en')).toBe('$0.00');
      expect(formatCurrency(null as any, 'USD', 'en')).toBe('$0.00');
    });

    it('gracefully falls back when given unrecognized custom currency codes', () => {
      const custom = formatCurrency(250.75, 'CUSTOM_COIN', 'en');
      expect(custom).toContain('250.75');
      expect(custom).toContain('CUSTOM_COIN');
    });
  });
});
