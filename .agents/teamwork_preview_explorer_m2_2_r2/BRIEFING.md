# BRIEFING — 2026-09-19T09:34:30Z

## Mission
Investigate and formulate the code blueprints and unit test specifications for the real-time financial math engine in src/lib/calculations.ts.

## 🔒 My Identity
- Archetype: explorer
- Roles: Financial Math & Calculation Engine Specialist
- Working directory: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m2_2_r2
- Original parent: 36d05cd7-07e7-4853-8044-3cce65da5cdc
- Milestone: Milestone 2 (Firebase Offline-First & Financial Calculation Engine)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement directly in src/
- Follow interface contracts in PROJECT.md:154-185
- Epsilon-safe financial rounding avoiding IEEE-754 binary floating point inaccuracies
- Arabic RTL bidi protection for currency formatting
- Comprehensive unit test specifications in tests/unit/calculations.test.ts

## Current Parent
- Conversation ID: 36d05cd7-07e7-4853-8044-3cce65da5cdc
- Updated: not yet

## Investigation State
- **Explored paths**: ORIGINAL_REQUEST.md, PROJECT.md, teamwork_preview_spec_miner_survey_2/handoff.md, src/types/domain.ts, package.json, tests/unit/
- **Key findings**:
  - Identified critical flaw in standard `Math.round(x * 100) / 100` and `(x + Number.EPSILON)` (e.g. 1.005 rounds to 1.00, 35.855 rounds to 35.85).
  - Formulated and empirically validated exponential notation decimal shift algorithm which perfectly rounds 1.005 -> 1.01, 35.855 -> 35.86, and 19.99 * 3 -> 59.97.
  - Line items: Over-discount capping logic verified (fixed discount > grossAmount capped at grossAmount, percentage > 100 capped at 100%, lineTotal floors at 0).
  - Invoice totals: Invariant `grandTotal = subtotal - totalDiscount + totalTax = sum(lineTotal)` guaranteed.
  - Status state transitions: Complete mapping for DRAFT, UNPAID, PARTIALLY_PAID, PAID, and OVERDUE (due date comparison).
  - Arabic RTL bidi currency formatting: 'ar-SA-u-nu-latn' ensures Western Arabic numerals (1, 2, 3...) with LTR sign isolation (\u200e), preventing bidi text inversion.
- **Unexplored areas**: None. All 5 specifications and unit test design are fully analyzed and empirically validated.

## Key Decisions Made
- Use MDN exponential shifting with symmetric sign preservation for `roundFinancial`.
- Provide standalone `determineInvoiceStatus` along with `calculateInvoiceTotals` for reusable status derivation.
- Deliver replacement blueprints in `proposed_calculations.ts` and `proposed_calculations.test.ts`.

## Artifact Index
- proposed_calculations.ts — Complete TypeScript implementation for src/lib/calculations.ts
- proposed_calculations.test.ts — Comprehensive Vitest unit test suite for tests/unit/calculations.test.ts
- handoff.md — Comprehensive 5-component handoff report
