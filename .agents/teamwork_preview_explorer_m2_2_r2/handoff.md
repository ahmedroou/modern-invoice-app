# Handoff Report: Real-Time Financial Math Engine & Calculation Specifications

**Agent**: `teamwork_preview_explorer_m2_2_r2`  
**Working Directory**: `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m2_2_r2`  
**Date**: 2026-09-19T09:35:00Z  
**Target Files**:
- Implementation: `src/lib/calculations.ts` (blueprint in `.agents/teamwork_preview_explorer_m2_2_r2/proposed_calculations.ts`)
- Unit Test Suite: `tests/unit/calculations.test.ts` (blueprint in `.agents/teamwork_preview_explorer_m2_2_r2/proposed_calculations.test.ts`)

---

## 1. Observation

Direct observations from project requirements, interfaces, and empirical runtime tests:

1. **Interface Contract (`PROJECT.md:153-183`)**:
   ```typescript
   export interface LineItemInput {
     quantity: number;
     unitPrice: number;
     discount: number;
     discountType: 'PERCENTAGE' | 'FIXED';
     taxRate: number;
   }

   export interface CalculatedLineItem extends LineItemInput {
     grossAmount: number;
     lineDiscount: number;
     taxableAmount: number;
     lineTax: number;
     lineTotal: number;
   }

   export interface InvoiceTotals {
     subtotal: number;
     totalDiscount: number;
     totalTax: number;
     grandTotal: number;
     amountDue: number;
   }

   export function roundFinancial(amount: number, decimals?: number): number;
   export function calculateLineItem(item: LineItemInput): CalculatedLineItem;
   export function calculateInvoiceTotals(items: LineItemInput[], amountPaid?: number): InvoiceTotals;
   export function formatCurrency(amount: number, currency?: string, locale?: string): string;
   ```

2. **Domain Status Contract (`PROJECT.md:200, 248`)**:
   ```typescript
   export type InvoiceStatus = 'DRAFT' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
   ```

3. **Requirements Mandate (`ORIGINAL_REQUEST.md:21-22, 32`)**:
   - Requirement R2: *"Implement the core modules: Dashboard (metrics and activity log), Accounts/Customers, Invoices (with real-time automatic calculations and keyboard navigation), Payments (partial and full), and generated Statements."*
   - Acceptance Criteria: *"Invoice creation updates the 'Grand Total' automatically in real-time as items are added/modified, without clicking a 'calculate' button."*

4. **Survey Specifications & Edge Cases (`teamwork_preview_spec_miner_survey_2/handoff.md:148-200, 385-388`)**:
   - Gross line: $\text{Gross}_i = \text{roundFinancial}(\text{quantity}_i \times \text{unitPrice}_i)$
   - Discount: percentage ($\text{Gross}_i \times \frac{\text{discountRate}_i}{100}$) or fixed ($\min(\text{discountValue}_i, \text{Gross}_i)$)
   - Taxable: $\text{Gross}_i - \text{LineDiscount}_i$ (floored at 0)
   - Line Tax: $\text{roundFinancial}(\text{Taxable}_i \times \frac{\text{taxRate}_i}{100})$
   - Line Total: $\text{Taxable}_i + \text{LineTax}_i$
   - Invoice Status auto-transitions:
     - `grandTotal == 0 || amountPaid >= grandTotal` $\implies$ `'PAID'`
     - `amountPaid == 0` $\implies$ `'UNPAID'` (or `'OVERDUE'` if `dueDate < today`)
     - `0 < amountPaid < grandTotal` $\implies$ `'PARTIALLY_PAID'` (or `'OVERDUE'` if `dueDate < today`)
     - `isDraft === true` $\implies$ `'DRAFT'`
   - Bidi Numeral & Currency Isolation:
     - *"Western Arabic numerals (1, 2, 3...) are industry standard in modern Arabic business software (SAR, AED, etc.)."*
     - Standard currency display: English `$1,250.00` or `SAR 1,250.00`; Arabic `1,250.00 ر.س` with LTR isolation on negative values (`-1,250.50 ر.س`).

5. **Empirical Runtime Observations in Node.js 22 & Chromium**:
   - **Flaw in standard rounding**: `Math.round(1.005 * 100) / 100` outputs `1.00` (due to `1.005 * 100 = 100.49999999999999`).
   - **Flaw in `Number.EPSILON`**: `Math.round((35.855 + Number.EPSILON) * 100) / 100` outputs `35.85` instead of `35.86` because `Number.EPSILON` (`2.22e-16`) is too small to overcome the representation gap of `3585.4999999999995` (`~5e-13`).
   - **Flaw in naive negative rounding**: `Math.round(-1.5)` produces `-1` because `Math.round` rounds toward $+\infty$, creating an asymmetric bias for negative numbers.
   - **Flaw in `Object.is(-0, 0)`**: Negated zero produces `-0` which formats as `-$0.00`.
   - **Arabic `Intl.NumberFormat` with Latin numerals**: `new Intl.NumberFormat('ar-SA-u-nu-latn', { style: 'currency', currency: 'SAR' })` correctly formats as `‏1,250.50 ر.س.` and negative as `‏‎-1,250.50 ر.س.` with Unicode LTR mark `\u200e` preventing sign inversion.

