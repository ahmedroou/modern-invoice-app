# Handoff Report: Customer Directory, CRUD Forms & Reactive State Architecture

**Agent**: `teamwork_preview_explorer_m3_1`  
**Working Directory**: `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m3_1`  
**Milestone**: Milestone 3 (Customer Directory & Financial Dashboard Modules)  
**Date**: 2026-09-19T09:51:00Z  

---

## 1. Observation

### 1.1 Existing Data Schema & Interfaces (`src/types/domain.ts`)
- In `src/types/domain.ts:4-19`, the `Customer` interface is defined as:
  ```typescript
  export interface Customer {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    taxNumber?: string;
    currency: string;
    outstandingAmount: number;
    totalInvoiced: number;
    totalPaid: number;
    notes?: string;
    status: 'ACTIVE' | 'ARCHIVED';
    createdAt: string;
    updatedAt: string;
  }
  ```
- In `src/types/domain.ts:71-79`, `ActivityLog` is defined with `entityType: 'CUSTOMER' | 'INVOICE' | 'PAYMENT'` and `eventType: 'CUSTOMER_CREATED' | 'CUSTOMER_UPDATED' | 'INVOICE_CREATED' | 'INVOICE_UPDATED' | 'INVOICE_STATUS_CHANGED' | 'PAYMENT_RECORDED'`.

### 1.2 Atomic Balance Mutations (`src/lib/atomicMutations.ts`)
- In `src/lib/atomicMutations.ts:69-75`, invoice creation mutates customer financial fields using atomic `increment()`:
  ```typescript
  const customerRef = doc(firestore, 'customers', inputInvoice.customerId);
  batch.update(customerRef, {
    outstandingAmount: increment(initialAmountDue),
    totalInvoiced: increment(grandTotal),
    updatedAt: now
  });
  ```
- In `src/lib/atomicMutations.ts:184-189`, payment recording decrements `outstandingAmount` and increments `totalPaid`:
  ```typescript
  const customerRef = doc(firestore, 'customers', currentInvoice.customerId);
  batch.update(customerRef, {
    outstandingAmount: increment(-paymentAmount),
    totalPaid: increment(paymentAmount),
    updatedAt: now
  });
  ```
- In `src/lib/atomicMutations.ts:232-280`, `createCustomerAtomic` initializes `outstandingAmount: 0`, `totalInvoiced: 0`, `totalPaid: 0`, and writes an `ActivityLog` entry with `eventType: 'CUSTOMER_CREATED'`.
- Currently missing in `src/lib/atomicMutations.ts`: `updateCustomerAtomic`, `archiveCustomerAtomic`, and `deleteCustomerAtomic`.

### 1.3 Sync Tracking & Offline State Infrastructure (`src/hooks/useSyncStatus.ts` & `src/lib/firebase.ts`)
- `src/lib/firebase.ts:47-52` configures Firestore with `persistentLocalCache`, `persistentMultipleTabManager()`, and `CACHE_SIZE_UNLIMITED`.
- `src/hooks/useSyncStatus.ts:154-181` provides:
  - `trackSnapshotPendingWrites(sourceId: string, snapshot: { metadata: { hasPendingWrites: boolean } }): void`
  - `unregisterPendingSource(sourceId: string): void`
  - `trackPendingPromise<T>(promise: Promise<T>): Promise<T>`
- Any reactive hook querying Firestore offline must invoke `trackSnapshotPendingWrites` inside `onSnapshot({ includeMetadataChanges: true })` so that `SyncBadge` reflects uncommitted offline writes in real-time.

### 1.4 UI & RTL Layout Standards (`src/components/common/` & `src/context/DirectionContext.tsx`)
- `src/components/common/CompactMetricCard.tsx:56` sets strict card height `h-[82px]` to comply with the user's `<90px` compact card constraint.
- `src/components/common/BidiIsolate.tsx:18-26` wraps text in `dir="ltr"` and `unicode-isolate tabular-nums` to prevent Arabic Unicode Bidirectional Algorithm (UBA) inversion for phone numbers, IDs, and numeric metrics.
- `src/context/DirectionContext.tsx:162-175` formats currency with `SAR` (`ر.س`) or `USD` (`$`) and provides `isRTL` / `direction` state.

### 1.5 Test Suite Status
- Running `npx vitest run tests/unit` executes 12 test files and 157 unit tests, all passing with 100% success.
- Running `npx tsc --noEmit` validates clean TypeScript typing across the workspace with 0 errors.

---

## 2. Logic Chain

