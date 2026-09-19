# DISPATCH — teamwork_preview_explorer_m4_1_r2

## Timestamp: 2026-09-19T14:48:00Z

## Mission
Investigate and design the technical implementation for Invoice Management & Real-Time Calculation Engine in Milestone 4:
1. Real-Time Automatic Calculations:
   - Line items: quantity, unitPrice, discount, discountType ('PERCENTAGE' | 'FIXED'), taxRate -> lineTotal.
   - Aggregate totals: subtotal, totalDiscount, totalTax, grandTotal, amountDue.
   - NO CALCULATE BUTTON: Grand Total and line totals must update automatically in real-time as items are added/modified without clicking any button (AC3).
   - Epsilon-safe 2-decimal rounding using existing `src/lib/calculations.ts`.
2. Keyboard-Driven Grid Navigation & Shortcuts:
   - Tab/Shift+Tab progression through line item cells: Description -> Quantity -> UnitPrice -> Discount -> TaxRate.
   - Enter in last cell of row creates a new row and focuses its Description input.
   - Arrow key navigation between rows.
   - Global shortcuts: Ctrl+N (new invoice), Ctrl+S (save invoice), Escape (close/cancel).
3. Instant Customer Outstanding Balance Update:
   - Creating an invoice must instantly increment customer's outstandingAmount by grandTotal (AC4).
   - Must use `createInvoiceAtomic` in `src/lib/atomicMutations.ts` (writeBatch) for 100% offline persistence.
4. Compact Card Design & Responsive Mobile-First Layout:
   - Invoice list items must use compact card designs (<90px vertical height, e.g. `h-[82px]`) with clean typography, status badges, and mobile-friendly touch targets.
   - Responsive layout adapting from mobile viewports (375px) up to desktop.
5. Invoice Search & Filter:
   - Filter by customer, status (Draft, Unpaid, Partially Paid, Paid, Overdue, Cancelled), date range, and text search.

## Required Reading
- `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\ORIGINAL_REQUEST.md`
- `c:\Users\ayami\Documents\antigravity\focused-hypatia\PROJECT.md`
- `c:\Users\ayami\Documents\antigravity\focused-hypatia\TEST_INFRA.md`
- `c:\Users\ayami\Documents\antigravity\focused-hypatia\src\lib\calculations.ts`
- `c:\Users\ayami\Documents\antigravity\focused-hypatia\src\lib\atomicMutations.ts`
- `c:\Users\ayami\Documents\antigravity\focused-hypatia\src\types\domain.ts`

## Deliverable
Write your comprehensive analysis and recommendations to:
`c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m4_1_r2\handoff.md`
Report back via send_message when complete.