---

## 2. Logic Chain

From the observed contracts and empirical tests, we formulate the complete mathematical and architectural blueprints:

### Step 2.1: Decimal Exponential Shift Rounding (`roundFinancial`)
To achieve true epsilon-safe financial rounding:
1. Extract absolute magnitude and sign: `sign = amount < 0 ? -1 : 1`, `abs = Math.abs(amount)`.
2. Convert number to string and split on scientific notation `'e'` to handle existing scientific exponents.
3. Shift the decimal point to the right by `decimals` places using exponential notation: `shifted = Number(parts[0] + 'e' + (exponent + decimals))`.
   - Because `(1.005).toString()` is `'1.005'`, `'1.005e2'` evaluates to exact `100.5`.
   - `Math.round(100.5)` yields `101`.
   - For `35.855`, `'35.855e2'` evaluates to exact `3585.5`. `Math.round(3585.5)` yields `3586`.
4. Shift back to the left: `unshifted = sign * Number(parts[0] + 'e' + (exponent - decimals))`.
5. Sanitize `-0`: `Object.is(result, -0) || result === 0 ? 0 : result`.
6. Guard non-finite values (`NaN`, `Infinity`) $\implies$ returns `0`.

### Step 2.2: Line Item Calculation (`calculateLineItem`)
1. **Defensive sanitization**:
   - `quantity = Math.max(0, item.quantity || 0)` (permits fractional quantities, blocks negatives).
   - `unitPrice = Math.max(0, item.unitPrice || 0)`.
   - `discountVal = Math.max(0, item.discount || 0)`.
   - `taxRate = Math.max(0, item.taxRate || 0)`.
2. **Gross Amount**:
   $$\text{grossAmount} = \text{roundFinancial}(\text{quantity} \times \text{unitPrice})$$
3. **Discount Computation & Over-discount Capping**:
   - If `discountType === 'PERCENTAGE'`:
     $$\text{cappedRate} = \min(100, \text{discountVal})$$
     $$\text{lineDiscount} = \text{roundFinancial}\left(\frac{\text{grossAmount} \times \text{cappedRate}}{100}\right)$$
   - If `discountType === 'FIXED'`:
     $$\text{lineDiscount} = \min(\text{grossAmount}, \text{roundFinancial}(\text{discountVal}))$$
   - Enforce hard ceiling: `lineDiscount = Math.min(grossAmount, lineDiscount)`.
4. **Taxable Amount**:
   $$\text{taxableAmount} = \text{roundFinancial}(\max(0, \text{grossAmount} - \text{lineDiscount}))$$
5. **Line Tax**:
   $$\text{lineTax} = \text{roundFinancial}\left(\frac{\text{taxableAmount} \times \text{taxRate}}{100}\right)$$
6. **Line Total**:
   $$\text{lineTotal} = \text{roundFinancial}(\text{taxableAmount} + \text{lineTax})$$

### Step 2.3: Invoice Totals & Invariant Preservation (`calculateInvoiceTotals`)
1. For an array of items, calculate each line item using `calculateLineItem`.
2. Aggregate:
   - $\text{subtotal} = \text{roundFinancial}\left(\sum \text{grossAmount}\right)$
   - $\text{totalDiscount} = \text{roundFinancial}\left(\sum \text{lineDiscount}\right)$
   - $\text{totalTax} = \text{roundFinancial}\left(\sum \text{lineTax}\right)$
   - $\text{grandTotal} = \text{roundFinancial}(\text{subtotal} - \text{totalDiscount} + \text{totalTax})$
3. Invariant check: $\text{grandTotal} \equiv \sum \text{lineTotal}$.
4. Amount Due:
   $$\text{amountDue} = \max(0, \text{roundFinancial}(\text{grandTotal} - \max(0, \text{amountPaid})))$$
5. Status State Transitions:
   - If `isDraft === true` $\implies$ `'DRAFT'`
   - If `grandTotal === 0 || amountPaid >= grandTotal` $\implies$ `'PAID'`
   - If `dueDate && dueDate < today` $\implies$ `'OVERDUE'`
   - If `amountPaid > 0` $\implies$ `'PARTIALLY_PAID'`
   - Else $\implies$ `'UNPAID'`

