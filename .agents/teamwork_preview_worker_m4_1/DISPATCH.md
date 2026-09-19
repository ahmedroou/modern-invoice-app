# DISPATCH — teamwork_preview_worker_m4_1

## Timestamp: 2026-09-19T14:53:00Z

## Mission
Implement Milestone 4: Invoices, Payments & Statements Modules for the Modern Offline-First Desktop Invoice Application.

## Mandatory Reading
1. `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\ORIGINAL_REQUEST.md`
2. `c:\Users\ayami\Documents\antigravity\focused-hypatia\PROJECT.md`
3. `c:\Users\ayami\Documents\antigravity\focused-hypatia\TEST_INFRA.md`
4. `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m4_1_r2\handoff.md`
5. `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_spec_miner_m4_2_r2\handoff.md`
6. `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m4_3_r2\handoff.md`

## File Boundaries Owned
- `src/lib/atomicMutations.ts`: Enhance `recordPaymentAtomic` (support `dueDate?: string` so overdue invoices remain `OVERDUE` on partial payment; clamp `newAmountDue` to 0 and mark `PAID` if amount exceeds due), ensure `createInvoiceAtomic`, `updateInvoiceAtomic`, and `cancelInvoiceAtomic` are fully exported.
- `src/hooks/useInvoices.ts`: Real-time reactive query for invoices with search, status/customer/date filters, CRUD atomic helpers.
- `src/hooks/usePayments.ts`: Real-time reactive query for payments with search, method filters.
- `src/hooks/useStatements.ts`: Statement calculation hook (opening balance, chronological interleaving of invoices and payments, sequential running balance, closing balance).
- `src/components/modules/invoices/`:
  - `InvoiceForm.tsx`: Real-time calculations on every keystroke with ZERO calculate button (AC3); keyboard grid navigation (Tab/Shift+Tab, Enter on last cell creates new row and focuses description, Arrow keys navigate rows); global shortcuts (Ctrl+N, Ctrl+S, Esc); customer selector.
  - `InvoiceList.tsx`: Invoice list with compact cards (`h-[82px]`, `<90px` height) and desktop table, search with Arabic text normalization, status filter pills, customer and date range filter.
  - `InvoiceDetail.tsx`: Itemized invoice view with status badge, totals breakdown, print/PDF button, record payment button, cancel button.
- `src/components/modules/payments/`:
  - `PaymentModal.tsx`: Accessible modal / mobile bottom sheet for recording payments (AC4, AC5); quick-fill buttons (`100% Full` and `50% Half`); payment method selector; validation (`payment <= amountDue`); call `recordPaymentAtomic`.
  - `PaymentList.tsx`: Chronological payments ledger with compact cards (`h-[82px]`), search, method filters.
- `src/components/modules/statements/`:
  - `StatementOfAccount.tsx`: Customer selector, date range picker, opening balance, ledger rows, running balance, closing balance, print preview / save PDF via `window.electronAPI.printInvoicePDF`, and CSV export via `window.electronAPI.exportFile`.
- `src/App.tsx`: Route wiring for `/invoices`, `/invoices/new`, `/invoices/:id`, `/payments`, `/statements`, `/statements/:customerId`.
- `tests/unit/invoices.test.tsx`, `tests/unit/payments.test.tsx`, `tests/unit/statements.test.tsx`: Comprehensive unit test suites verifying real-time calculations without button, keyboard navigation, instant balance updates, payment status transitions, statement running balances, and compact card geometries.

## User Global Constraints
- Mobile-first design: All views must scale cleanly to 375px without horizontal scrolling.
- Compact card designs: All KPI and entity cards must be strictly `<90px` vertical height (use `h-[82px]`).
- Arabic RTL: Wrap numerical IDs and currency in `<BidiIsolate>` or `\u200E`.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Verification
Run:
- `npm run build` (must exit 0 with 0 TypeScript / bundling errors)
- `npm test` (all test suites must pass 100%)
- `npm run test:smoke` (smoke tests must pass)

Write your handoff report to:
`c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_worker_m4_1\handoff.md`
Report back via send_message when complete.

## 2026-09-19T12:10:20Z
**Context**: Milestone 4 Implementation
**Content**: Checking on status. Are build/test commands still running or completed? Please report current status and write handoff.md if finished.
**Action**: Reply with status update or complete handoff.

