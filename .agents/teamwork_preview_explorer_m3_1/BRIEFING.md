# BRIEFING — 2026-09-19T09:50:00Z

## Mission
Investigate and design the Customer Directory, CRUD forms, and reactive state management (Customer Data Model, useCustomers hook, CustomerList and CustomerModal components).

## 🔒 My Identity
- Archetype: explorer
- Roles: Customer Domain & State Architecture Specialist
- Working directory: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m3_1
- Original parent: 36d05cd7-07e7-4853-8044-3cce65da5cdc
- Milestone: Milestone 3 (Customer Directory & Financial Dashboard Modules)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement directly in src/
- Mobile-first design: <90px compact cards on mobile, 375px responsive layout
- Arabic RTL & bidirectional text isolation (<BidiIsolate>)
- Firestore offline persistence / IndexedDB cache conformance
- No assumptions; investigate actual source files and existing patterns

## Current Parent
- Conversation ID: 36d05cd7-07e7-4853-8044-3cce65da5cdc
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `src/types/domain.ts`: Customer, Invoice, Payment, ActivityLog schemas
  - `src/lib/atomicMutations.ts`: createInvoiceAtomic, recordPaymentAtomic, createCustomerAtomic
  - `src/hooks/useSyncStatus.ts`: SyncRegistry, trackSnapshotPendingWrites, unregisterPendingSource, trackPendingPromise
  - `src/components/common/BidiIsolate.tsx` & `CompactMetricCard.tsx`: Sizing (<90px), RTL text isolation
  - `src/context/DirectionContext.tsx`: Localization, RTL/LTR layout mirroring, formatCurrency
  - `tests/unit/`: Test setup, vitest test execution
- **Key findings**:
  - Customer financial balances (`outstandingAmount`, `totalInvoiced`, `totalPaid`) are mutated exclusively via `increment()` in `createInvoiceAtomic` and `recordPaymentAtomic`.
  - Customer updates must NEVER allow manual tampering with balances in the UI to maintain referential integrity.
  - Deleting customers with existing invoice history must be prevented; archiving (`status: 'ARCHIVED'`) is recommended.
  - Snapshot listeners must use `{ includeMetadataChanges: true }` and report to `useSyncStatus.ts` for instant offline feedback and sync badge updates.
  - Arabic search requires normalization of Alef variants, Teh Marbuta, and diacritics.
  - Mobile card height is precisely designed at `h-[82px]` (<90px), with two dense rows and `<BidiIsolate>` for phone and currency.
- **Unexplored areas**: None. All requirements analyzed, designed, and tested.

## Key Decisions Made
- Implemented client-side search normalization and filtering to guarantee 0ms latency without requiring remote Firestore compound indexes.
- Integrated `useCustomers` with `trackSnapshotPendingWrites('customers', snapshot)` to ensure `SyncBadge` reflects local uncommitted writes.
- Sized mobile Customer cards to `h-[82px]` (<90px), maintaining full responsiveness at 375px viewport with no overflow.
- Designed `CustomerModal` as responsive bottom-sheet on mobile and centered modal on desktop, featuring a read-only 3-stat ledger header in edit mode.

## Artifact Index
- `DISPATCH.md`: Task assignment from parent orchestrator
- `BRIEFING.md`: Working memory and situational awareness
- `progress.md`: Liveness heartbeat and step tracking
- `proposed_atomicMutations_additions.ts`: Proposed atomic update, archive, and delete functions for `src/lib/atomicMutations.ts`
- `proposed_useCustomers.ts`: Proposed reactive hook for `src/hooks/useCustomers.ts`
- `proposed_CustomerModal.tsx`: Proposed accessible CRUD form dialog for `src/components/modules/customers/CustomerModal.tsx`
- `proposed_CustomerList.tsx`: Proposed responsive directory component for `src/components/modules/customers/CustomerList.tsx`
- `proposed_useCustomers.test.ts`: Verified unit tests for search normalization and filtering
- `handoff.md`: 5-component architectural handoff report
