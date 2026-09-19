# Milestone 4 Specification Report: Payments & Invoice Status Auto-Transitions

> **Document Type**: Specification Miner Handoff Report  
> **Milestone**: Milestone 4 — Payments, Customer Balance Synchronization & Status Auto-Transitions  
> **Agent**: `teamwork_preview_spec_miner_m4_2_r2`  
> **Working Directory**: `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_spec_miner_m4_2_r2`  
> **Target Audience**: Orchestrator, Worker (`teamwork_preview_worker_m4_1`), and Test Writers/Auditors  
> **Timestamp**: 2026-09-19T14:50:50Z  

---

## 1. Observation

Direct code, architectural, and environment observations gathered from authoritative specification sources, existing implementations, and tests:

1. **Authoritative Requirements in `ORIGINAL_REQUEST.md`**:
   - Section R2 (lines 21–23):
     > "Financial Management Features: Implement the core modules: Dashboard (metrics and activity log), Accounts/Customers, Invoices (with real-time automatic calculations and keyboard navigation), Payments (partial and full), and generated Statements."
   - Functional Verification AC 4 & AC 5 (lines 35–37, 74–76):
     > "Creating an invoice correctly updates the customer's 'Outstanding Amount' instantly."
     > "Recording a full payment on an invoice changes its status to 'Paid' and reflects in the Activity Log."
     > "Data can be written and read when the network connection is disabled (verifying Firebase offline persistence)."

2. **Project Architecture & Feature Definitions in `PROJECT.md`**:
   - `F-PAY-01` (Record Full Payment, line 103):
     > "Record payment equal to amountDue; marks invoice Paid, clears balance"
   - `F-PAY-02` (Record Partial Payment, line 104):
     > "Record payment less than amountDue; marks invoice Partially Paid, updates balance"
   - `F-PAY-03` (Multi-Method Payment Logging, line 105):
     > "Logs payment method (Cash, Bank Transfer, Card, Check) and reference number"
   - `F-INV-05` (Invoice Status Auto-Transition, line 101):
     > "Automatic transition: Draft -> Unpaid -> Partially Paid -> Paid / Overdue"
   - Atomic multi-document mutations requirement (lines 58–66):
     > "Recording payment: saves Payment doc + adjusts Invoice amountPaid / amountDue / status + decrements Customer outstandingAmount + writes Activity Log entry."
     > "batch.commit() resolves against local IndexedDB cache instantly without network latency."

3. **Test Invariants & Boundary Rules in `TEST_INFRA.md`**:
   - `T1-PAY-01-01` to `T1-PAY-01-05` (lines 345–351):
     - Payment modal pre-fills amount input with exact `amountDue`.
     - Invoice `amountPaid` updates to cumulative paid sum; `amountDue` updates to `0.00`.
     - Invoice status badge flips to `"Paid"` (`PAID`).
     - Customer `outstandingAmount` decrements by full payment amount.
   - `T1-PAY-02-01` to `T1-PAY-02-05` (lines 352–358):
     - Partial payment ($0 < \text{payment} < \text{amountDue}$) records payment record, updates `amountPaid` and `amountDue`.
     - Invoice status badge flips to `"Partially Paid"` (`PARTIALLY_PAID`).
     - Customer `outstandingAmount` decrements by exact payment amount.
   - `T2-PAY-01-01` (line 587):
     - Overpayment guard: "Attempt to record payment greater than amountDue ($150 on $100 due); verify validation blocks submit: 'Payment cannot exceed amount due'."
   - `T2-PAY-02-01` to `T2-PAY-02-02` (lines 594–596):
     - Payment $\le 0.00$: "Attempt to record partial payment of $0.00; verify validation rejects: 'Amount must be greater than 0.00'."
     - Negative payment: rejected.
   - `T2-INV-05-01` to `T2-INV-05-05` (lines 572–578):
     - `amountDue - 0.01` (1 cent underpayment) leaves status strictly `PARTIALLY_PAID`, not `PAID`.
     - Settling 1 cent payment flips status from `PARTIALLY_PAID` to `PAID`.
     - Attempt to record payment on `CANCELLED` invoice: blocked with error.
     - Attempt to record payment on `PAID` invoice: action disabled/blocked.
     - Invoice overdue by 1 day, then full payment recorded: status changes to `PAID`, clearing overdue flag.
   - `T1-DASH-04-05` (line 295):
     - "Record partial payment on an overdue invoice; verify it remains counted as overdue until fully settled."