### 2.1 Customer Data Model & Integrity Invariants
1. **Financial Immutability in Forms**:
   - `outstandingAmount`, `totalInvoiced`, and `totalPaid` are derived cumulative balances resulting from business transactions (`createInvoiceAtomic` and `recordPaymentAtomic`).
   - If user forms directly permitted updating these numbers, concurrent offline edits or manual input errors would corrupt the general ledger.
   - *Design Decision*: `updateCustomerAtomic` must accept only mutable profile fields (`name`, `email`, `phone`, `address`, `taxNumber`, `currency`, `notes`, `status`). Balances in `CustomerModal.tsx` must be rendered strictly as read-only financial ledger metrics.

2. **Referential Integrity & Soft Deletion**:
   - Invoicing and payment records store `customerId` and rely on customer profiles for audit trails and statement generation.
   - Hard-deleting a customer who has invoices (`totalInvoiced > 0`) or active debt (`outstandingAmount > 0`) breaks foreign references and violates accounting standards.
   - *Design Decision*: Deletion must follow a two-tier strategy:
     1. If `totalInvoiced > 0` or `outstandingAmount > 0`, hard deletion is prohibited with a user-friendly prompt to use soft-archiving (`status: 'ARCHIVED'`).
     2. If `totalInvoiced === 0 && outstandingAmount === 0`, hard deletion is permitted via `deleteCustomerAtomic`.

3. **Activity Logging**:
   - Every customer mutation (`create`, `update`, `archive`, `delete`) must write an atomic record into `activity_logs` inside the same `writeBatch()`, ensuring complete offline audit trail consistency.

### 2.2 Reactive Hook Architecture (`useCustomers.ts`)
1. **Zero-Latency Offline Subscription**:
   - Subscribing to `collection(db, 'customers')` with `{ includeMetadataChanges: true }` guarantees that when `batch.commit()` resolves against local IndexedDB (0ms latency), the snapshot listener fires immediately with `snapshot.metadata.hasPendingWrites = true`.
   - Passing `snapshot` to `trackSnapshotPendingWrites('customers', snapshot)` automatically notifies `syncRegistry`, toggling `SyncBadge` to "Syncing..." until remote cloud synchronization succeeds.
   - On unmount, calling `unregisterPendingSource('customers')` prevents stale pending counts.

2. **In-Memory Client-Side Filtering & Normalization**:
   - For desktop and mobile directories (<5,000 customers), client-side in-memory search and filtering provides instant keystroke feedback without the latency or composite index errors of server queries.
   - Arabic search requires linguistic normalization: stripping tashkeel (diacritics), unifying Alef variants (`أ / إ / آ -> ا`), Teh Marbuta (`ة -> ه`), and Alef Maksura (`ى -> ي`).
   - Phone and tax number matching strips whitespace and special characters.

3. **Aggregate Metric Computation**:
   - The hook computes `metrics` (`totalCount`, `activeCount`, `archivedCount`, `totalOutstanding`, `withDebtCount`) from the raw dataset, powering compact KPI cards on the customer directory page.

### 2.3 Component Architecture (`CustomerList.tsx` & `CustomerModal.tsx`)
1. **Mobile-First Layout (<90px Cards, 375px Viewport)**:
   - On mobile screens (375px), customer cards are sized to `h-[82px]`, fully satisfying the `<90px` user global rule.
   - 2-row layout:
     - Row 1: Initials avatar badge + Truncated Customer Name + Status pill (`Active` / `Archived`).
     - Row 2: Phone number / Email (with `<BidiIsolate>`) + Outstanding Balance (with `<BidiIsolate>`) + Mirrored chevron icon (`rtl:rotate-180`).
   - Zero horizontal overflow: container uses `overflow-hidden`, and text elements use `truncate` and `min-w-0`.

2. **Desktop Adaptation**:
   - Desktop screens (>=768px / 1024px) support a view switcher between Compact Cards and Dense Sortable Table (`h-11` rows, column headers for Name, Contact, Tax ID, Invoiced, Outstanding, Status, Action).

3. **Arabic RTL & Bidirectional Text Isolation**:
   - All directional styling uses CSS Logical Properties (`ps-`, `pe-`, `ms-`, `me-`, `text-start`, `text-end`).
   - `<BidiIsolate>` wraps:
     - Customer phone numbers (`+966 50 123 4567`)
     - Customer Tax/VAT numbers (`300012345600003`)
     - Financial amounts (`formatCurrency(outstandingAmount)`)
     - Customer IDs
   - Icons with directional meaning mirror in RTL (`ChevronRight className="rtl:rotate-180"`).

