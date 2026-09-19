import type { InvoiceStatus } from '@/types/domain';

/**
 * Input parameters representing an uncalculated invoice line item.
 */
export interface LineItemInput {
  quantity: number;
  unitPrice: number;
  discount: number;
  discountType: 'PERCENTAGE' | 'FIXED';
  taxRate: number;
}

/**
 * An itemized line item augmented with all calculated financial fields.
 */
export interface CalculatedLineItem extends LineItemInput {
  grossAmount: number;
  lineDiscount: number;
  taxableAmount: number;
  lineTax: number;
  lineTotal: number;
}

/**
 * Aggregated invoice financial totals and derived payment status.
 */
export interface InvoiceTotals {
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
  amountDue: number;
  status: InvoiceStatus;
}

/**
 * Epsilon-safe financial rounding avoiding IEEE-754 binary floating-point inaccuracies
 * (e.g., $19.99 * 3 = 59.97, not 59.96999999999999, and 1.005 -> 1.01).
 *
 * Implements symmetric arithmetic half-up rounding (round half away from zero)
 * using decimal exponential shifting.
 *
 * @param amount The numeric amount to round.
 * @param decimals The number of decimal places to retain (default: 2).
 * @returns The accurately rounded number.
 */
export function roundFinancial(amount: number, decimals: number = 2): number {
  if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
    return 0;
  }
  const sign = amount < 0 ? -1 : 1;
  const abs = Math.abs(amount);

  // Decimal exponential shift avoids IEEE-754 mantissa truncation
  const parts = abs.toString().split('e');
  const exponent = parts[1] ? Number(parts[1]) : 0;
  const shifted = Number(parts[0] + 'e' + (exponent + decimals));
  const rounded = Math.round(shifted);

  const unshiftedParts = rounded.toString().split('e');
  const unshiftedExponent = unshiftedParts[1] ? Number(unshiftedParts[1]) : 0;
  const result = sign * Number(unshiftedParts[0] + 'e' + (unshiftedExponent - decimals));

  // Protect against -0 in JavaScript runtime
  return Object.is(result, -0) || result === 0 ? 0 : result;
}

/**
 * Calculates all financial fields for a single invoice line item.
 *
 * Formulas:
 * 1. grossAmount = roundFinancial(quantity * unitPrice)
 * 2. lineDiscount:
 *    - PERCENTAGE: min(grossAmount, roundFinancial((grossAmount * min(100, max(0, discount))) / 100))
 *    - FIXED: min(grossAmount, roundFinancial(max(0, discount)))
 * 3. taxableAmount = roundFinancial(max(0, grossAmount - lineDiscount))
 * 4. lineTax = roundFinancial((taxableAmount * max(0, taxRate)) / 100)
 * 5. lineTotal = roundFinancial(taxableAmount + lineTax)
 *
 * @param item The raw line item inputs.
 * @returns The fully calculated line item.
 */
export function calculateLineItem(item: LineItemInput): CalculatedLineItem {
  const quantity = Math.max(0, typeof item.quantity === 'number' && !isNaN(item.quantity) ? item.quantity : 0);
  const unitPrice = Math.max(0, typeof item.unitPrice === 'number' && !isNaN(item.unitPrice) ? item.unitPrice : 0);
  const discountVal = Math.max(0, typeof item.discount === 'number' && !isNaN(item.discount) ? item.discount : 0);
  const taxRate = Math.max(0, typeof item.taxRate === 'number' && !isNaN(item.taxRate) ? item.taxRate : 0);
  const discountType = item.discountType === 'FIXED' ? 'FIXED' : 'PERCENTAGE';

  const grossAmount = roundFinancial(quantity * unitPrice);

  let lineDiscount = 0;
  if (discountType === 'PERCENTAGE') {
    const cappedPercentage = Math.min(100, discountVal);
    lineDiscount = roundFinancial((grossAmount * cappedPercentage) / 100);
  } else {
    lineDiscount = Math.min(grossAmount, roundFinancial(discountVal));
  }
  // Guarantee discount never exceeds gross amount
  lineDiscount = Math.min(grossAmount, lineDiscount);

  const taxableAmount = roundFinancial(Math.max(0, grossAmount - lineDiscount));
  const lineTax = roundFinancial((taxableAmount * taxRate) / 100);
  const lineTotal = roundFinancial(taxableAmount + lineTax);

  return {
    ...item,
    grossAmount,
    lineDiscount,
    taxableAmount,
    lineTax,
    lineTotal
  };
}

/**
 * Determines the lifecycle status of an invoice based on amounts, draft flag, and due date.
 *
 * State Transition Rules:
 * - isDraft === true -> 'DRAFT'
 * - grandTotal === 0 || amountPaid >= grandTotal -> 'PAID'
 * - dueDate && dueDate < today -> 'OVERDUE'
 * - amountPaid > 0 -> 'PARTIALLY_PAID'
 * - Default -> 'UNPAID'
 *
 * @param grandTotal Total payable amount of the invoice.
 * @param amountPaid Cumulative payments recorded against this invoice.
 * @param dueDate Due date in YYYY-MM-DD format (optional).
 * @param isDraft Whether the invoice is currently in draft state (optional, default: false).
 * @param referenceDate Reference date for overdue evaluation (optional, default: current UTC date).
 * @returns The derived InvoiceStatus.
 */