4. **Existing Codebase & Types Observation**:
   - `src/types/domain.ts` (lines 1–2, 56–69):
     - `export type InvoiceStatus = 'DRAFT' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';`
     - `export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CREDIT_CARD' | 'CHECK' | 'ONLINE_GATEWAY' | 'OTHER';`
     - `Payment` interface defines: `id`, `paymentNumber`, `invoiceId`, `invoiceNumber`, `customerId`, `customerName`, `amount`, `paymentDate`, `paymentMethod`, `referenceNumber?`, `notes?`, `createdAt`.
   - `src/lib/calculations.ts` (lines 134–164):
     - `determineInvoiceStatus(grandTotal, amountPaid, dueDate?, isDraft?, referenceDate?)` encapsulates the authoritative status transition rules:
       - `isDraft === true` $\to$ `'DRAFT'`
       - `grandTotal === 0 || amountPaid >= grandTotal` $\to$ `'PAID'`
       - `dueDate && dueDate < today` $\to$ `'OVERDUE'` (even if partially paid!)
       - `amountPaid > 0` $\to$ `'PARTIALLY_PAID'`
       - Default $\to$ `'UNPAID'`
   - `src/lib/atomicMutations.ts` (`recordPaymentAtomic`):
     - Executes `writeBatch` across `payments`, `invoices`, `customers`, and `activity_logs`.
     - Defect observed in current draft: `currentInvoice` parameter did not specify `dueDate?: string`, and did not invoke `determineInvoiceStatus` (hardcoded `newAmountDue <= 0.0001 ? 'PAID' : 'PARTIALLY_PAID'`). Furthermore, overpayment and status validation guards (`CANCELLED`, `PAID`) were incomplete in initial implementation.
   - `src/hooks/useDashboardMetrics.ts` (lines 109–115):
     - Dynamically evaluates overdue invoices:
       ```typescript
       const isOverdue = inv.status === 'OVERDUE' || (Boolean(inv.dueDate) && inv.dueDate < today && amountDue > 0 && inv.status !== 'PAID');
       ```
   - UI Architecture:
     - `src/components/common/CompactCard.tsx` and `CompactMetricCard.tsx`:
       - Metric cards strictly `<90px` height (`h-[82px]`).
       - User Global Rule enforces:
         > "Always prioritize mobile-first design... Use compact card designs by default. Cards should occupy less vertical space, make efficient use of available width, and always remain fully contained within the intended mobile and responsive layout boundaries."

---

## 2. Logic Chain

1. **Atomic WriteBatch Invariance**:
   - Firestore transactions (`runTransaction`) are network-dependent and fail immediately when offline.
   - All balance updates involving multiple documents (Payment creation, Invoice balance adjustments, Customer balance decrements, Activity Log generation) MUST execute inside a single `writeBatch()`.
   - `writeBatch()` writes synchronously to IndexedDB locally (`0ms` UI latency), triggering `onSnapshot` listeners with `hasPendingWrites: true`, and automatically synchronizes to Cloud Firestore in the background when connectivity is available.

2. **Customer Balance Reconciliation & Conservation Law**:
   - For every customer, the `outstandingAmount` is a derived financial invariant:
     $$\text{Customer.outstandingAmount} \equiv \sum_{\substack{\text{inv} \in \text{Invoices}, \\ \text{inv.status} \notin \{\text{CANCELLED}, \text{DRAFT}\}}} \text{inv.amountDue}$$
   - When an invoice is created, `Customer.outstandingAmount` increments by `initialAmountDue` and `Customer.totalInvoiced` increments by `grandTotal`.
   - When a payment of amount $P$ is recorded against an invoice:
     - $\text{Invoice.amountPaid} \mathrel{+}= P$
     - $\text{Invoice.amountDue} \mathrel{-}= P$
     - $\text{Customer.outstandingAmount} \mathrel{-}= P$
     - $\text{Customer.totalPaid} \mathrel{+}= P$
   - Because both $\text{Invoice.amountDue}$ and $\text{Customer.outstandingAmount}$ are decremented by the identical amount $P$ in the same atomic batch, the balance reconciliation invariant is mathematically preserved across all states.

3. **Status Transition Logic Chain & Overdue Hierarchy**:
   - **Precedence 1 (Draft)**: If an invoice is flagged as `isDraft`, it remains `DRAFT`. Drafts do not increment receivables.
   - **Precedence 2 (Paid / Settled)**: If `grandTotal === 0` (100% discount) or `amountPaid >= grandTotal - 0.0001`, the invoice is `PAID`. A fully settled invoice is NEVER overdue, even if `dueDate < today`.
   - **Precedence 3 (Overdue)**: If an invoice is not draft and not fully paid, and `dueDate < today`, the invoice status is `OVERDUE`.
     - *Crucial Rule (T1-DASH-04-05)*: If an overdue invoice receives a partial payment ($P < \text{amountDue}$), it remains `OVERDUE` until the remaining balance is fully settled ($0.00$).
   - **Precedence 4 (Partially Paid)**: If an invoice has $0 < \text{amountPaid} < \text{grandTotal}$ and `dueDate >= today` (or no due date), status is `PARTIALLY_PAID`.
   - **Precedence 5 (Unpaid)**: If `amountPaid === 0` and `dueDate >= today` (or no due date), status is `UNPAID`.
   - **Terminal / Administrative State (Cancelled)**: An invoice marked `CANCELLED` has `amountDue = 0` and is completely locked against any new payment attempts.

