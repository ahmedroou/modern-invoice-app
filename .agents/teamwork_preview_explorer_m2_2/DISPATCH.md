# Dispatch: Explorer M2-2 (Financial Math & Calculation Engine Specialist)

**Agent Identity**: teamwork_preview_explorer_m2_2
**Working Directory**: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m2_2
**Role**: Financial Math & Calculation Engine Specialist
**Milestone**: Milestone 2 (Firebase Offline-First & Financial Calculation Engine)

## Task Description
Investigate and specify the exact implementation of the real-time financial math engine in `src/lib/calculations.ts` matching interface contracts in `PROJECT.md:154-185`:
1. `roundFinancial(amount: number, decimals?: number): number`: Epsilon-safe financial rounding avoiding IEEE-754 floating-point inaccuracies (e.g., $19.99 * 3 = 59.97, not 59.96999999999999).
2. `calculateLineItem(item: LineItemInput): CalculatedLineItem`:
   - Gross = quantity * unitPrice
   - Discount = percentage (`Gross * discount / 100`) or fixed (`min(discount, Gross)`)
   - Taxable = Gross - Discount
   - LineTax = `Taxable * taxRate / 100`
   - LineTotal = Taxable + LineTax
3. `calculateInvoiceTotals(items: LineItemInput[], amountPaid?: number): InvoiceTotals`:
   - subtotal, totalDiscount, totalTax, grandTotal, amountDue
   - Status transitions (UNPAID -> PARTIALLY_PAID -> PAID / OVERDUE)
4. `formatCurrency(amount: number, currency?: string, locale?: string): string`:
   - Number and currency formatting respecting Arabic RTL bidi standards without sign/symbol inversion.
5. Unit tests: Design comprehensive test cases in `tests/unit/calculations.test.ts` covering 0-values, float arithmetic, over-discount capping, and fractional quantities.

Read:
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\ORIGINAL_REQUEST.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\PROJECT.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_spec_miner_survey_2\handoff.md

Output full implementation blueprints and code in `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m2_2\handoff.md` and report back via send_message.

## 2026-09-19T05:01:51Z
You are teamwork_preview_explorer_m2_2.
Your working directory is: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m2_2
Your task assignment is in: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m2_2\DISPATCH.md
Read:
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\ORIGINAL_REQUEST.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\PROJECT.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_spec_miner_survey_2\handoff.md

Investigate and formulate the code blueprints for the real-time financial math engine in src/lib/calculations.ts:
- roundFinancial with 2-decimal epsilon safety.
- calculateLineItem with fixed and percentage discounts, tax rate, taxable amount, line total.
- calculateInvoiceTotals (subtotal, totalDiscount, totalTax, grandTotal, amountDue, status state transitions).
- formatCurrency with Arabic RTL bidi protection.
- Comprehensive unit test specifications for tests/unit/calculations.test.ts.
Write your recommendations and code in c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m2_2\handoff.md and report back via send_message.