export function determineInvoiceStatus(
  grandTotal: number,
  amountPaid: number = 0,
  dueDate?: string,
  isDraft: boolean = false,
  referenceDate?: string
): InvoiceStatus {
  if (isDraft) {
    return 'DRAFT';
  }

  const total = roundFinancial(Math.max(0, grandTotal));
  const paid = roundFinancial(Math.max(0, amountPaid));

  if (total === 0 || paid >= total) {
    return 'PAID';
  }

  if (dueDate) {
    const today = referenceDate || new Date().toISOString().split('T')[0];
    if (dueDate < today) {
      return 'OVERDUE';
    }
  }

  if (paid > 0) {
    return 'PARTIALLY_PAID';
  }

  return 'UNPAID';
}

/**
 * Calculates aggregated invoice totals from a collection of line items.
 *
 * Invariants Guaranteed:
 * - subtotal = sum(grossAmount)
 * - totalDiscount = sum(lineDiscount)
 * - totalTax = sum(lineTax)
 * - grandTotal = subtotal - totalDiscount + totalTax = sum(lineTotal)
 * - amountDue = max(0, grandTotal - amountPaid)
 *
 * @param items Array of raw or calculated line item inputs.
 * @param amountPaid Cumulative payments recorded (default: 0).
 * @param dueDate Due date for overdue evaluation (optional).
 * @param isDraft Draft flag (optional, default: false).
 * @param referenceDate Reference date for overdue evaluation (optional).
 * @returns Aggregated InvoiceTotals.
 */
export function calculateInvoiceTotals(
  items: LineItemInput[],
  amountPaid: number = 0,
  dueDate?: string,
  isDraft: boolean = false,
  referenceDate?: string
): InvoiceTotals {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return {
      subtotal: 0,
      totalDiscount: 0,
      totalTax: 0,
      grandTotal: 0,
      amountDue: 0,
      status: isDraft ? 'DRAFT' : 'PAID'
    };
  }

  const calculatedItems = items.map(calculateLineItem);
  const subtotal = roundFinancial(calculatedItems.reduce((acc, it) => acc + it.grossAmount, 0));
  const totalDiscount = roundFinancial(calculatedItems.reduce((acc, it) => acc + it.lineDiscount, 0));
  const totalTax = roundFinancial(calculatedItems.reduce((acc, it) => acc + it.lineTax, 0));
  const grandTotal = roundFinancial(subtotal - totalDiscount + totalTax);

  const safePaid = roundFinancial(Math.max(0, typeof amountPaid === 'number' && !isNaN(amountPaid) ? amountPaid : 0));
  const amountDue = Math.max(0, roundFinancial(grandTotal - safePaid));
  const status = determineInvoiceStatus(grandTotal, safePaid, dueDate, isDraft, referenceDate);

  return {
    subtotal,
    totalDiscount,
    totalTax,
    grandTotal,
    amountDue,
    status
  };
}

/**
 * Formats a monetary amount into a localized currency string respecting
 * Arabic RTL bidirectional isolation standards.
 *
 * Features:
 * - Always renders Western Arabic numerals (1, 2, 3...) in Arabic mode via 'ar-SA-u-nu-latn'.
 * - Preserves LTR sign alignment (e.g. -1,250.50 ر.س.) using native Intl isolation markers (\u200e).
 * - Sanitizes NaN, Infinity, -0 to safe zero display ($0.00).
 * - Defensive fallback for unrecognized or custom currency codes.
 *
 * @param amount The numeric amount to format.
 * @param currency ISO 4217 currency code (default: 'USD').
 * @param locale Locale string (default: 'en').
 * @returns Bi-directionally protected currency string.
 */
export function formatCurrency(
  amount: number,
  currency: string = 'USD',
  locale: string = 'en'
): string {
  const safeAmount =
    typeof amount !== 'number' || isNaN(amount) || !isFinite(amount) || Object.is(amount, -0)
      ? 0
      : amount;

  const isArabic = typeof locale === 'string' && locale.toLowerCase().startsWith('ar');
  const targetLocale = isArabic ? 'ar-SA-u-nu-latn' : locale === 'en' ? 'en-US' : locale;
  const upperCurrency = (currency || 'USD').toUpperCase();

  try {
    const formatter = new Intl.NumberFormat(targetLocale, {
      style: 'currency',
      currency: upperCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return formatter.format(safeAmount);
  } catch {
    // Defensive fallback for custom, private, or unrecognized currency codes
    const formattedNum = Math.abs(safeAmount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    const sign = safeAmount < 0 ? '-' : '';
    if (isArabic) {
      return `\u200E${sign}${formattedNum} ${upperCurrency}`;
    }
    return `${sign}${upperCurrency} ${formattedNum}`;
  }
}