4. **Accessible Form Dialog (`CustomerModal.tsx`)**:
   - Dual presentation: slide-over bottom-sheet on mobile (<640px) and centered dialog on tablet/desktop (>=640px).
   - Trap focus, autofocus on Name input, dismiss on `Esc` key or backdrop click.
   - When editing, displays a 3-metric read-only header (`Invoiced`, `Paid`, `Outstanding`) to prevent balance tampering while keeping the user informed.

---

## 3. Caveats
- **Large Dataset Scalability**: Client-side filtering is optimal for typical small-to-medium enterprise directories (<5,000 customers). If an enterprise client exceeds 10,000 customer records in local IndexedDB, virtualized scrolling (`@tanstack/react-virtual` or windowing) should be added to `CustomerList.tsx`.
- **ZATCA Tax ID Strict Validation**: The tax ID field currently validates as a trimmed string. For full Saudi ZATCA Phase 2 compliance, an additional 15-digit regex check (`/^3\d{13}3$/`) can be toggled on.
- **No Direct Source Changes**: In strict accordance with explorer read-only constraints, proposed code has been written as artifacts in `.agents/teamwork_preview_explorer_m3_1/` rather than modifying `src/` directly.

---

## 4. Conclusion & Actionable Specifications

### 4.1 Deliverables Produced in `.agents/teamwork_preview_explorer_m3_1/`

| File | Purpose | Key Specifications |
|---|---|---|
| `proposed_atomicMutations_additions.ts` | Atomic Firestore batch operations | `updateCustomerAtomic`, `archiveCustomerAtomic`, `deleteCustomerAtomic` with `writeBatch()` and `activity_logs` |
| `proposed_useCustomers.ts` | Reactive Customer Hook | `onSnapshot` with `includeMetadataChanges: true`, `useSyncStatus` integration, Arabic text normalization, client-side search/sort, CRUD |
| `proposed_CustomerModal.tsx` | Accessible CRUD Dialog | Bottom sheet on mobile, read-only 3-stat financial ledger header in edit mode, validation, RTL bidi isolation |
| `proposed_CustomerList.tsx` | Customer Directory View | `h-[82px]` (<90px) compact cards on 375px mobile, dense table on desktop, search/filter bar, 4 KPI metric cards |
| `proposed_useCustomers.test.ts` | Unit Test Suite | 11 verified tests for Arabic normalization, Alef/Teh Marbuta variants, search filtering, and balance sorting |

### 4.2 Implementation Blueprint for Downstream Agents

1. **Step 1: Append Atomic Customer Mutations**:
   - Append `updateCustomerAtomic`, `archiveCustomerAtomic`, and `deleteCustomerAtomic` from `proposed_atomicMutations_additions.ts` to `src/lib/atomicMutations.ts`.
2. **Step 2: Install Reactive Hook**:
   - Write `src/hooks/useCustomers.ts` using `proposed_useCustomers.ts`.
3. **Step 3: Build Customer Components**:
   - Write `src/components/modules/customers/CustomerModal.tsx` from `proposed_CustomerModal.tsx`.
   - Write `src/components/modules/customers/CustomerList.tsx` from `proposed_CustomerList.tsx`.
4. **Step 4: Wire Route in App.tsx**:
   - Replace `<Route path="customers" element={<PlaceholderView titleKey="nav.customers" />} />` in `src/App.tsx` with `<Route path="customers" element={<CustomerList />} />`.
5. **Step 5: Co-locate Unit Tests**:
   - Place `proposed_useCustomers.test.ts` into `tests/unit/useCustomers.test.ts`.

---

## 5. Verification Method

To independently verify the architecture, run the following test and compilation commands:

```bash
# 1. Verify TypeScript compilation of proposed implementations
npx tsc --noEmit

# 2. Run the proposed useCustomers normalization and filtering tests
npx vitest run .agents/teamwork_preview_explorer_m3_1/proposed_useCustomers.test.ts

# 3. Verify all existing unit tests in the project pass without regression
npx vitest run tests/unit

# 4. Check that mobile layout cards are strictly <90px height
# Inspect proposed_CustomerList.tsx: line 235 defines 'h-[82px]' (<90px)
# Inspect proposed_CustomerModal.tsx: line 209 uses BidiIsolate for all numeric and currency values
```

### Invalidation Conditions
- Any card in mobile card view with computed height >= 90px.
- Inversion of phone numbers or currency symbols when switching `DirectionContext` to `language: 'ar'`.
- Allowing direct form editing of `outstandingAmount`, `totalInvoiced`, or `totalPaid`.
- Failure to report pending snapshot status to `useSyncStatus.ts`.