4. **Fail-Fast Validation Before Mutation**:
   - To guarantee data integrity, `recordPaymentAtomic` must execute 4 strict precondition checks before creating the batch:
     1. $P \le 0$: Reject with `"Payment amount must be greater than 0.00"`.
     2. $P > \text{currentInvoice.amountDue} + 0.0001$: Reject with `"Payment cannot exceed amount due"`.
     3. $\text{status} === \text{'CANCELLED'}$: Reject with `"Cannot record payment on a cancelled invoice"`.
     4. $\text{status} === \text{'PAID'} \lor \text{amountDue} \le 0.0001$: Reject with `"Invoice is already fully paid"`.

5. **UI & Mobile-First Constraints**:
   - Per User Global Rules, mobile views (<640px) require compact cards with less vertical space.
   - In `PaymentList.tsx`, mobile card items must have a height `<90px` (or maximum `<110px`), with dense 2-row layout:
     - Row 1: Payment #, Date, Status pill.
     - Row 2: Customer name, Invoice reference, Payment method badge, and Bidi-isolated amount.
   - In `PaymentModal.tsx`, the dialog must behave as an accessible bottom sheet on mobile devices and a centered modal on desktop, featuring one-click quick-fill buttons (`100% Full` and `50% Half`) and instant validation feedback.

---

## 3. Caveats

1. **Invoice Due Date Parameter in Atomic Mutation**:
   - In initial drafts of `src/lib/atomicMutations.ts`, `currentInvoice` did not include `dueDate`. Without `dueDate`, `recordPaymentAtomic` cannot evaluate whether a partially paid invoice is overdue. The implementation must ensure `dueDate?: string` is part of `RecordPaymentAtomicParams.currentInvoice` and that `determineInvoiceStatus` is invoked.
2. **Dynamic Overdue Transition vs Persistent Document Status**:
   - Because Firestore documents are static until updated, an invoice whose due date passes while the application is idle does not automatically rewrite its document in Firestore at midnight. Therefore, UI components (`InvoiceList`, `InvoiceDetail`, `DashboardMetrics`) must continue to apply dynamic overdue evaluation (`inv.dueDate < today && inv.amountDue > 0 && inv.status !== 'PAID'`) when rendering, while `recordPaymentAtomic` writes the evaluated status upon any payment event.
3. **Overpayment & Customer Credit Policy**:
   - Business accounting sometimes permits "customer credit" for overpayments. However, authoritative test specifications (`TEST_INFRA.md T2-PAY-01-01`) strictly mandate: `"Payment cannot exceed amount due"`. Overpayments are explicitly forbidden in this application.
4. **Offline Payment Number Generation**:
   - To avoid collisions when creating payments offline, payment numbers should follow a structured format: `PAY-YYYY-XXXX` based on timestamp or local counter, or fall back to an indexed counter with UUID suffix if necessary.

---

## 4. Conclusion & Authoritative Specifications

### Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Payments | Record Full Payment (`F-PAY-01`) | Records payment equal to `amountDue`, sets invoice `status = PAID`, clears `amountDue = 0.00`, decrements customer `outstandingAmount` | `invoiceId`, `amount = amountDue`, `paymentMethod`, `paymentDate`, `referenceNumber?`, `notes?` | Payment doc, updated Invoice (`PAID`, `amountDue: 0`), updated Customer, ActivityLog | Rejects if amount != amountDue or invoice cancelled/paid | `ORIGINAL_REQUEST §R2`, `PROJECT.md`, `TEST_INFRA AC 5` |
| 2 | Payments | Record Partial Payment (`F-PAY-02`) | Records payment less than `amountDue`, sets invoice `status = PARTIALLY_PAID` (or `OVERDUE` if past due), updates balances | `invoiceId`, `0 < amount < amountDue`, `paymentMethod`, `paymentDate` | Payment doc, updated Invoice (`PARTIALLY_PAID`/`OVERDUE`), updated Customer, ActivityLog | Rejects if amount <= 0 or amount > amountDue | `PROJECT.md §F-PAY-02`, `TEST_INFRA T1-PAY-02` |
| 3 | Payments | Multi-Method Payment Logging (`F-PAY-03`) | Logs payment across 6 standard payment methods with optional reference and notes | `PaymentMethod` (`CASH`, `BANK_TRANSFER`, `CREDIT_CARD`, `CHECK`, `ONLINE_GATEWAY`, `OTHER`), `referenceNumber`, `notes` | Persisted payment record with method metadata | Defaults to `CASH` if omitted | `PROJECT.md §F-PAY-03`, `TEST_INFRA T1-PAY-03` |
| 4 | Payments | Overpayment Prevention Guard | Enforces payment amount cannot exceed current invoice `amountDue` | `paymentAmount > amountDue` | Throws validation error; blocks submission | Displays inline error: `"Payment cannot exceed amount due"` | `TEST_INFRA T2-PAY-01-01` |
| 5 | Payments | Non-Positive Amount Guard | Rejects payment amounts less than or equal to 0.00 | `paymentAmount <= 0` | Throws validation error; blocks submission | Displays inline error: `"Payment amount must be greater than 0.00"` | `TEST_INFRA T2-PAY-02-01`, `T2-PAY-02-02` |
| 6 | Payments | Fractional Cent Precision Rounding | Sanitizes payment amount to 2 decimal places using symmetric round half-up | Fractional amount (e.g. `25.555`) | Normalized amount (`25.56`) | Prevents IEEE-754 mantissa drift | `TEST_INFRA T2-PAY-02-05`, `calculations.ts` |
| 7 | Payments | Atomic Offline writeBatch | Bundles Payment doc creation, Invoice doc update, Customer balance adjustment, and ActivityLog into a single `writeBatch()` | Batch mutation parameters | Atomic IndexedDB commit with 0ms UI delay | Guaranteed offline persistence | `ORIGINAL_REQUEST §R3`, `PROJECT.md §Data Flow` |
| 8 | Status | Invoice Status Auto-Transition (`F-INV-05`) | Dynamic and persisted status state machine: `DRAFT -> UNPAID -> PARTIALLY_PAID -> PAID / OVERDUE` | `grandTotal`, `amountPaid`, `dueDate`, `isDraft`, `today` | `InvoiceStatus` enum | Enforces invalid state blocking | `PROJECT.md §F-INV-05`, `calculations.ts` |
| 9 | Status | Overdue Partial Payment Retention | Retains status as `OVERDUE` if partial payment is made on an invoice whose due date has passed | `dueDate < today`, `amountPaid < grandTotal` | Status remains `OVERDUE` | Status does not prematurely revert to `PARTIALLY_PAID` | `TEST_INFRA T1-DASH-04-05`, `calculations.ts` |
| 10 | Status | Overdue Settlement Transition | Transitions status from `OVERDUE` to `PAID` when final settling payment clears balance | `amountPaid >= grandTotal`, `dueDate < today` | Status transitions to `PAID`, clears overdue count | Overdue flag is cleared | `TEST_INFRA T2-INV-05-05` |
| 11 | Status | Cancelled Invoice Lockdown | Disallows any payment recording or balance mutation on cancelled invoices | Attempt payment on `CANCELLED` invoice | Rejects mutation | Throws `"Cannot record payment on a cancelled invoice"` | `TEST_INFRA T2-INV-05-03` |
| 12 | Status | Fully Paid Invoice Lockdown | Disallows further payment recording when invoice `amountDue <= 0.0001` | Attempt payment on `PAID` invoice | Rejects mutation | Throws `"Invoice is already fully paid"`; disables button | `TEST_INFRA T2-INV-05-04` |
| 13 | Customers | Customer Balance Synchronization (`F-CUST-03`) | Decrements Customer `outstandingAmount` and increments `totalPaid` by payment amount | `paymentAmount`, `customerId` | Synchronized Customer document | Atomic with payment record | `ORIGINAL_REQUEST AC 4`, `PROJECT.md §F-CUST-03` |
| 14 | Dashboard | Activity Log Reflection (`F-DASH-05`) | Appends `PAYMENT_RECORDED` event to activity feed with payment details | `Payment` details | Chronological Activity Log document | Log entry created in same writeBatch | `ORIGINAL_REQUEST AC 5`, `TEST_INFRA T1-DASH-05-03` |
| 15 | UI | Payment Modal Dialog (`PaymentModal`) | Mobile bottom sheet / desktop dialog with auto-filled balance, quick-fill buttons (100%, 50%), method selector, validation | Selected invoice, initial amount | Form submission, modal dismiss | Inline red validation banners | User Global Rules, `TEST_INFRA T1-PAY-01` |
| 16 | UI | Payment Ledger & Search View (`PaymentList`) | Chronological payments ledger with compact cards (<90px height) on mobile, dense table on desktop, search & method filtering | Query string, method filter, date range | Filtered payment list, KPI summary cards | Clean empty state if 0 results | User Global Rules, `PROJECT.md §Code Layout` |
| 17 | UI | Dynamic Overdue Recalculation | Evaluates overdue condition at render time based on current client date | `invoice.dueDate`, `invoice.amountDue`, `today` | Display badge: `OVERDUE` with rose/red styling | Prevents stale UI display across midnight | `useDashboardMetrics.ts`, `calculations.ts` |

---

### Edge Cases