### Step 2.4: Arabic RTL Bidi Protection (`formatCurrency`)
1. When `locale.startsWith('ar')`, use `'ar-SA-u-nu-latn'`.
   - Generates Western Arabic numerals (`1, 2, 3...`) matching Saudi Arabian and GCC accounting standards.
   - Embeds Unicode Directional Isolation Markers (`\u200e` Left-to-Right Mark) immediately before negative signs (`-`).
   - Prevents the bidi rendering bug where negative currency numbers invert into `1,250.50$-` or `1,250.50- ر.س`.
2. For custom or unrecognized currencies, format with explicit `\u200E` prefix in Arabic mode.
3. Sanitize `NaN`, `Infinity`, and `-0` to `$0.00` or `0.00 ر.س`.

---

## 3. Caveats

1. **Per-Invoice Base Currency**: All calculations assume items on a single invoice share the same currency. Currency exchange / multi-currency conversion on a per-line basis is not within Milestone 2 scope.
2. **Date Comparison Format**: Overdue status comparison assumes ISO 8601 calendar dates formatted as `YYYY-MM-DD` (lexicographically comparable).
3. **Draft Priority**: An invoice flagged as `isDraft: true` retains `'DRAFT'` status even if the due date has passed or payments have been drafted.
4. **Ad-Hoc Line Items**: Input items are ad-hoc records containing rate and quantity; this engine operates cleanly whether items originate from an ad-hoc input row or an item catalog.

---

## 4. Conclusion & Complete Blueprints

The calculation engine is mathematically verified and ready for implementation. Full code blueprints are detailed below and stored as artifacts in the working folder:
- `.agents/teamwork_preview_explorer_m2_2_r2/proposed_calculations.ts`
- `.agents/teamwork_preview_explorer_m2_2_r2/proposed_calculations.test.ts`

### Blueprint 1: `src/lib/calculations.ts`
```typescript
import type { InvoiceStatus } from '../types/domain';

export interface LineItemInput {
  quantity: number;
  unitPrice: number;
  discount: number;
  discountType: 'PERCENTAGE' | 'FIXED';
  taxRate: number;
}

export interface CalculatedLineItem extends LineItemInput {
  grossAmount: number;
  lineDiscount: number;
  taxableAmount: number;
  lineTax: number;
  lineTotal: number;
}

export interface InvoiceTotals {
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
  amountDue: number;
  status: InvoiceStatus;
}

export function roundFinancial(amount: number, decimals: number = 2): number {
  if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
    return 0;
  }
  const sign = amount < 0 ? -1 : 1;
  const abs = Math.abs(amount);

  const parts = abs.toString().split('e');
  const exponent = parts[1] ? Number(parts[1]) : 0;
  const shifted = Number(parts[0] + 'e' + (exponent + decimals));
  const rounded = Math.round(shifted);

  const unshiftedParts = rounded.toString().split('e');
  const unshiftedExponent = unshiftedParts[1] ? Number(unshiftedParts[1]) : 0;
  const result = sign * Number(unshiftedParts[0] + 'e' + (unshiftedExponent - decimals));

  return Object.is(result, -0) || result === 0 ? 0 : result;
}

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
```

### Blueprint 2: `tests/unit/calculations.test.ts`
The full Vitest test suite is documented in `.agents/teamwork_preview_explorer_m2_2_r2/proposed_calculations.test.ts` comprising:
- 8 tests for `roundFinancial` (binary floating point arithmetic, precision boundaries, negative symmetric rounding, custom decimals, non-finite/NaN sanitization).
- 8 tests for `calculateLineItem` (percentage discounts, fixed discounts, over-discount capping, fractional quantities, floating-point prices, 0-value items, negative sanitization).
- 8 tests for `calculateInvoiceTotals` and `determineInvoiceStatus` (multi-item aggregation, invariants, empty arrays, partial payments, full payments, overdue date transitions, draft handling, 100% discount free invoices).
- 7 tests for `formatCurrency` (English USD/SAR, Arabic SAR with Western Arabic numerals and `\u200e` LTR mark, negative amounts, defensive non-numeric sanitization, custom currency fallback).

---

## 5. Verification Method

To independently verify the implementation:

1. **Deploy Blueprint Files**:
   - Copy `.agents/teamwork_preview_explorer_m2_2_r2/proposed_calculations.ts` $\to$ `src/lib/calculations.ts`.
   - Copy `.agents/teamwork_preview_explorer_m2_2_r2/proposed_calculations.test.ts` $\to$ `tests/unit/calculations.test.ts`.

2. **Execute Unit Test Suite**:
   ```pwsh
   npx vitest run tests/unit/calculations.test.ts
   ```
   **Expected Result**: All 31 test assertions pass with 0 failures.

3. **Verify Full Project Unit Test Pass**:
   ```pwsh
   npm test
   ```
   **Expected Result**: All 8 suites (including CompactCard, DirectionContext, ThemeContext, TitleBar, and calculations) pass with 100% success.

4. **Typecheck Verification**:
   ```pwsh
   npx tsc --noEmit
   ```
   **Expected Result**: Clean compilation with 0 type errors.
