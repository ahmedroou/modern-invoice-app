# Handoff Report: Empirical Financial Math Stress Testing (Milestone 2)

**Agent**: `teamwork_preview_challenger_m2_1`  
**Working Directory**: `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_challenger_m2_1`  
**Milestone**: Milestone 2 (Firebase Offline-First & Financial Calculation Engine)  
**Date**: 2026-09-19T09:46:00Z  
**Role**: Empirical Financial Math Challenger (critic, specialist)  
**Verdict**: **APPROVE** (with 1 non-blocking defense-in-depth recommendation)

---

## 1. Observation

Direct empirical observations from source code inspection, test harness execution, and build outputs:

### 1.1 Scope & Test Suite Execution
- **Implementation Inspected**: `src/lib/calculations.ts` (271 lines), `src/types/domain.ts` (279 lines).
- **Stress Test Harness**: Created `tests/unit/calculations.stress.test.ts` (490 lines, 17 test suites).
- **Execution of Stress Test Suite**:
  ```
  npx vitest run tests/unit/calculations.stress.test.ts
  ```
  *Result*: Exit code 0, 1 test file passed, 17/17 tests passed in 147ms.
- **Execution of Repository Test Suite**:
  ```
  npm test
  ```
  *Result*: Exit code 0, 12 test files passed (12/12), 157/157 tests passed in 4.18s.
- **Execution of Production Build**:
  ```
  npm run build
  ```
  *Result*: Exit code 0, 0 TypeScript errors, 1606 Vite modules transformed, Electron bundles generated cleanly.

---

### 1.2 Precision Boundaries & IEEE-754 Edge Cases (`roundFinancial`)
1. **Systematic Half-Way Boundaries (0.005 to 50.005)**:
   - Evaluated 51 positive boundaries (`0.005`, `1.005`, ..., `50.005`): All 51 rounded up to `x.01` (100% pass).
   - Evaluated 51 negative boundaries (`-0.005`, `-1.005`, ..., `-50.005`): All 51 rounded away from zero to `-x.01` (100% pass).
2. **Sub-Unit Cent Boundaries (0.005 to 0.995)**:
   - Evaluated 100 positive cent boundaries (`0.005`, `0.015`, ..., `0.995`): 100/100 matched `roundFinancial((k + 1) / 100, 2)`.
   - Evaluated 100 negative cent boundaries (`-0.005`, `-0.015`, ..., `-0.995`): 100/100 matched `-roundFinancial((k + 1) / 100, 2)`.
   - Combined total: 200/200 cent-boundary test cases passed.
3. **Notorious IEEE-754 Binary Representation Traps**:
   - `1.05 * 3` (`3.1500000000000004`) -> correctly resolved to `3.15`.
   - `19.99 * 3` (`59.970000000000006`) -> correctly resolved to `59.97`.
   - `0.1 + 0.2` (`0.30000000000000004`) -> correctly resolved to `0.3`.
   - `35.855` (where `(35.855 + Number.EPSILON) * 100` yields `35.85`) -> correctly resolved to `35.86`.
   - `0.28 * 100` (`28.000000000000004`) -> correctly resolved to `28`.
   - `0.29 * 100` (`28.999999999999996`) -> correctly resolved to `29`.
   - `0.57 * 100` (`56.99999999999999`) -> correctly resolved to `57`.
   - `0.58 * 100` (`57.99999999999999`) -> correctly resolved to `58`.
   - `1.0049999` -> `1.00`; `1.0050001` -> `1.01`.
4. **Negative Zero (`-0`) Cleaning**:
   - `roundFinancial(-0)` produced `0`. `Object.is(result, 0)` is `true`; `Object.is(result, -0)` is `false`.
   - `1 / roundFinancial(-0)` strictly equals `+Infinity` (not `-Infinity`).
   - Negative sub-cent numbers (`-0.000001`, `-0.00499`) rounding to zero strictly produce `0` (positive zero) with `1 / result === +Infinity`.
5. **Diverse Decimals & Defensive Handling**:
   - Precision arguments 0, 1, 3, 4, 6 decimals verified with exact half-up symmetry.
   - Non-numeric inputs (`NaN`, `Infinity`, `-Infinity`, `null`, `undefined`, `{}`, string) defensively sanitize to `0`.

---

### 1.3 Line Item & Invoice Totals Adversarial Scenarios
1. **Extreme Discounts**:
   - Percentage discounts >100% (`100.01%`, `105%`, `150%`, `500%`, `10000%`): `lineDiscount` correctly clamped to `grossAmount` (`100.00`). `taxableAmount`, `lineTax`, and `lineTotal` remain non-negative and clamp to `0.00`.
   - Negative percentage discounts (`-25%`): Clamped to `0%`, leaving gross amount unaffected (`lineDiscount = 0.00`).
   - Fixed discounts exceeding gross (`75.01`, `100`, `10000` on gross `75`): `lineDiscount` correctly clamped to `grossAmount` (`75.00`), preventing negative taxable and total amounts.
   - Negative fixed discounts (`-50`): Clamped to `0.00`.
