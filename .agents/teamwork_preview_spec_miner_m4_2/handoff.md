# Milestone 4 Specification & Implementation Guidance: Payments and Statements

> **Document Type**: Specification Miner Handoff Report  
> **Milestone**: Milestone 4 — Payments and Statements of Account  
> **Target Audience**: Implementing Worker Agent (`teamwork_preview_worker_1`) & Orchestrator  
> **Working Directory**: `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_spec_miner_m4_2`  
> **Timestamp**: 2026-09-19T11:47:30Z  

---

## 1. Observation

Direct code and environment observations gathered from authoritative specification sources and the existing codebase:

1. **Authoritative Specification Requirements**:
   - `ORIGINAL_REQUEST.md` lines 21–23, 35–37, 74–76:
     > "R2. Financial Management Features: Implement the core modules: Dashboard (metrics and activity log), Accounts/Customers, Invoices (with real-time automatic calculations and keyboard navigation), Payments (partial and full), and generated Statements."
     > "Creating an invoice correctly updates the customer's 'Outstanding Amount' instantly."
     > "Recording a full payment on an invoice changes its status to 'Paid' and reflects in the Activity Log."
     > "Data can be written and read when the network connection is disabled (verifying Firebase offline persistence)."
   - `PROJECT.md` lines 103–107:
     - `F-PAY-01` (Record Full Payment): Record payment equal to `amountDue`; marks invoice Paid, clears balance.
     - `F-PAY-02` (Record Partial Payment): Record payment less than `amountDue`; marks invoice Partially Paid, updates balance.
     - `F-PAY-03` (Multi-Method Payment Logging): Logs payment method (Cash, Bank Transfer, Card, Check, Online Gateway, Other) and reference number.
     - `F-STMT-01` (Customer Statement Generator): Generates customer ledger with opening balance, debit/credit rows, closing balance.
     - `F-STMT-02` (Statement Export & Print View): Print preview and PDF/CSV export for customer statements and invoices.
   - `TEST_INFRA.md` lines 345–379 (Tier 1 tests), 555–589 (Tier 2 tests), 749–813 (Tier 3 & 4 tests):
     - `T1-PAY-01-01` to `T1-PAY-01-05`: Payment modal defaults amount to `amountDue`; updates invoice `amountPaid` and `amountDue = 0.00`; sets status `PAID`; customer `outstandingAmount -= amount`.
     - `T1-PAY-02-01` to `T1-PAY-02-05`: Partial payment updates `amountPaid`, sets status `PARTIALLY_PAID`, decrements customer `outstandingAmount`.
     - `T2-PAY-01-01`: Overpayment rejection: payment amount cannot exceed `amountDue` (`"Payment cannot exceed amount due"`).
     - `T2-PAY-02-01`, `T2-PAY-02-02`: Zero or negative payment amounts must be rejected (`"Amount must be greater than 0.00"`).
     - `T2-INV-05-03`: Attempt to record payment on a `CANCELLED` invoice must be blocked.
     - `T2-INV-05-04`: Attempt to record payment on an already `PAID` invoice must be disabled/blocked.
     - `T1-STMT-01-01` to `T1-STMT-01-05`: Statement with custom date range; Opening Balance = cumulative net balance before start date; ledger lines with debit (invoices), credit (payments), running balance column; Closing Balance = Opening Balance + Total Invoiced - Total Paid.
     - `T1-STMT-02-01` to `T1-STMT-02-05`: Print layout with clean margins, company branding, no UI buttons; CSV export with RFC 4180 escaping and UTF-8 BOM (`\uFEFF`) for Arabic Excel fidelity.

