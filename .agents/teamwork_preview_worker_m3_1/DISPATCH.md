# Dispatch: Worker M3-1 (Milestone 3 Implementation)

**Agent Identity**: teamwork_preview_worker_m3_1
**Working Directory**: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_worker_m3_1
**Role**: Customer Directory & Financial Dashboard Implementer
**Milestone**: Milestone 3 (Customer Directory & Financial Dashboard Modules)

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Task Description
Implement the complete Customer Directory, Customer Ledger, and Financial Dashboard modules based on the architectural findings and specifications from Explorers M3-1, M3-2, and M3-3:

1. **Atomic Mutations Additions (`src/lib/atomicMutations.ts`)**:
   - Implement `updateCustomerAtomic`, `archiveCustomerAtomic`, and `deleteCustomerAtomic`.
   - Ensure all mutations strictly use `writeBatch()`, never `runTransaction()`.
   - Protect customer financial balances: `outstandingAmount`, `totalInvoiced`, and `totalPaid` must never be directly mutated by customer edit forms.
   - Enforce referential safety: customer cannot be deleted if `outstandingAmount > 0`.

2. **Customer State Management (`src/hooks/useCustomers.ts`)**:
   - Subscribe to `collections.customers` via `onSnapshot` with `{ includeMetadataChanges: true }`.
   - Integrate with `useSyncStatus.ts` (`trackSnapshotPendingWrites`, `unregisterPendingSource`, `trackPendingPromise`).
   - Implement client-side Arabic normalization (stripping diacritics, unifying Alef and Teh Marbuta) and multi-field search (name, email, phone, tax number) and sorting.
   - Expose CRUD functions: `createCustomer`, `updateCustomer`, `archiveCustomer`, `deleteCustomer`.

3. **Customer Directory UI (`src/components/modules/customers/`)**:
   - `CustomerList.tsx`: Responsive directory with search bar, status filter, view toggle (compact card grid vs dense table). Mobile cards strictly `<90px` height (`h-[82px]`).
   - `CustomerModal.tsx`: Accessible modal with validation (name required, email/phone format, tax ID format) and read-only financial balance strip in edit mode.
   - Wrap all phone numbers, tax IDs, and currency amounts in `<BidiIsolate>`.

4. **Customer Profile & Ledger View (`src/hooks/useCustomerLedger.ts` & `src/components/modules/customers/`)**:
   - `useCustomerLedger.ts`: In-memory offline join of invoices and payments where `customerId == id`. Chronological interleaving (Debit = Invoiced, Credit = Paid, tie-breaker: invoice before payment). Running balance calculation with `roundFinancial`.
   - `CustomerProfileSummary.tsx`: Contact information, tax number, and 3 compact KPI cards (<90px height using `CompactMetricCard`): Total Invoiced, Total Paid, Outstanding Balance.
   - `CustomerLedger.tsx`: Mobile compact transaction cards (`~70px` height) vs desktop dense table, search, date filter, back button with `rtl:rotate-180`.

5. **Real-Time Financial Dashboard (`src/hooks/useDashboardMetrics.ts` & `src/components/modules/dashboard/`)**:
   - `useDashboardMetrics.ts`: Live calculation of Total Revenue (`sum(amountPaid)` for non-cancelled invoices), Outstanding Receivables (`sum(amountDue)` for non-cancelled/non-draft invoices), Paid Invoices count, and dynamic Overdue Invoices count (`dueDate < today && amountDue > 0`). Strictly use `roundFinancial`.
   - `MetricsGrid.tsx`: 4 compact KPI cards (<90px, `h-[82px]`) using `CompactMetricCard` (Total Revenue, Outstanding Receivables, Paid Invoices, Overdue Invoices). 2-col mobile (`grid-cols-2`), 4-col desktop (`lg:grid-cols-4`).
   - `useActivityLog.ts` & `ActivityFeed.tsx`: Chronological stream from `activity_logs`, event icons, relative time formatting (bilingual EN/AR), and bidi-safe IDs.
   - `DashboardView.tsx`: Assemble Header with Quick Actions, `<MetricsGrid />`, Recent Invoices, and `<ActivityFeed />`.

6. **Route Wiring in `src/App.tsx`**:
   - Route `/` renders `<DashboardView />`.
   - Route `/customers` renders `<CustomerList />` (supporting navigation to `<CustomerLedger />` when a customer is selected).

7. **Unit & Component Tests**:
   - Write comprehensive tests for `useCustomers`, `useCustomerLedger`, `useDashboardMetrics`, `CustomerList`, `CustomerLedger`, and `DashboardView`.
   - Ensure all tests pass alongside existing test suites (`npm test`).
   - Run `npm run build` and `npm run test:smoke` to verify zero regressions.

Read:
- `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\ORIGINAL_REQUEST.md`
- `c:\Users\ayami\Documents\antigravity\focused-hypatia\PROJECT.md`
- `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m3_1\handoff.md`
- `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m3_2\handoff.md`
- `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m3_3\handoff.md`

Check drop-in implementations available in Explorer directories:
- `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m3_1\proposed_useCustomers.ts`
- `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m3_1\proposed_CustomerList.tsx`
- `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m3_1\proposed_CustomerModal.tsx`
- `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m3_2\proposed_useCustomerLedger.ts`
- `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m3_2\proposed_CustomerProfileSummary.tsx`
- `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m3_2\proposed_CustomerLedger.tsx`

Document your implementation details, build/test results, and verification steps in `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_worker_m3_1\handoff.md` and report back via send_message.