2. **Fractional Quantities & Zero Tax Rates**:
   - `quantity: 0.001, unitPrice: 100.00, taxRate: 15%` -> `grossAmount: 0.10, taxableAmount: 0.10, lineTax: 0.02, lineTotal: 0.12`.
   - `quantity: 12.345, unitPrice: 67.89, discount: 10%, taxRate: 15%` -> `grossAmount: 838.10, lineDiscount: 83.81, taxableAmount: 754.29, lineTax: 113.14, lineTotal: 867.43`.
   - `quantity: 1/3, unitPrice: 300.00` -> `grossAmount: 100.00, lineTotal: 100.00`.
   - `taxRate: 0%` -> `lineTax: 0.00, lineTotal: taxableAmount`.
   - `taxRate: -15%` -> sanitized to `0%`, `lineTax: 0.00`.
3. **Property-Based Invariant Verification (1,000 Randomized Invoices)**:
   - Executed Monte Carlo simulation of 1,000 randomized multi-item invoices (1 to 10 items, randomized fractional/integer quantities, random prices, extreme discounts, and tax rates).
   - In 1,000 out of 1,000 invoices (100.0%):
     - `totals.grandTotal === roundFinancial(sum(lineTotal))` held identically.
     - `totals.grandTotal === roundFinancial(subtotal - totalDiscount + totalTax)` held identically.
     - `totals.subtotal === roundFinancial(sum(grossAmount))` held identically.
     - `totals.totalDiscount === roundFinancial(sum(lineDiscount))` held identically.
     - `totals.totalTax === roundFinancial(sum(lineTax))` held identically.
   - **Crucial Empirical Discovery**:
     - The raw unrounded JavaScript float sum `items.reduce((acc, it) => acc + it.lineTotal, 0)` experienced IEEE-754 drift in **300 out of 1,000 invoices (30.0%)**.
     - In contrast, `calculateInvoiceTotals` uses `roundFinancial`, completely eliminating floating-point drift. This empirically validates the architectural requirement that all UI summaries must derive from `calculateInvoiceTotals` rather than raw client-side array reduces.

---

### 1.4 Currency Formatting Localization & Bidi Security (`formatCurrency`)
1. **English Locale (`en` / `en-US`)**:
   - Positive USD: `formatCurrency(1250.5, 'USD', 'en')` -> `"$1,250.50"`.
   - Negative USD: `formatCurrency(-1250.5, 'USD', 'en')` -> `"-$1,250.50"`.
   - Zero: `formatCurrency(0, 'USD', 'en')` -> `"$0.00"`.
   - Negative Zero: `formatCurrency(-0, 'USD', 'en')` -> `"$0.00"`.
2. **Arabic Locale (`ar` / `ar-SA-u-nu-latn`)**:
   - Positive SAR: `formatCurrency(1250.5, 'SAR', 'ar')` -> `"‏1,250.50 ر.س.‏"` (`\u200f1,250.50\u00a0\u0631.\u0633.\u200f`).
   - Western Arabic Numerals: Renders `1,250.50` (ASCII digits). No Eastern Arabic-Indic numerals (`١٬٢٥٠`) appear.
   - Negative SAR: `formatCurrency(-1250.5, 'SAR', 'ar')` -> `"‏‎-1,250.50 ر.س.‏"` (`\u200f\u200e-1,250.50\u00a0\u0631.\u0633.\u200f`).
   - Sign Preservation: Negative sign is protected by `\u200e` (LRM), preventing it from being inverted to the trailing edge of the RTL string (`endsWith('-') === false`).
   - Negative Zero: `formatCurrency(-0, 'SAR', 'ar')` -> `"‏0.00 ر.س.‏"` (no minus sign).
3. **Defensive Fallbacks**:
   - Custom/Unrecognized currency (`CRYPTO_TOKEN`): Renders `"500.25 CRYPTO_TOKEN"` in English, and `"‎-500.25 CRYPTO_TOKEN"` in Arabic starting with `\u200e-` for bidi sign preservation.
   - Non-numeric inputs (`NaN`, `Infinity`, `-Infinity`, `null`, `undefined`) format cleanly as `"$0.00"`.

---

## 2. Logic Chain