2. **Existing Implementation Status**:
   - `src/types/domain.ts` lines 1–3, 56–69:
     - `InvoiceStatus = 'DRAFT' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED'`
     - `PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CREDIT_CARD' | 'CHECK' | 'ONLINE_GATEWAY' | 'OTHER'`
     - `Payment` interface is defined (`id`, `paymentNumber`, `invoiceId`, `invoiceNumber`, `customerId`, `customerName`, `amount`, `paymentDate`, `paymentMethod`, `referenceNumber?`, `notes?`, `createdAt`).
     - Statement types (`StatementEntry`, `StatementSummary`, `StatementDateRange`) are currently **missing** from `src/types/domain.ts`.
   - `src/lib/atomicMutations.ts` lines 106–221:
     - `recordPaymentAtomic` is already implemented with Firestore `writeBatch(firestore)`:
       - Sets `payments` doc.
       - Updates `invoices` doc (`amountPaid: increment(paymentAmount)`, `amountDue: increment(-paymentAmount)`, `status: newInvoiceStatus`).
       - Updates `customers` doc (`outstandingAmount: increment(-paymentAmount)`, `totalPaid: increment(paymentAmount)`).
       - Sets `activity_logs` doc (`eventType: 'PAYMENT_RECORDED'`).
     - **Defect observed in current `recordPaymentAtomic`**: Does NOT yet validate overpayment (`paymentAmount > currentInvoice.amountDue`) or invoice status (`CANCELLED` or `PAID`).
   - `src/hooks/useDashboardMetrics.ts` lines 65–147:
     - Reacts dynamically via `onSnapshot` to invoice changes:
       - `totalRevenue`: sum of `amountPaid` for active invoices.
       - `outstandingReceivables`: sum of `amountDue` where `amountDue > 0`.
       - `paidInvoicesCount`: count where `status === 'PAID'` or `amountDue <= 0.0001`.
     - When `recordPaymentAtomic` modifies invoice fields, dashboard metrics update with 0ms delay automatically.
   - `src/hooks/useCustomerLedger.ts` lines 190–298:
     - Implements chronological ledger interleaving and `roundFinancial` running balance for a single customer.
     - Excludes `CANCELLED` and `DRAFT` invoices.
   - `electron/preload.ts` & `electron/ipcHandlers.ts`:
     - Exposes `window.electronAPI.printInvoicePDF` and `window.electronAPI.exportFile` for native PDF print and CSV export with OS save dialogs.
   - Test execution verification:
     - Ran `npm test` synchronously via runner: 25 test files passed, 352 unit/integration tests passed in 9.28s.

---

## 2. Logic Chain

1. **Atomicity and Offline Invariance**:
   - Because Firestore transactions (`runTransaction`) fail completely when disconnected from the cloud, all multi-entity balance mutations (Payment doc creation, Invoice updates, Customer balance decrements, Activity Log entry) MUST execute via `writeBatch`.
   - `writeBatch` commits synchronously to IndexedDB locally, triggering immediate `onSnapshot` events with `hasPendingWrites: true` before queuing for cloud background sync.

2. **Strict Financial Invariants**:
   - **Overpayment Guard**: If an invoice has `amountDue = 100.00`, a payment of `100.01` must be rejected immediately before batch creation. An overpayment would create negative invoice balances and corrupt customer receivables.
   - **Status Transitions**:
     - When `amountPaid >= grandTotal - 0.0001`, status MUST transition to `PAID`.
     - When `amountPaid > 0 && amountPaid < grandTotal - 0.0001`, status MUST transition to `PARTIALLY_PAID`.
     - If all payments against an invoice are voided (`amountPaid === 0`), status returns to `UNPAID` (or `OVERDUE` if `dueDate < today`).
     - Cancelled (`CANCELLED`) invoices must never accept payments.
   - **Balance Reconciliation Invariant**:
     - Customer `outstandingAmount` must always equal the sum of `amountDue` across all non-cancelled, non-draft invoices:
       $$\text{Customer.outstandingAmount} \equiv \sum_{i \in \text{Invoices}} \text{inv}_i.\text{amountDue}$$
     - A payment of $X$ decrements both invoice `amountDue` and customer `outstandingAmount` by exactly $X$, preserving this equality.

3. **Statement of Account Accounting Invariants**:
   - For any date range $[T_{\text{start}}, T_{\text{end}}]$:
     - **Opening Balance** is the cumulative net unpaid balance strictly before $T_{\text{start}}$:
       $$\text{OpeningBalance} = \sum_{\substack{\text{inv} \in \text{Invoices}, \\ \text{inv.issueDate} < T_{\text{start}}, \\ \text{inv.status} \notin \{\text{CANCELLED}, \text{DRAFT}\}}} \text{inv.grandTotal} \;-\; \sum_{\substack{\text{pay} \in \text{Payments}, \\ \text{pay.paymentDate} < T_{\text{start}}}} \text{pay.amount}$$
     - **In-Period Transactions**:
       - Invoices: $T_{\text{start}} \le \text{issueDate} \le T_{\text{end}}$, $\text{Debit} = \text{grandTotal}$, $\text{Credit} = 0$.
       - Payments: $T_{\text{start}} \le \text{paymentDate} \le T_{\text{end}}$, $\text{Debit} = 0$, $\text{Credit} = \text{amount}$.
     - **Running Balance**:
       $$R_0 = \text{OpeningBalance}$$
       $$R_k = R_{k-1} + \text{Debit}_k - \text{Credit}_k \quad (k = 1 \dots N)$$
     - **Closing Balance**:
       $$\text{ClosingBalance} = \text{OpeningBalance} + \sum_{k=1}^N \text{Debit}_k - \sum_{k=1}^N \text{Credit}_k \equiv R_N$$
   - **Date Boundary Safety**:
     - ISO format `YYYY-MM-DD` strings compare cleanly with lexicographical `<` and `<=`.
     - Single-day statements ($T_{\text{start}} = T_{\text{end}}$) must capture all debits and credits on that day.
     - Boundary times ($00:00:00$ through $23:59:59$) are encompassed because comparisons evaluate date strings directly without UTC offset truncation.

