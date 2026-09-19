# Handoff Report: Customer Profile, Ledger View & Transaction History (`CustomerLedger.tsx`)

**Agent Identity**: `teamwork_preview_explorer_m3_2`  
**Working Directory**: `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m3_2`  
**Role**: Customer Ledger & History Specialist  
**Milestone**: Milestone 3 (Customer Directory & Financial Dashboard Modules)  
**Date**: 2026-09-19T09:50:00Z  

---

## 1. Observation

Direct code observations from the inspected codebase:

### 1.1 Domain Types & Interfaces (`src/types/domain.ts`)
- **Customer** (`lines 4–19`):
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
- **Invoice** (`lines 34–54`):
  Contains `customerId: string`, `invoiceNumber: string`, `issueDate: string` (`YYYY-MM-DD`), `dueDate: string`, `currency: string`, `grandTotal: number`, `amountPaid: number`, `amountDue: number`, `status: InvoiceStatus` (`'DRAFT' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED'`).
- **Payment** (`lines 56–69`):
  Contains `customerId: string`, `paymentNumber: string`, `invoiceId: string`, `invoiceNumber: string`, `amount: number`, `paymentDate: string` (`YYYY-MM-DD`), `paymentMethod: PaymentMethod` (`'CASH' | 'BANK_TRANSFER' | 'CREDIT_CARD' | 'CHECK' | 'ONLINE_GATEWAY' | 'OTHER'`), `referenceNumber?: string`.

### 1.2 Financial Math & Precision (`src/lib/calculations.ts`)
- **`roundFinancial`** (`lines 48–67`):
  Implements symmetric decimal exponential shifting (`round half away from zero`) to eliminate IEEE-754 mantissa errors (e.g. `19.99 * 3 = 59.97`, not `59.96999999999999`). Sanitizes `NaN`, `Infinity`, and `-0`.
- **`formatCurrency`** (`lines 236–270`):
  Uses `Intl.NumberFormat` with `'ar-SA-u-nu-latn'` in Arabic mode, returning Western Arabic numerals (`1, 2, 3...`) with native LTR sign isolation markers (`\u200e`).

### 1.3 Offline Firestore Persistence & Multi-Tab Cache (`src/lib/firebase.ts`)
- Firestore is configured with `persistentLocalCache` and `persistentMultipleTabManager` (`lines 47–53`), providing 0ms local read/write against IndexedDB.
- `collections.invoices` and `collections.payments` are strongly typed collection references.
- Single-field equality queries (e.g. `where('customerId', '==', customerId)`) operate completely offline without requiring server composite index builds.

### 1.4 Atomic Multi-Document Mutations (`src/lib/atomicMutations.ts`)
- `createInvoiceAtomic` (`lines 71–75`): Increments `customer.outstandingAmount` by `initialAmountDue` and `customer.totalInvoiced` by `grandTotal`.
- `recordPaymentAtomic` (`lines 184–189`): Decrements `customer.outstandingAmount` by `paymentAmount` and increments `customer.totalPaid` by `paymentAmount`.
- Both mutations commit locally via `writeBatch.commit()`, immediately firing snapshot listeners with `metadata.hasPendingWrites: true`.