| # | Feature | Input | Observed / Required Behavior |
|---|---------|-------|------------------------------|
| 1 | Overpayment | `paymentAmount = 150.00`, `amountDue = 100.00` | Block form submission; display inline error: `"Payment cannot exceed amount due"`. Throw error in `recordPaymentAtomic`. Prevent negative receivables. |
| 2 | Zero Payment | `paymentAmount = 0.00` | Form validation rejects; displays: `"Payment amount must be greater than 0.00"`. Service throws error. |
| 3 | Negative Payment | `paymentAmount = -50.00` | Rejected immediately by validation; displays: `"Payment amount must be greater than 0.00"`. |
| 4 | Exact 1 Cent Underpayment | `paymentAmount = grandTotal - 0.01` | Invoice status remains strictly `PARTIALLY_PAID` (or `OVERDUE` if past due), `amountDue = 0.01`. Does NOT transition to `PAID`. |
| 5 | Final 1 Cent Settlement | `paymentAmount = 0.01` on invoice with `amountDue = 0.01` | Status transitions from `PARTIALLY_PAID` or `OVERDUE` to `PAID`, `amountDue = 0.00`, customer balance clears to `0.00`. |
| 6 | Payment on Cancelled Invoice | User attempts to open payment modal on `CANCELLED` invoice | Payment button disabled; service throws `"Cannot record payment on a cancelled invoice"`. |
| 7 | Payment on Paid Invoice | User attempts to pay invoice where `amountDue <= 0.0001` | "Record Payment" button hidden or disabled; service throws `"Invoice is already fully paid"`. |
| 8 | Multiple Installment Payments | 10 payments of `$10.00` on `$100.00` invoice | Status transitions: `UNPAID` $\to$ `PARTIALLY_PAID` on 1st payment; remains `PARTIALLY_PAID` for payments 2–9; transitions to `PAID` on 10th payment. |
| 9 | Partial Payment on Overdue Invoice | `dueDate = yesterday`, `amountDue = 100.00`, `paymentAmount = 40.00` | Invoice status remains `OVERDUE` (amountDue = 60.00). Dashboard overdue invoices count remains unchanged. |
| 10 | Full Payment on Overdue Invoice | `dueDate = yesterday`, `amountDue = 100.00`, `paymentAmount = 100.00` | Invoice status transitions to `PAID`. Overdue invoices counter decrements by 1 immediately. |
| 11 | Zero-Total Invoice Creation | Line items with 100% discount resulting in `grandTotal = 0.00` | Invoice automatically initializes with status `PAID` and `amountDue = 0.00`. Payment action disabled. |
| 12 | Offline Payment Recording | Disconnect network (`disableNetwork`); submit payment | `writeBatch` commits instantly to IndexedDB; UI updates immediately (`0ms` delay); `hasPendingWrites: true` shown in sync indicator. |
| 13 | Rapid Double-Click Submit | User double-clicks "Confirm Payment" within 100ms | Submit button disables immediately (`isSubmitting: true`); exactly 1 payment document and 1 activity log entry created. |
| 14 | Fractional Cent Rounding | Payment input `25.555` | Clamped and rounded half-up via `roundFinancial(25.555, 2)` to `25.56` prior to mutation. |
| 15 | Special Characters & XSS in Reference / Notes | Reference: `<script>alert(1)</script>`, Arabic text: `"دفعة نقدية #1044"` | UTF-8 characters preserved intact; rendered safely via React DOM escaping without XSS vulnerability. |
| 16 | Midnight Transition Overdue Display | App stays open past 00:00:00 UTC/local time | Reactive status check (`dueDate < today && amountDue > 0`) dynamically flips status badge to `OVERDUE` without database rewrite. |
| 17 | Customer Balance Conservation | Initial customer balance $500, pay $200 on Inv 1, pay $300 on Inv 2 | Customer `outstandingAmount` decreases to $300 then $0.00; `totalPaid` increases by $200 then $300; sum of invoice `amountDue` exactly equals 0. |

---

### Detailed Behavioral & Interface Contracts

#### 1. Payment Domain Model (`src/types/domain.ts`)
```typescript
export type PaymentMethod = 
  | 'CASH' 
  | 'BANK_TRANSFER' 
  | 'CREDIT_CARD' 
  | 'CHECK' 
  | 'ONLINE_GATEWAY' 
  | 'OTHER';

export interface Payment {
  id: string;
  paymentNumber: string;       // Formatted identifier, e.g. "PAY-2026-0001"
  invoiceId: string;           // Target Invoice document ID
  invoiceNumber: string;       // Target Invoice human number, e.g. "INV-2026-0001"
  customerId: string;          // Target Customer document ID
  customerName: string;        // Denormalized customer display name
  amount: number;              // Paid amount (> 0, strictly <= amountDue, 2 decimals)
  paymentDate: string;         // ISO date format "YYYY-MM-DD"
  paymentMethod: PaymentMethod;// Selected method
  referenceNumber?: string;   // Optional transaction reference, check #, auth code (max 100 chars)
  notes?: string;              // Optional transaction notes (max 500 chars)
  createdAt: string;           // ISO timestamp "YYYY-MM-DDTHH:mm:ss.sssZ"
}
```

#### 2. Atomic Payment Mutation (`src/lib/atomicMutations.ts`)
```typescript
export interface RecordPaymentAtomicParams {
  payment: Omit<Payment, 'id' | 'createdAt'> & { id?: string };
  currentInvoice: {
    id: string;
    invoiceNumber: string;
    grandTotal: number;
    amountPaid: number;
    amountDue: number;
    status: InvoiceStatus;
    customerId: string;
    customerName: string;
    dueDate?: string; // Required for accurate overdue state calculation
  };
  customLogMessage?: string;
}

export interface RecordPaymentAtomicResult {
  paymentId: string;
  activityLogId: string;
  newInvoiceStatus: InvoiceStatus;
  newAmountDue: number;
  newAmountPaid: number;
}
```