4. **Export and Print Determinism**:
   - Excel for Windows defaults to Windows-1252 or ANSI unless a UTF-8 BOM (`\uFEFF`) is present. Without `\uFEFF`, Arabic customer names and currencies become unreadable mojibake.
   - RFC 4180 requires wrapping fields with quotes if they contain commas or quotes, escaping inner quotes as `""`, and terminating rows with `\r\n`.
   - Printing requires CSS isolation: `@media print` must force `@page { size: A4 portrait; margin: 15mm; }`, repeat table headers across pages with `thead { display: table-header-group; }`, prevent split rows with `tr { page-break-inside: avoid; }`, and strip all interactive buttons and navigation.

---

## 3. Caveats

1. **Invoice Cancellation with Prior Payments**:
   - If an invoice is cancelled after partial payments have been recorded, business accounting requires that those payments either remain as customer credit or be explicitly refunded/voided. The Worker should prevent invoice cancellation if `amountPaid > 0` until payments are reconciled.
2. **Electron vs Browser Runtime for Exports**:
   - In desktop mode, `window.electronAPI.exportFile` and `printInvoicePDF` use native OS dialogs. In browser/test mode where `window.electronAPI` is undefined, fallback mechanisms (DOM `window.print()` and HTML5 `Blob` download with `URL.createObjectURL`) must be provided.
3. **Multi-Currency Customers**:
   - Customers have a declared primary currency (e.g. `SAR` or `USD`). Statements should group or warn if an invoice in a mismatched currency is encountered.

---

## 4. Conclusion & Authoritative Specifications

The Worker must implement the Payments and Statements module according to the following complete specifications:

### Features Discovered
| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Payments | Record Full Payment (`F-PAY-01`) | Records payment equal to `amountDue`, marks invoice `PAID`, updates balances | `invoiceId`, `amount = amountDue`, `paymentMethod`, `paymentDate`, `referenceNumber?`, `notes?` | Payment doc, updated Invoice (`status: PAID`, `amountDue: 0`), updated Customer, ActivityLog | Rejects if amount != amountDue or invoice cancelled | `ORIGINAL_REQUEST §R2`, `PROJECT.md`, `TEST_INFRA AC 5` |
| 2 | Payments | Record Partial Payment (`F-PAY-02`) | Records payment less than `amountDue`, marks invoice `PARTIALLY_PAID` | `invoiceId`, `0 < amount < amountDue`, `paymentMethod`, `paymentDate` | Payment doc, updated Invoice (`status: PARTIALLY_PAID`, `amountDue > 0`), updated Customer, ActivityLog | Rejects if amount <= 0 or amount > amountDue | `PROJECT.md §F-PAY-02`, `TEST_INFRA T1-PAY-02` |
| 3 | Payments | Multi-Method Payment Logging (`F-PAY-03`) | Logs payment across Cash, Bank Transfer, Card, Check, Online, Other with references | `PaymentMethod` enum, reference number string | Persisted payment record with method metadata | Defaults to `CASH` if omitted | `PROJECT.md §F-PAY-03`, `TEST_INFRA T1-PAY-03` |
| 4 | Payments | Overpayment Prevention | Validates payment amount does not exceed invoice `amountDue` | `paymentAmount > amountDue` | Throws validation error; blocks submission | Displays inline error `"Payment cannot exceed amount due"` | `TEST_INFRA T2-PAY-01-01` |
| 5 | Payments | Status Machine Invariant | Auto-transitions invoice status based on `amountPaid` vs `grandTotal` | `amountPaid`, `grandTotal` | Status: `PAID` if paid >= total; `PARTIALLY_PAID` if 0 < paid < total | Disallows payment if invoice `CANCELLED` | `PROJECT.md`, `TEST_INFRA T1-INV-05` |
| 6 | Payments | Atomic Offline Batch | Bundles all 4 Firestore mutations into a single `writeBatch` | Mutation batch object | Atomic IndexedDB commit with 0ms UI delay | Guaranteed offline safety | `ORIGINAL_REQUEST §R3`, `PROJECT.md §Data Flow` |
| 7 | Statements | Statement Generator (`F-STMT-01`) | Generates Statement of Account for customer over custom date range | `customerId`, `startDate`, `endDate` | Statement summary object with opening balance, ledger lines, closing balance | Flags error if `startDate > endDate` | `ORIGINAL_REQUEST §R2`, `PROJECT.md §F-STMT-01` |
| 8 | Statements | Opening Balance Calculation | Computes net unpaid balance strictly before `startDate` | Invoices and Payments with date < `startDate` | Accurate 2-decimal scalar opening balance | Excludes `CANCELLED` & `DRAFT` invoices | `TEST_INFRA T1-STMT-01-02` |
| 9 | Statements | Running Balance Interleaving | Interleaves debits and credits chronologically with cumulative running balance | Date-range Invoices and Payments | Ordered transaction array with $R_k = R_{k-1} + \text{debit} - \text{credit}$ | Tie-breaker: Debits before Credits on same date | `TEST_INFRA T1-STMT-01-04`, `useCustomerLedger.ts` |
| 10 | Statements | Statement Export & Print View (`F-STMT-02`) | Print layout and PDF/CSV export for statements | Statement summary data | Printable DOM / PDF file / RFC 4180 CSV file | Handles file dialog cancellation cleanly | `PROJECT.md §F-STMT-02`, `TEST_INFRA T1-STMT-02` |
| 11 | Statements | Excel-Compatible CSV Export | Exports ledger to CSV with RFC 4180 escaping and UTF-8 BOM (`\uFEFF`) | Ledger transactions | Formatted CSV string with `\uFEFF` and CRLF | Escapes quotes and commas | `TEST_INFRA T2-STMT-02-01`, `T3-INT-13` |
| 12 | Statements | Print Preview / PDF Layout | High-contrast white A4 print view hiding UI chrome and repeating headers | Statement DOM element | Styled print view or native Electron PDF | Forces white background even in Dark Mode | `TEST_INFRA T1-STMT-02-05`, `T2-STMT-02-02` |
| 13 | Theming & RTL | Full Arabic RTL & Font Mirroring | Mirrors layout, isolates bidi numbers, applies Cairo/Tajawal fonts | `DirectionContext` ('ar' or 'en') | Mirrored tables, flipped close buttons, isolated numbers | Uses `\u200E` and `BidiIsolate` to prevent sign flip | `PROJECT.md §F-RTL-02`, `F-RTL-03` |
| 14 | Responsive | Mobile Compact Card Views | Compact card layout (<110px per card) on viewports < md (375px) | Viewport width | Responsive compact cards on mobile, tables on desktop | Zero horizontal scroll clipping | `ORIGINAL_REQUEST`, User Global Rules |

---

