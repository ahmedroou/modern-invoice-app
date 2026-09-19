# DISPATCH — teamwork_preview_spec_miner_m4_2_r2

## Timestamp: 2026-09-19T14:48:00Z

## Mission
Extract and specify all functional requirements, edge cases, data flows, and state transitions for Payments & Invoice Status Auto-Transitions in Milestone 4:
1. Full & Partial Payment Recording:
   - Partial payment: payment < amountDue -> invoice status moves to PARTIALLY_PAID, amountPaid increases, amountDue decreases, customer outstandingAmount decrements by payment amount (AC4, AC5).
   - Full payment: payment == amountDue -> invoice status moves to PAID, amountPaid = grandTotal, amountDue = 0, customer outstandingAmount decrements to 0, activity log records PAYMENT_RECORDED (AC5).
   - Over-payment guard: payment amount cannot exceed amountDue.
2. Payment Methods & Metadata:
   - PaymentMethod enum: CASH, BANK_TRANSFER, CREDIT_CARD, CHECK, ONLINE_GATEWAY, OTHER.
   - Reference number, payment date, notes.
3. Atomic Offline writeBatch Mutations:
   - Integration with `recordPaymentAtomic` in `src/lib/atomicMutations.ts`.
   - Ensure customer `outstandingAmount` is decremented and `totalPaid` is incremented.
   - Activity log entry generated atomically.
4. UI Component Architecture:
   - `PaymentModal.tsx`: Accessible dialog / mobile bottom sheet with payment form, auto-fill remaining amountDue, validation.
   - `PaymentList.tsx`: Chronological payments ledger with compact cards (<90px), search by reference/customer, filter by method.
   - Status auto-transitions: Dynamic calculation of OVERDUE (dueDate < today && amountDue > 0).

## Required Reading
- `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\ORIGINAL_REQUEST.md`
- `c:\Users\ayami\Documents\antigravity\focused-hypatia\PROJECT.md`
- `c:\Users\ayami\Documents\antigravity\focused-hypatia\TEST_INFRA.md`
- `c:\Users\ayami\Documents\antigravity\focused-hypatia\src\lib\atomicMutations.ts`
- `c:\Users\ayami\Documents\antigravity\focused-hypatia\src\lib\calculations.ts`
- `c:\Users\ayami\Documents\antigravity\focused-hypatia\src\types\domain.ts`

## Deliverable
Write your comprehensive specifications and recommendations to:
`c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_spec_miner_m4_2_r2\handoff.md`
Report back via send_message when complete.