1. **Precision Rounding Integrity**:
   - `roundFinancial` operates by splitting mantissa and exponent via `.toString().split('e')` and performing decimal exponential shifting: `Number(parts[0] + 'e' + (exponent + decimals))`.
   - This shifts the target rounding place exactly before the decimal point in base-10 space, bypassing IEEE-754 binary mantissa truncation.
   - In 102/102 half-up boundary cases and 200/200 cent-boundary cases, exact half-up symmetry away from zero was empirically confirmed.
   - The explicit check `Object.is(result, -0) || result === 0 ? 0 : result` guarantees that IEEE-754 `-0` cannot leak into state or downstream logic.

2. **Invariants & Over-Discount Clamping**:
   - In `calculateLineItem`, `lineDiscount` is capped via `Math.min(grossAmount, ...)` for both FIXED and PERCENTAGE discounts.
   - `taxableAmount` is wrapped in `Math.max(0, grossAmount - lineDiscount)`.
   - Because all individual line fields are rounded with `roundFinancial`, and invoice aggregate totals sum these 2-decimal rounded components before applying `roundFinancial`, the identity `grandTotal === roundFinancial(sum(lineTotal))` holds with 100% mathematical consistency.
   - The 30.0% drift observed in raw unrounded floating-point addition proves that relying on standard JavaScript `Array.prototype.reduce` without financial rounding would introduce random sub-cent visual artifacts. The calculation engine completely prevents this.

3. **Arabic RTL Directional Isolation**:
   - In `formatCurrency`, passing `'ar-SA-u-nu-latn'` enforces Western numerals (`1, 2, 3...`), complying with GCC accounting standards.
   - In the fallback branch, `\u200e` (Left-to-Right Mark) isolates the minus sign and numeral from the trailing RTL currency string.
   - In the standard `Intl.NumberFormat` branch, the browser's Unicode Bidirectional Algorithm wraps the numeral in `\u200f\u200e`, ensuring negative signs remain adjacent to the number rather than floating to the end of the text.

---

## 3. Caveats

1. **Sub-Cent Negative Float Inputs to `formatCurrency` (Non-Blocking Observation)**:
   - In `src/lib/calculations.ts` (lines 241-244):
     ```typescript
     const safeAmount =
       typeof amount !== 'number' || isNaN(amount) || !isFinite(amount) || Object.is(amount, -0)
         ? 0
         : amount;
     ```
   - If an external caller passes an unrounded negative number between `-0.005` and `0` (e.g. `-0.00001` or `-0.004`), `Object.is(amount, -0)` evaluates to `false`. When passed to `Intl.NumberFormat`, it renders as `-$0.00` in English and `‏‎-0.00 ر.س.‏` in Arabic.
   - *Impact Assessment*: **Negligible / Non-blocking**. All outputs generated by the financial calculation engine (`lineTotal`, `grandTotal`, `amountDue`) pass through `roundFinancial` before being returned, which already rounds sub-cent negative numbers to strict `0`. Thus, this condition cannot arise from invoice domain operations.
   - *Recommendation for future refinement*: In `formatCurrency`, apply `roundFinancial(amount, 2)` before evaluating `safeAmount`.

2. **Vitest JSDOM Node Environment**:
   - `Intl.NumberFormat` output strings contain invisible Unicode bidi markers (`\u200e` and `\u200f`). These render seamlessly in Chromium and WebKit rendering engines without visual glyph distortion.

---

## 4. Conclusion

**Verdict: APPROVE**

The real-time financial math engine implemented in `src/lib/calculations.ts` satisfies all requirements and acceptance criteria:
1. **Precision Boundaries**: 100% pass across 300+ precision edge cases in `roundFinancial`, with symmetric half-up rounding and strict `-0` elimination.
2. **Line Item & Invoice Totals**: 100% pass across extreme discounts (>100% and >gross), fractional quantities, and zero tax rates. The invariant `grandTotal === roundFinancial(sum(lineTotal))` holds unconditionally across 1,000 multi-item randomized test invoices.
3. **Currency Formatting**: Localized formatting in English and Arabic verified for positive, negative, and zero amounts, with Latin numerals in Arabic mode and bidi isolation protecting negative signs.
4. **Test Suite Health**: All 157 tests pass across 12 test files with 0 failures; production build compiles with 0 errors.

Milestone 2 is approved and ready for Milestone 3 integration.

---

## 5. Verification Method

To independently verify all findings and execute the empirical stress test suite:

1. **Run Empirical Financial Math Stress Suite**:
   ```bash
   npx vitest run tests/unit/calculations.stress.test.ts
   ```
   *Expected Result*: 17/17 tests pass in <500ms, outputting Monte Carlo drift statistics (30.0% raw float drift, 100.0% financial invariant satisfaction).

2. **Run Full Test Suite**:
   ```bash
   npm test
   ```
   *Expected Result*: 12/12 test files and 157/157 tests pass with 0 failures.

3. **Verify Clean Production Build**:
   ```bash
   npm run build
   ```
   *Expected Result*: TypeScript compilation and Vite build exit with code 0.
