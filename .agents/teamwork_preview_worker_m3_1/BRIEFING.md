# BRIEFING — 2026-09-19T10:00:00Z

## Mission
Implement Milestone 3 deliverables: Customer Directory, Customer Ledger, and Real-Time Financial Dashboard with full Arabic RTL, compact cards (<90px), and offline IndexedDB support.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_worker_m3_1
- Original parent: 36d05cd7-07e7-4853-8044-3cce65da5cdc
- Milestone: Milestone 3 (Customer Directory & Financial Dashboard Modules)

## 🔒 Key Constraints
- Strictly use writeBatch() for all atomic mutations, never runTransaction()
- Customer financial balances (outstandingAmount, totalInvoiced, totalPaid) must never be directly mutated by customer edit forms
- Enforce referential safety: customer cannot be deleted if outstandingAmount > 0 or totalInvoiced > 0
- Mobile cards strictly <90px height (h-[82px] or ~70px)
- Wrap all phone numbers, tax IDs, and currency amounts in <BidiIsolate>
- Arabic normalization: diacritics stripping, Alef unification, Teh Marbuta unification
- In-memory offline join of invoices and payments where customerId == id for ledger
- Zero regressions: run npm run build, npm test, and npm run test:smoke

## Current Parent
- Conversation ID: 36d05cd7-07e7-4853-8044-3cce65da5cdc
- Updated: 2026-09-19T10:00:00Z

## Task Summary
- **What to build**: Full implementation of Milestone 3: Customer Directory & Management, Customer Ledger, and Real-Time Financial Dashboard.
- **Success criteria**: All 8 milestone deliverables implemented and passing all tests (build, test, smoke).
- **Interface contracts**: PROJECT.md § Interface Contracts
- **Code layout**: PROJECT.md § Code Layout

## Key Decisions Made
- Use writeBatch() for updateCustomerAtomic, archiveCustomerAtomic, deleteCustomerAtomic with activity_logs
- Integrate onSnapshot with trackSnapshotPendingWrites and unregisterPendingSource in all reactive hooks
- CustomerList supports both internal state drill-down and route/query params for CustomerLedger
- CustomerModal displays read-only 3-stat financial summary in edit mode
- CustomerLedger renders compact cards (~70px) on mobile and full table on desktop

## Artifact Index
- DISPATCH.md — Assignment instructions
- BRIEFING.md — Situational awareness
- progress.md — Liveness heartbeat and step tracking
- handoff.md — Final completion report

## Change Tracker
- **Files modified**:
  - `src/lib/atomicMutations.ts`: Added updateCustomerAtomic, archiveCustomerAtomic, deleteCustomerAtomic
  - `src/hooks/useCustomers.ts`: Reactive hook for customer CRUD, search, filter, sort, and metrics
  - `src/hooks/useCustomerLedger.ts`: In-memory chronological interleaving and precision running balance
  - `src/hooks/useDashboardMetrics.ts`: Live calculation of revenue, receivables, paid, and dynamic overdue
  - `src/hooks/useActivityLog.ts`: Activity logs subscription with pending writes tracking
  - `src/components/modules/customers/CustomerModal.tsx`: Accessible CRUD dialog with read-only financial strip
  - `src/components/modules/customers/CustomerProfileSummary.tsx`: Header, tax info, actions, and 3 compact KPI cards
  - `src/components/modules/customers/CustomerLedger.tsx`: Responsive ledger with mobile cards and desktop table
  - `src/components/modules/customers/CustomerList.tsx`: Responsive customer directory with search and ledger drill-down
  - `src/components/modules/dashboard/MetricsGrid.tsx`: 4 compact KPI cards (<90px height)
  - `src/components/modules/dashboard/ActivityFeed.tsx`: Activity feed with bilingual relative time formatting
  - `src/components/modules/dashboard/DashboardView.tsx`: Full financial dashboard view
  - `src/App.tsx`: Wired `/` to DashboardView and `/customers` to CustomerList
- **Build status**: PASS (tsc && vite build exit code 0)
- **Pending issues**: None

## Quality Status
- **Build/test result**: PASS (18 test files, 206 tests passing; smoke test passing)
- **Lint status**: 0 errors
- **Tests added/modified**:
  - `tests/unit/useCustomers.test.ts` (16 tests)
  - `tests/unit/atomicMutationsCustomer.test.ts` (6 tests)
  - `tests/unit/useCustomerLedger.test.ts` (5 tests)
  - `tests/unit/DashboardMetrics.test.ts` (11 tests)
  - `tests/unit/CustomerDirectory.test.tsx` (7 tests)
  - `tests/unit/DashboardView.test.tsx` (4 tests)
  - `tests/unit/challenger-m1-empirical.test.tsx` (updated smoke test for M3 dashboard view)

## Loaded Skills
- None