**Precondition Assertions & Mutation Sequence**:
```typescript
export async function recordPaymentAtomic(
  params: RecordPaymentAtomicParams,
  firestore: Firestore = db
): Promise<RecordPaymentAtomicResult> {
  const { payment: inputPayment, currentInvoice, customLogMessage } = params;

  const paymentAmount = roundFinancial(Number(inputPayment.amount), 2);

  // Precondition 1: Positive Amount
  if (paymentAmount <= 0) {
    throw new Error('Payment amount must be greater than 0');
  }

  // Precondition 2: Non-cancelled invoice
  if (currentInvoice.status === 'CANCELLED') {
    throw new Error('Cannot record payment on a cancelled invoice');
  }

  // Precondition 3: Non-paid invoice
  if (currentInvoice.status === 'PAID' || currentInvoice.amountDue <= 0.0001) {
    throw new Error('Invoice is already fully paid');
  }

  // Precondition 4: Overpayment prevention (epsilon-tolerant)
  if (paymentAmount > currentInvoice.amountDue + 0.0001) {
    throw new Error('Payment cannot exceed amount due');
  }

  const batch = writeBatch(firestore);
  const now = new Date().toISOString();

  const paymentRef = inputPayment.id
    ? doc(firestore, 'payments', inputPayment.id)
    : doc(collection(firestore, 'payments'));
  const paymentId = paymentRef.id;

  const activityLogRef = doc(collection(firestore, 'activity_logs'));
  const activityLogId = activityLogRef.id;

  // Compute new balances and status via authoritative status machine
  const currentPaid = Number(currentInvoice.amountPaid) || 0;
  const newAmountPaid = roundFinancial(currentPaid + paymentAmount);
  const newAmountDue = Math.max(0, roundFinancial(currentInvoice.grandTotal - newAmountPaid));
  
  // Use authoritative status transition resolver
  const newInvoiceStatus: InvoiceStatus = determineInvoiceStatus(
    currentInvoice.grandTotal,
    newAmountPaid,
    currentInvoice.dueDate,
    false
  );

  const fullPayment: Payment = {
    ...inputPayment,
    id: paymentId,
    amount: paymentAmount,
    createdAt: now
  };

  // Operation 1: Save Payment Document
  batch.set(paymentRef, fullPayment);

  // Operation 2: Update Invoice Document
  const invoiceRef = doc(firestore, 'invoices', currentInvoice.id);
  batch.update(invoiceRef, {
    amountPaid: increment(paymentAmount),
    amountDue: increment(-paymentAmount),
    status: newInvoiceStatus,
    updatedAt: now
  });

  // Operation 3: Update Customer Document (decrement balance, increment total paid)
  const customerRef = doc(firestore, 'customers', currentInvoice.customerId);
  batch.update(customerRef, {
    outstandingAmount: increment(-paymentAmount),
    totalPaid: increment(paymentAmount),
    updatedAt: now
  });

  // Operation 4: Record Activity Log Entry
  const activityLog: ActivityLog = {
    id: activityLogId,
    timestamp: now,
    eventType: 'PAYMENT_RECORDED',
    entityType: 'PAYMENT',
    entityId: paymentId,
    description:
      customLogMessage ||
      `Recorded payment of ${paymentAmount.toFixed(2)} for Invoice #${currentInvoice.invoiceNumber} (${currentInvoice.customerName})`,
    metadata: {
      paymentNumber: fullPayment.paymentNumber,
      invoiceId: currentInvoice.id,
      invoiceNumber: currentInvoice.invoiceNumber,
      customerId: currentInvoice.customerId,
      customerName: currentInvoice.customerName,
      amount: paymentAmount,
      paymentMethod: fullPayment.paymentMethod,
      referenceNumber: fullPayment.referenceNumber || null,
      newInvoiceStatus,
      newAmountDue
    }
  };
  batch.set(activityLogRef, activityLog);

  // Commit atomically to IndexedDB local cache
  await batch.commit();

  return {
    paymentId,
    activityLogId,
    newInvoiceStatus,
    newAmountDue,
    newAmountPaid
  };
}
```

---

#### 3. State Transition Matrix (`InvoiceStatus`)

```
                  ┌──────────────────────────────────────────────┐
                  │                 DRAFT                        │
                  └──────┬───────────────────────┬───────────────┘
                         │ Finalize / Save       │ Finalize / Save
                         │ (dueDate >= today)    │ (dueDate < today)
                         v                       v
               ┌──────────────────┐    ┌──────────────────┐
               │     UNPAID       │    │     OVERDUE      │
               └─────────┬────────┘    └────────┬─────────┘
                         │                      │
       Partial Payment   │                      │ Partial Payment
     (0 < pay < due)     │                      │ (0 < pay < due)
                         v                      │
               ┌──────────────────┐             │
               │  PARTIALLY_PAID  │             │
               └─────────┬────────┘             │
                         │                      │
                         │ Full Settlement      │ Full Settlement
                         │ (pay == due)         │ (pay == due)
                         v                      v
                  ┌──────────────────────────────────────────────┐
                  │                  PAID                        │
                  └──────────────────────────────────────────────┘