### Edge Cases
| # | Feature | Input | Observed / Required Behavior |
|---|---------|-------|------------------------------|
| 1 | Overpayment | `paymentAmount = 150.00`, `amountDue = 100.00` | Block submission; display error: `"Payment cannot exceed amount due"`. Prevent negative balance. |
| 2 | Zero / Negative Payment | `paymentAmount = 0.00` or `-25.00` | Form validation rejects; displays: `"Payment amount must be greater than 0.00"`. |
| 3 | Exact 1 Cent Underpayment | `paymentAmount = grandTotal - 0.01` | Invoice status remains strictly `PARTIALLY_PAID`, amountDue = `0.01`. |
| 4 | Final 1 Cent Settlement | `paymentAmount = 0.01` on invoice with `amountDue = 0.01` | Status transitions from `PARTIALLY_PAID` to `PAID`, `amountDue` becomes `0.00`. |
| 5 | Payment on Cancelled Invoice | User attempts to open payment modal on `CANCELLED` invoice | Payment button disabled; service throws `"Cannot record payment on a cancelled invoice"`. |
| 6 | Payment on Paid Invoice | User attempts to pay invoice where `amountDue === 0` | "Record Payment" button hidden/disabled; service throws `"Invoice is already fully paid"`. |
| 7 | Single-Day Statement | `startDate = 2026-09-19`, `endDate = 2026-09-19` | Statement includes all invoices and payments executed on `2026-09-19`. Opening balance reflects activity prior to 2026-09-19. |
| 8 | Reversed Date Range | `startDate = 2026-10-01`, `endDate = 2026-09-01` | Validation error: `"Start date cannot be after end date"`. Generation button disabled. |
| 9 | Period with Zero Transactions | Customer has prior balance but no transactions in range | Returns `Opening Balance = X.XX`, empty transaction table ("No transactions during period"), `Closing Balance = X.XX`. |
| 10 | Customer with Zero History | Customer created today, 0 invoices, 0 payments | Returns Opening = 0.00, Debits = 0.00, Credits = 0.00, Closing = 0.00. |
| 11 | Cancelled Invoices in Period | Invoice in date range has status `CANCELLED` | Must NOT add to Period Debits or Closing Balance. Displayed with Cancelled badge or excluded. |
| 12 | Arabic CSV Excel Export | Exporting CSV with Arabic customer name ("شركة الأمل") | Prepend UTF-8 BOM (`\uFEFF`) so Excel on Windows displays Arabic without mojibake. |
| 13 | Commas & Quotes in CSV | Customer name `"Acme, Inc."`, Notes `"Paid via \"Wire\""` | Escaped per RFC 4180: `"\"Acme, Inc.\""`, `"\"Paid via \"\"Wire\"\"\""`. |
| 14 | Rapid Multi-Click Submit | User double-clicks "Confirm Payment" within 100ms | Submit button disables immediately (`isSubmitting: true`); only single payment record created. |
| 15 | Offline Payment Submission | Disconnect network (`disableNetwork`); record payment | Commits instantly to local IndexedDB; UI reflects `PAID`; customer balance updates with 0ms latency. |
| 16 | Dark Mode Printing | Print Statement triggered while Dark Mode is active | Print stylesheet forces white background (`#ffffff`), dark text (`#000000`), strips shadows and dark classes. |
| 17 | Negative Running Balance | Customer has credit balance / overpayment | Minus sign rendered without bidi scrambling (`-50.00 ر.س` or `-$50.00`). |

---

### Exact Data Schemas and Validation Rules

#### 1. Payment Domain Interface (`src/types/domain.ts`)
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
  paymentNumber: string; // e.g. "PAY-2026-0001"
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  amount: number;        // Strictly > 0, rounded to 2 decimals
  paymentDate: string;   // ISO date "YYYY-MM-DD"
  paymentMethod: PaymentMethod;
  referenceNumber?: string; // Optional: check #, transaction ID, wire ref
  notes?: string;
  createdAt: string;     // ISO timestamp "YYYY-MM-DDTHH:mm:ss.sssZ"
}
```

#### 2. Statement Domain Interfaces (`src/types/domain.ts`)
```typescript
export interface StatementDateRange {
  startDate: string; // "YYYY-MM-DD"
  endDate: string;   // "YYYY-MM-DD"
}

export interface StatementEntry {
  id: string;
  type: 'INVOICE' | 'PAYMENT';
  date: string;          // "YYYY-MM-DD"
  createdAt: string;     // ISO timestamp for chronological tie-breaking
  referenceNumber: string; // Invoice # or Payment #
  description: string;
  debit: number;         // Positive for INVOICE, 0 for PAYMENT
  credit: number;        // 0 for INVOICE, positive for PAYMENT
  runningBalance: number;// Cumulative balance after this entry
  currency: string;
  status?: InvoiceStatus;
  paymentMethod?: PaymentMethod;
}

export interface StatementSummary {
  customer: Customer;
  dateRange: StatementDateRange;
  openingBalance: number;
  totalInvoiced: number; // Sum of debits in period
  totalPaid: number;     // Sum of credits in period
  netChange: number;     // totalInvoiced - totalPaid
  closingBalance: number;// openingBalance + netChange
  entries: StatementEntry[];
  generatedAt: string;
}
```

#### 3. Validation Rules Matrix
| Field | Rule | Error Message |
|-------|------|---------------|
| `amount` | Number > 0 | `"Payment amount must be greater than 0.00"` |
| `amount` | Number <= `currentInvoice.amountDue` | `"Payment cannot exceed amount due"` |
| `invoice.status` | Not `'CANCELLED'` | `"Cannot record payment on a cancelled invoice"` |
| `invoice.status` | Not `'PAID'` | `"Invoice is already fully paid"` |
| `paymentDate` | Valid date string `YYYY-MM-DD` | `"Invalid payment date"` |
| `paymentMethod` | One of `PaymentMethod` enum | `"Invalid payment method"` |
| `referenceNumber`| String <= 100 chars, trimmed | `"Reference number cannot exceed 100 characters"` |
| `notes` | String <= 500 chars, trimmed | `"Notes cannot exceed 500 characters"` |
| `startDate` | <= `endDate` | `"Start date cannot be after end date"` |

---

### Math Invariants & Pure Calculation Helpers (`src/lib/statements.ts`)

Create a dedicated pure utility module `src/lib/statements.ts`:

```typescript
import { roundFinancial } from '@/lib/calculations';
import type { Customer, Invoice, Payment, StatementDateRange, StatementEntry, StatementSummary } from '@/types/domain';