### 1.5 Compact Card & UI System Components
- **`CompactCard.tsx`** (`src/components/common/CompactCard.tsx`): Provides minimal padding (`p-2.5 sm:p-3`), `min-w-0 max-w-full overflow-hidden`, and dark mode support.
- **`CompactMetricCard.tsx`** (`src/components/common/CompactMetricCard.tsx`, `line 56`): Strict height of `h-[82px]` (conforms to the user's `<90px` height global rule). Uses `<BidiIsolate>` on values (`line 63`).
- **`BidiIsolate.tsx`** (`src/components/common/BidiIsolate.tsx`): Sets `dir="ltr"` with `tabular-nums unicode-isolate` to protect numbers, dates, currency codes, and phone numbers from Unicode Bidirectional Algorithm scrambling.
- **`useSyncStatus.ts`** (`src/hooks/useSyncStatus.ts`, `lines 161–174`): Provides `trackSnapshotPendingWrites` and `unregisterPendingSource` to integrate listener write state with the global SaaS sync badge.

---

## 2. Logic Chain

From the observations above, the architectural design of the Customer Ledger proceeds through the following reasoned steps:

1. **Step 1: Offline Join Architecture**
   - *Observation*: Firestore is a NoSQL database without multi-collection server JOINs. Furthermore, composite indexes created on the server are not automatically synthesized offline.
   - *Inference*: The ledger must query `invoices` (`where('customerId', '==', id)`) and `payments` (`where('customerId', '==', id)`) as two independent single-field equality queries with `{ includeMetadataChanges: true }`.
   - *Outcome*: Single-field queries execute 100% offline from the local IndexedDB cache with zero latency. Joining, chronological sorting, and running balance calculation are performed in-memory inside the `useCustomerLedger` hook.

2. **Step 2: Accounting Interleaving & Balance Accrual**
   - *Observation*: Customer receivables represent an Asset account. Invoices increase the receivable (Debit), while Payments reduce the receivable (Credit).
   - *Inference*: To compute a mathematically correct running balance, transactions must be sorted chronologically from oldest to newest:
     - Primary: Transaction date (`issueDate` / `paymentDate` ascending).
     - Secondary: `createdAt` timestamp ascending.
     - Tertiary Tie-breaker: If an Invoice and a Payment share the same date and timestamp (e.g. cash sale where payment is created alongside invoice), **the Invoice must precede the Payment**.
   - *Outcome*: Debiting first ($0 \rightarrow +X$) and then Crediting ($+X \rightarrow 0$) prevents spurious, confusing negative balance dips in accounts receivable reporting.

3. **Step 3: Financial Precision & Float Drift Elimination**
   - *Observation*: Standard JavaScript float math drifts over repetitive accumulation (e.g. `0.1 + 0.2 = 0.30000000000000004`).
   - *Inference*: Every sequential addition and subtraction must be wrapped in `roundFinancial(running + debit - credit)`.
   - *Outcome*: Running balances match exact decimal expectations. Reconciling the calculated final balance against `customer.outstandingAmount` guarantees audit-level integrity.

4. **Step 4: Draft and Cancelled Invoice Handling**
   - *Observation*: Invoices can have status `'DRAFT'` or `'CANCELLED'`.
   - *Inference*: In accounting standards, drafts are non-posting (uncommitted) and cancelled invoices must not encumber the customer with debt.
   - *Outcome*: `useCustomerLedger` filters out `CANCELLED` and `DRAFT` invoices from posting balance calculations.

5. **Step 5: Mobile-First (375px) Responsive Layout**
   - *Observation*: A standard 7-to-8 column financial table requires at least 650px to render without horizontal scroll or truncated text, which fails on 375px smartphone screens.
   - *Inference*: The component must adopt a dual-layout strategy:
     - On mobile (`< md`, < 768px): Render **Compact Transaction Cards** (`~70px` height) showing Type badge, Reference number (`<BidiIsolate>`), Date, Description, Amount, and Running Balance pill.
     - On desktop (`md+`, $\ge 768$px): Render a dense, full **Tabular Ledger** with logical text alignment.

6. **Step 6: Arabic RTL Mirroring & Bidi Protection**
   - *Observation*: Alphanumeric strings with punctuation (such as `INV-2026-001`, `+966 50 123 4567`, `2026-09-19`, and negative currencies `-1,250.00 ر.س.`) are inverted or scrambled by the Unicode Bidirectional Algorithm in Arabic RTL mode.
   - *Inference*: All reference codes, dates, phone numbers, tax numbers, and amounts must be explicitly wrapped in `<BidiIsolate>` (which enforces `dir="ltr"` and `unicode-isolate`). Directional icons (such as the back button arrow) must use `rtl:rotate-180`.

---

## 3. Caveats

1. **Transaction Volume & In-Memory Sorting**:
   - For desktop and mobile local usage, customer ledgers typically contain dozens to hundreds of transactions. In-memory joining and sorting is sub-millisecond.
   - If an individual customer accumulates more than 5,000 transactions over several years, fetching all records could impact memory. Future optimization can add a date-range filter query (e.g. "Last 12 Months").
2. **Reconciliation Variance**:
   - Customer `outstandingAmount` is maintained via atomic `increment()` operations in Firestore.
   - If legacy data or an external script modifies an invoice outside of `writeBatch`, the hook's computed balance (`totalInvoiced - totalPaid`) may differ from `customer.outstandingAmount`. The design includes an automated audit variance warning banner (`!isReconciled`) rather than silently overriding either value.
3. **Draft Invoices in Statement**:
   - Draft invoices are excluded from the balance to preserve accounting accuracy. If users need to view draft invoices, they can toggle the invoice list filter in the main Invoices module.

---

## 4. Conclusion

The Customer Ledger, Profile Summary, and Transaction History system is fully architected and designed with three drop-in replacement files ready for implementation:

### 4.1 Artifacts Created in `.agents/teamwork_preview_explorer_m3_2/`:
1. **`proposed_useCustomerLedger.ts`**:
   - Subscribes to `customer` doc, `invoices` collection (`where('customerId', '==', id)`), and `payments` collection (`where('customerId', '==', id)`).
   - Integrates with `useSyncStatus` via `trackSnapshotPendingWrites`.
   - Interleaves transactions chronologically (Debit = Invoice, Credit = Payment).
   - Computes running balance using `roundFinancial`.
   - Provides search, type filter (`ALL`, `INVOICES`, `PAYMENTS`), and sort order toggle (`desc` / `asc`).
   - Computes KPI metrics: `totalInvoiced`, `totalPaid`, `outstandingBalance`, `invoiceCount`, `paymentCount`, `overdueCount`, and `financialStatus` (`CLEARED`, `HAS_BALANCE`, `OVERDUE`).
2. **`proposed_CustomerProfileSummary.tsx`**:
   - Customer header: avatar, name, Active/Archived status, and financial status pill.
   - Metadata strip: Tax/VAT number, Phone, Email, Address, all protected with `<BidiIsolate>`.
   - Action buttons: Quick New Invoice, Quick Record Payment, Print Statement.
   - Three Compact Metric Cards (<90px height, actual: `82px`): Total Invoiced, Total Paid, Outstanding Balance.
3. **`proposed_CustomerLedger.tsx`**:
   - Back button with `rtl:rotate-180`.
   - Reconciliation variance notice banner.
   - Search & filter toolbar.
   - Dual-layout presentation:
     - Mobile (`< md`): Space-efficient compact transaction cards (`~70px` height) with amount and running balance pills.
     - Desktop (`md+`): Full tabular ledger with grand total footer.

### 4.2 Integration Roadmap for Milestone 3 Worker:
- Destination paths:
  - `src/hooks/useCustomerLedger.ts` $\leftarrow$ `proposed_useCustomerLedger.ts`
  - `src/components/modules/customers/CustomerProfileSummary.tsx` $\leftarrow$ `proposed_CustomerProfileSummary.tsx`
  - `src/components/modules/customers/CustomerLedger.tsx` $\leftarrow$ `proposed_CustomerLedger.tsx`
- Routing integration:
  - In `src/App.tsx`, route `/customers/:id` or modal state in `CustomerList.tsx` renders `<CustomerLedger customerId={id} onBack={...} />`.

---

## 5. Verification Method

To independently verify the architecture and implementation:

### 5.1 Automated Unit Tests
Run existing project test suites:
```bash
npx vitest run tests/unit
```
Expected output: 12 test files passed, 157+ tests passed.

### 5.2 Verification Checklist for Customer Ledger

| # | Test Scenario | Verification Procedure | Expected Outcome |
|---|---------------|------------------------|------------------|
| 1 | **Running Balance Calculation** | Feed an invoice of $1,000, payment of $400, invoice of $500, payment of $1,100 | Entries show running balances: +$1,000 $\rightarrow$ +$600 $\rightarrow$ +$1,100 $\rightarrow$ $0.00. |
| 2 | **Epsilon Float Rounding** | Create 3 invoices of $19.99 and record payment of $59.97 | Balance evaluates to exactly `0.00`, avoiding `0.000000000000007`. |
| 3 | **Same-Day Interleaving** | Create Invoice and Payment with same calendar date and timestamp | Invoice (Debit) is sorted before Payment (Credit); balance never dips negative. |
| 4 | **Offline Firestore Queries** | Call `simulateOffline()` and query invoices/payments for customer | Queries resolve immediately against local IndexedDB cache with 0ms delay. |
| 5 | **Mobile Viewport (375px)** | Resize browser or inspect in DevTools at 375px $\times$ 667px | Compact transaction cards render within 375px; zero horizontal scrollbar; cards $\le 75$px height. |
| 6 | **KPI Card Height** | Inspect computed CSS height of KPI cards in DOM | Computed height is `82px` (strictly $< 90$px). |
| 7 | **Arabic RTL Mirroring & Bidi** | Toggle language to Arabic (`lang="ar"`, `dir="rtl"`) | UI mirrors to RTL; reference numbers (`INV-2026-001`), phone numbers (`+966 50...`), and dates (`2026-09-19`) maintain correct LTR character order inside `<BidiIsolate>`. |
| 8 | **Quick Actions** | Click "New Invoice" or "Record Payment" from summary card | Triggers callbacks passing `customerId` pre-filled. |