```

| Source State | Trigger / Event | Conditions | Target State | `amountPaid` | `amountDue` | Customer Balance Effect |
|---|---|---|---|---|---|---|
| `*` | Save as Draft | `isDraft === true` | `DRAFT` | 0 | 0 | None (0) |
| `DRAFT` | Save & Issue | `grandTotal > 0`, `dueDate >= today` | `UNPAID` | 0 | `grandTotal` | $+ \text{grandTotal}$ |
| `DRAFT` | Save & Issue | `grandTotal > 0`, `dueDate < today` | `OVERDUE` | 0 | `grandTotal` | $+ \text{grandTotal}$ |
| `DRAFT` | Save & Issue | `grandTotal === 0` (100% discount) | `PAID` | 0 | 0 | None (0) |
| `UNPAID` | Midnight crosses | `dueDate < today && amountDue > 0` | `OVERDUE` | 0 | `grandTotal` | Unchanged |
| `UNPAID` | Partial Payment | $0 < P < \text{amountDue}$, `dueDate >= today` | `PARTIALLY_PAID` | $+ P$ | $- P$ | $- P$ |
| `UNPAID` | Partial Payment | $0 < P < \text{amountDue}$, `dueDate < today` | `OVERDUE` | $+ P$ | $- P$ | $- P$ |
| `UNPAID` | Full Payment | $P === \text{amountDue}$ | `PAID` | $\text{grandTotal}$ | 0 | $- \text{amountDue}$ |
| `PARTIALLY_PAID` | Midnight crosses | `dueDate < today && amountDue > 0` | `OVERDUE` | Unchanged | Unchanged | Unchanged |
| `PARTIALLY_PAID` | Installment | $0 < P < \text{amountDue}$, `dueDate >= today` | `PARTIALLY_PAID` | $+ P$ | $- P$ | $- P$ |
| `PARTIALLY_PAID` | Installment | $0 < P < \text{amountDue}$, `dueDate < today` | `OVERDUE` | $+ P$ | $- P$ | $- P$ |
| `PARTIALLY_PAID` | Settlement | $P === \text{amountDue}$ | `PAID` | $\text{grandTotal}$ | 0 | $- \text{amountDue}$ |
| `OVERDUE` | Installment | $0 < P < \text{amountDue}$ | `OVERDUE` | $+ P$ | $- P$ | $- P$ |
| `OVERDUE` | Full Settlement | $P === \text{amountDue}$ | `PAID` | $\text{grandTotal}$ | 0 | $- \text{amountDue}$ |
| `PAID` | Record Payment | Any | **BLOCKED** | N/A | N/A | Button disabled |
| `UNPAID` / `PARTIALLY_PAID` / `OVERDUE` | Cancel Invoice | Admin Action | `CANCELLED` | Unchanged | 0 | $- \text{amountDue}$ |
| `CANCELLED` | Record Payment | Any | **BLOCKED** | N/A | N/A | Throws Error |

---

#### 4. UI Architecture & Specifications

##### A. `PaymentModal.tsx` (`src/components/modules/payments/PaymentModal.tsx`)
- **Container**:
  - Responsive dialog: Mobile bottom sheet (`fixed inset-x-0 bottom-0 max-h-[92vh] sm:relative sm:inset-auto sm:max-w-md w-full p-4 sm:p-5`).
  - Accessibility: `role="dialog"`, `aria-modal="true"`, `aria-labelledby="payment-modal-title"`.
  - Keyboard: `Esc` closes modal; autofocus first interactive input.
- **Invoice Overview Badge**:
  - Compact container displaying:
    - Invoice Number (e.g. `#INV-2026-0001`)
    - Customer Name (with text truncation)
    - Total Amount Due in bold with currency isolation (`<BidiIsolate>`)
    - Status pill indicating current status (`Unpaid`, `Partially Paid`, `Overdue`).
- **Amount Input & Quick Fill**:
  - Number input (`step="0.01"`, `min="0.01"`).
  - Defaults to current `invoice.amountDue`.
  - Quick-fill pill buttons:
    - `"100% Full"`: sets amount to `invoice.amountDue`.
    - `"50% Half"`: sets amount to `roundFinancial(invoice.amountDue / 2)`.
  - Inline error text appears dynamically if `amount > amountDue` or `amount <= 0`.
- **Payment Method Selector**:
  - 6-grid selection:
    1. `CASH` — Cash
    2. `BANK_TRANSFER` — Bank Transfer
    3. `CREDIT_CARD` — Credit Card
    4. `CHECK` — Check
    5. `ONLINE_GATEWAY` — Online Gateway
    6. `OTHER` — Other
  - Styled as compact radio buttons/pills with icons (`Banknote`, `Building`, `CreditCard`, `FileText`, `Globe`, `MoreHorizontal`).