/**
 * Calculates opening balance, chronological transaction ledger, and closing balance
 * for a customer within a specified date range.
 */
export function generateCustomerStatement(
  customer: Customer,
  invoices: Invoice[],
  payments: Payment[],
  dateRange: StatementDateRange
): StatementSummary {
  const { startDate, endDate } = dateRange;
  const currency = customer.currency || 'SAR';

  // 1. Calculate Opening Balance: Net unpaid balance prior to startDate
  // Exclude CANCELLED and DRAFT invoices
  const priorInvoicesTotal = roundFinancial(
    invoices
      .filter(inv => inv.issueDate < startDate && inv.status !== 'CANCELLED' && inv.status !== 'DRAFT')
      .reduce((sum, inv) => sum + inv.grandTotal, 0)
  );

  const priorPaymentsTotal = roundFinancial(
    payments
      .filter(pay => pay.paymentDate < startDate)
      .reduce((sum, pay) => sum + pay.amount, 0)
  );

  const openingBalance = roundFinancial(priorInvoicesTotal - priorPaymentsTotal);

  // 2. Filter In-Period Invoices
  const periodInvoiceEntries: Omit<StatementEntry, 'runningBalance'>[] = invoices
    .filter(inv => inv.issueDate >= startDate && inv.issueDate <= endDate && inv.status !== 'CANCELLED' && inv.status !== 'DRAFT')
    .map(inv => ({
      id: inv.id,
      type: 'INVOICE' as const,
      date: inv.issueDate,
      createdAt: inv.createdAt,
      referenceNumber: inv.invoiceNumber,
      description: inv.notes ? `Invoice #${inv.invoiceNumber} - ${inv.notes}` : `Invoice #${inv.invoiceNumber}`,
      debit: roundFinancial(inv.grandTotal),
      credit: 0,
      currency: inv.currency || currency,
      status: inv.status
    }));

  // 3. Filter In-Period Payments
  const periodPaymentEntries: Omit<StatementEntry, 'runningBalance'>[] = payments
    .filter(pay => pay.paymentDate >= startDate && pay.paymentDate <= endDate)
    .map(pay => ({
      id: pay.id,
      type: 'PAYMENT' as const,
      date: pay.paymentDate,
      createdAt: pay.createdAt,
      referenceNumber: pay.paymentNumber,
      description: `Payment for #${pay.invoiceNumber}${pay.referenceNumber ? ` (Ref: ${pay.referenceNumber})` : ''}`,
      debit: 0,
      credit: roundFinancial(pay.amount),
      currency: currency,
      paymentMethod: pay.paymentMethod
    }));

  // 4. Merge and Chronologically Sort
  const merged = [...periodInvoiceEntries, ...periodPaymentEntries];
  merged.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.createdAt !== b.createdAt) return a.createdAt.localeCompare(b.createdAt);
    if (a.type !== b.type) return a.type === 'INVOICE' ? -1 : 1; // Debits before credits on same day
    return a.referenceNumber.localeCompare(b.referenceNumber);
  });

  // 5. Calculate Sequential Running Balance
  let currentBalance = openingBalance;
  const entries: StatementEntry[] = merged.map(item => {
    currentBalance = roundFinancial(currentBalance + item.debit - item.credit);
    return {
      ...item,
      runningBalance: currentBalance
    };
  });

  const totalInvoiced = roundFinancial(entries.reduce((sum, e) => sum + e.debit, 0));
  const totalPaid = roundFinancial(entries.reduce((sum, e) => sum + e.credit, 0));
  const netChange = roundFinancial(totalInvoiced - totalPaid);
  const closingBalance = roundFinancial(openingBalance + netChange);

  return {
    customer,
    dateRange,
    openingBalance,
    totalInvoiced,
    totalPaid,
    netChange,
    closingBalance,
    entries,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Generates an RFC 4180 compliant CSV string with UTF-8 BOM (\uFEFF)
 * for seamless Arabic rendering in Microsoft Excel.
 */
export function exportStatementToCSV(statement: StatementSummary): string {
  const escapeCell = (val: string | number | undefined): string => {
    if (val === undefined || val === null) return '""';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  };

  const rows: string[] = [];

  // Header section
  rows.push([escapeCell('STATEMENT OF ACCOUNT'), escapeCell(statement.customer.name)].join(','));
  rows.push([escapeCell('Date Range'), escapeCell(`${statement.dateRange.startDate} to ${statement.dateRange.endDate}`)].join(','));
  rows.push([escapeCell('Currency'), escapeCell(statement.customer.currency || 'SAR')].join(','));
  rows.push([escapeCell('Opening Balance'), escapeCell(statement.openingBalance.toFixed(2))].join(','));
  rows.push([escapeCell('Total Invoiced'), escapeCell(statement.totalInvoiced.toFixed(2))].join(','));
  rows.push([escapeCell('Total Paid'), escapeCell(statement.totalPaid.toFixed(2))].join(','));
  rows.push([escapeCell('Closing Balance'), escapeCell(statement.closingBalance.toFixed(2))].join(','));
  rows.push(''); // blank row

  // Table header
  rows.push([
    escapeCell('Date'),
    escapeCell('Type'),
    escapeCell('Reference #'),
    escapeCell('Description'),
    escapeCell('Debit (+)'),
    escapeCell('Credit (-)'),
    escapeCell('Running Balance')
  ].join(','));

  // Ledger entries
  for (const entry of statement.entries) {
    rows.push([
      escapeCell(entry.date),
      escapeCell(entry.type),
      escapeCell(entry.referenceNumber),
      escapeCell(entry.description),
      escapeCell(entry.debit > 0 ? entry.debit.toFixed(2) : ''),
      escapeCell(entry.credit > 0 ? entry.credit.toFixed(2) : ''),
      escapeCell(entry.runningBalance.toFixed(2))
    ].join(','));
  }

  // Prepend UTF-8 BOM (\uFEFF) and join with CRLF (\r\n)
  return '\uFEFF' + rows.join('\r\n');
}
```

---

### UI Component Architecture & Design Specifications

#### 1. `PaymentModal.tsx` (`src/components/modules/payments/PaymentModal.tsx`)
- **Visual Design**:
  - Compact modal adhering to mobile-first standards (`sm:max-w-md w-full p-4 sm:p-5`).
  - Invoice Summary Header: Displays Invoice #, Customer Name, and Outstanding Balance in an amber badge.
  - Amount Input: Pre-fills with exact `invoice.amountDue`.
  - Quick-Fill Action Buttons:
    - `"100% Full"` button (sets `amount = invoice.amountDue`).
    - `"50%"` button (sets `amount = roundFinancial(invoice.amountDue / 2)`).
  - Payment Method Selector: Compact grid of pills with icons (`CASH`, `BANK_TRANSFER`, `CREDIT_CARD`, `CHECK`, `ONLINE_GATEWAY`, `OTHER`).
  - Date Picker: Defaults to current local date (`YYYY-MM-DD`).
  - Reference Number input: Optional (placeholder: e.g. "TXN-98765" or "Check #1044").
  - Notes: Optional compact textarea (max 2 rows).
  - Validation Feedback: Dynamic red banner if `amount > amountDue` or `amount <= 0`.
  - Action Buttons: "Cancel" (`Esc`) and "Confirm Payment" (`Enter` or click).
  - Offline Behavior: Submits via `recordPaymentAtomic`, closes modal immediately, triggers toast.

#### 2. `PaymentList.tsx` (`src/components/modules/payments/PaymentList.tsx`)
- **Route**: Rendered at `/payments` in `App.tsx`.
- **Top Metrics Grid**: Dense, compact KPI cards (<90px height) matching `CompactMetricCard`:
  - `Total Collected` (sum of payment amounts).
  - `Payment Count` (number of payments).
  - `Bank Transfers` vs `Cash` breakdown.
- **Search & Filter Bar**:
  - Text search by payment number, invoice number, customer name, reference number.
  - Filter pills: `All`, `Cash`, `Bank Transfer`, `Card`, `Check`, `Online`.
  - Date Range picker.
- **Responsive Layout**:
  - **Mobile (< md)**: Compact Card list (`< 110px` per card). Displays Payment #, Date, Customer Name, Invoice # badge, Method badge, and Amount in bold font.
  - **Desktop (md+)**: Clean data table with columns: Date, Payment #, Customer, Invoice #, Method, Reference, Amount.
- **Actions**:
  - Filter reset.
  - CSV Export of filtered payments.

#### 3. `StatementGenerator.tsx` (`src/components/modules/statements/StatementGenerator.tsx`)
- **Route**: Rendered at `/statements` in `App.tsx` and linked from `CustomerLedger.tsx`.
- **Control Bar**:
  - Customer select dropdown (searchable).
  - Date Range Presets: `"This Month"`, `"Last Month"`, `"This Quarter"`, `"Year to Date"`, `"All Time"`.
  - Custom date inputs (`Start Date`, `End Date`).
  - Validation: Disables generation if `startDate > endDate`.
- **Financial Summary Cards (<90px height)**:
  - 4 compact KPI cards: `Opening Balance`, `Total Invoiced`, `Total Paid`, `Closing Balance`.
- **Action Buttons**:
  - `"Print Statement"`: Opens `StatementPrintView` / browser print dialog.
  - `"Save as PDF"`: Triggers `electronAPI.printInvoicePDF`.
  - `"Export CSV"`: Triggers `electronAPI.exportFile` or browser download.
- **Preview Table**:
  - Running balance table with debit and credit columns.

#### 4. `StatementPrintView.tsx` (`src/components/modules/statements/StatementPrintView.tsx`)
- **Print Layout**:
  - Isolated clean A4 container (`max-w-[210mm] mx-auto p-8 bg-white text-slate-900 font-sans`).
  - Company Header: App / Company Name, Tax Registration #, Address, Generation Date.
  - Customer Block: Customer Name, Address, Tax #, Currency.
  - Statement Period Badge.
  - Executive Financial Table: Opening Balance, Debits, Credits, Closing Balance (highlighted with double border).
  - Detailed Transaction Table: Repeating `thead`, alternating rows, borders.
  - Remittance & Signature footer.
  - CSS `@media print`: Hides sidebar, titlebar, action buttons; forces high-contrast white background even in Dark Mode.
  - RTL Support: Direction flips seamlessly to RTL when Arabic language is active.

#### 5. `usePayments.ts` Hook (`src/hooks/usePayments.ts`)
```typescript
export interface UsePaymentsResult {
  payments: Payment[];
  loading: boolean;
  error: Error | null;
  recordPayment: (params: RecordPaymentInput) => Promise<RecordPaymentAtomicResult>;
  getPaymentsForInvoice: (invoiceId: string) => Payment[];
  getPaymentsForCustomer: (customerId: string) => Payment[];
}
```
- Subscribes to Firestore `payments` collection via `onSnapshot` with `includeMetadataChanges: true`.
- Integrates `trackSnapshotPendingWrites` for sync indicator fidelity.
- Generates sequential payment numbers (`PAY-YYYY-XXXX`).
- Calls `recordPaymentAtomic` in `src/lib/atomicMutations.ts`.

---

## 5. Verification Method

To independently verify the implementation, the Worker and verification agents must execute:

1. **Vitest Unit & Integration Test Suite**:
   ```bash
   npm test
   ```
   *Expected Outcome*: All existing 25 test suites pass + new test suites for `payments` and `statements` pass with 0 failures.

2. **Specific Unit Tests to Create**:
   - `tests/unit/statements.test.ts`:
     - Test opening balance with transactions before start date.
     - Test running balance accuracy and IEEE-754 drift prevention.
     - Test exclusion of `CANCELLED` and `DRAFT` invoices.
     - Test RFC 4180 CSV formatting and UTF-8 BOM (`\uFEFF`) presence.
     - Test single-day statements ($T_{\text{start}} = T_{\text{end}}$).
   - `tests/unit/paymentValidation.test.ts`:
     - Test overpayment rejection (`amount > amountDue`).
     - Test zero and negative amount rejection.
     - Test payment on `CANCELLED` invoice rejection.
     - Test status auto-transition (`PAID` vs `PARTIALLY_PAID`).
     - Test atomic batch multi-document updates.

3. **Files to Inspect**:
   - `src/types/domain.ts` (Statement types added)
   - `src/lib/statements.ts` (Pure statement math & CSV exporter)
   - `src/hooks/usePayments.ts` (Reactive payments hook)
   - `src/components/modules/payments/PaymentModal.tsx` (Payment modal)
   - `src/components/modules/payments/PaymentList.tsx` (Payments view)
   - `src/components/modules/statements/StatementGenerator.tsx` (Statement generator)
   - `src/components/modules/statements/StatementPrintView.tsx` (Printable view)
   - `src/App.tsx` (Routes connected)

4. **Invalidation Conditions**:
   - If recording a payment does not update customer `outstandingAmount` synchronously.
   - If overpaying an invoice is permitted.
   - If CSV export lacks `\uFEFF` causing Arabic characters in Excel to scramble.
   - If opening balance erroneously includes `CANCELLED` invoices.
   - If print layout displays UI navigation buttons or fails to force white background in Dark Mode.