- **Date & Reference Fields**:
  - Payment Date: Input `type="date"`, defaults to current ISO date (`new Date().toISOString().split('T')[0]`).
  - Reference Number: Optional text input with placeholder (`"e.g. TR-98231, Chk #401"`). Max length 100.
  - Notes: Optional compact textarea (max 2 rows). Max length 500.
- **Submission & Debounce**:
  - Primary button: "Confirm Payment" / "تأكيد الدفعة".
  - Disables immediately on click (`isSubmitting: true`) showing spinner to eliminate double-submits.
  - Invokes `recordPaymentAtomic`, closes modal, triggers parent reload or toast.

##### B. `PaymentList.tsx` (`src/components/modules/payments/PaymentList.tsx`)
- **Route**: Rendered at `/payments` in `App.tsx`.
- **Header & Metric Grid**:
  - Uses `CompactMetricCard` (<90px height, `h-[82px]`):
    - `Total Collected` (Total sum of all recorded payments).
    - `Total Payments` (Count of payment receipts).
    - `Bank Transfer Ratio` / `Cash Ratio` (Breakdown of primary methods).
- **Search & Filter Toolbar**:
  - Search input: Live filtering across `paymentNumber`, `invoiceNumber`, `customerName`, and `referenceNumber`.
  - Method filter pills: `All`, `Cash`, `Bank Transfer`, `Credit Card`, `Check`, `Online`, `Other`.
  - Date Range pickers (`From`, `To`).
  - "Reset Filters" action.
- **Responsive Layout**:
  - **Mobile (< md, 375px - 767px)**:
    - Compact Cards list: **each card strictly <90px height**!
    - Layout:
      - Line 1: `Payment #` (`PAY-2026-0001`) + Date (`2026-09-19`) [flex between].
      - Line 2: `Customer Name` (truncate) + Invoice # badge (`#INV-001`).
      - Line 3: Method pill (`Bank Transfer`) + Reference (if exists) + Amount in bold (`BidiIsolate`).
      - Height: `h-[84px]`, padding `p-2.5`, overflow hidden, zero horizontal scroll blowout.
  - **Desktop (md+)**:
    - High-density data table:
      - Columns: Date | Payment # | Customer | Invoice # | Method | Reference # | Amount | Actions.
      - Action: View receipt details / Print receipt.
- **Empty State**:
  - Clean, compact empty state when 0 payments match filters with a "Clear Filters" button.

##### C. `usePayments.ts` Hook Contract (`src/hooks/usePayments.ts`)
```typescript
export interface UsePaymentsResult {
  payments: Payment[];
  loading: boolean;
  error: Error | null;
  recordPayment: (params: RecordPaymentAtomicParams) => Promise<RecordPaymentAtomicResult>;
  getPaymentsForInvoice: (invoiceId: string) => Payment[];
  getPaymentsForCustomer: (customerId: string) => Payment[];
  metrics: {
    totalCollected: number;
    paymentCount: number;
    methodBreakdown: Record<PaymentMethod, number>;
  };
}
```

---

## 5. Verification Method

To independently verify the implementation against authoritative specifications:

1. **Vitest Unit & Mutation Test Command**:
   Execute targeted tests for atomic mutations and calculations:
   ```bash
   npx vitest run tests/unit/atomicMutations.test.ts
   npx vitest run tests/unit/calculations.test.ts
   npx vitest run tests/unit/customerLedger.stress.test.ts
   ```
   *Expected Result*: 100% pass across all assertions.

2. **Full Unit Test Suite Command**:
   Run all unit tests located under `tests/unit`:
   ```bash
   npx vitest run tests/unit
   ```
   *Expected Result*: All 25 existing test suites pass with 0 failures.

3. **Key Files to Inspect**:
   - `src/lib/atomicMutations.ts` — verify `recordPaymentAtomic` enforces overpayment guard, CANCELLED/PAID status checks, atomic `writeBatch` sequence, and imports `determineInvoiceStatus`.
   - `src/lib/calculations.ts` — verify `determineInvoiceStatus` handles overdue partial payments per `T1-DASH-04-05`.
   - `src/components/modules/payments/PaymentModal.tsx` — inspect mobile bottom sheet layout, quick-fill buttons, method selection, and error banner.
   - `src/components/modules/payments/PaymentList.tsx` — inspect mobile card layout verifying `<90px` height (`h-[84px]`).
   - `src/hooks/usePayments.ts` — inspect reactive subscription with `trackSnapshotPendingWrites`.

4. **Invalidation Conditions**:
   - If `recordPaymentAtomic` permits payment amount $> \text{amountDue}$.
   - If recording a partial payment on an overdue invoice changes status to `PARTIALLY_PAID` instead of retaining `OVERDUE`.
   - If mobile payment cards exceed 90px in height or cause horizontal scrolling blowout on 375px viewports.
   - If payment modal allows rapid multi-clicks or lacks `100% Full` / `50% Half` quick-fill helpers.
   - If customer `outstandingAmount` does not decrement synchronously in local IndexedDB with 0ms delay upon payment submission.
