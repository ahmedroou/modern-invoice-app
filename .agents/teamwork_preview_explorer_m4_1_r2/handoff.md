# Milestone 4 Technical Investigation & Architecture Handoff: Invoices & Real-Time Calculation Engine

## 1. Observation

Direct observations from examining the codebase, specifications, and test infrastructure:

1. **Acceptance Criteria & Requirements**:
   - `ORIGINAL_REQUEST.md` line 32 & line 71: *"Invoice creation updates the 'Grand Total' automatically in real-time as items are added/modified, without clicking a 'calculate' button."* (AC3).
   - `ORIGINAL_REQUEST.md` line 35 & line 74: *"Creating an invoice correctly updates the customer's 'Outstanding Amount' instantly."* (AC4).
   - `PROJECT.md` lines 97-102: Features `F-INV-01` (Real-Time Calculation), `F-INV-02` (Itemized Line Items), `F-INV-03` (Keyboard Grid Navigation), `F-INV-04` (Global Shortcuts), `F-INV-05` (Status Transitions), `F-INV-06` (Search & Filter).
   - `DISPATCH.md` lines 6-25: Mandates zero calculate button, epsilon-safe 2-decimal rounding, keyboard navigation (`Tab`, `Shift+Tab`, `Enter` on last cell creates row & focuses description, Arrow navigation), global shortcuts (`Ctrl+N`, `Ctrl+S`, `Escape`), atomic customer balance sync via `createInvoiceAtomic`, compact card design (`h-[82px]`, `<90px`), and 375px+ mobile responsiveness.

2. **Existing Calculation Engine (`src/lib/calculations.ts`)**:
   - Lines 48-67: `roundFinancial(amount: number, decimals: number = 2): number` implements symmetric arithmetic half-up rounding using decimal exponential shifting to avoid IEEE-754 mantissa drift.
   - Lines 84-115: `calculateLineItem(item: LineItemInput): CalculatedLineItem` calculates `grossAmount = roundFinancial(quantity * unitPrice)`, `lineDiscount` (with percentage capped at 100% or fixed capped at gross), `taxableAmount = max(0, grossAmount - lineDiscount)`, `lineTax`, and `lineTotal`.
   - Lines 134-164: `determineInvoiceStatus(grandTotal, amountPaid, dueDate, isDraft, referenceDate): InvoiceStatus` evaluates `DRAFT`, `PAID`, `OVERDUE`, `PARTIALLY_PAID`, or `UNPAID`.
   - Lines 183-219: `calculateInvoiceTotals(items: LineItemInput[], amountPaid, dueDate, isDraft, referenceDate): InvoiceTotals` aggregates `subtotal`, `totalDiscount`, `totalTax`, `grandTotal`, `amountDue`, and `status`.
   - Lines 236-270: `formatCurrency(amount, currency, locale)` formats localized currency strings with `\u200E` bidirectional isolation markers and `ar-SA-u-nu-latn` Western Arabic numerals.

3. **Existing Atomic Mutations (`src/lib/atomicMutations.ts`)**:
   - Lines 34-104: `createInvoiceAtomic(params: CreateInvoiceAtomicParams, firestore?: Firestore): Promise<CreateInvoiceAtomicResult>` creates an Invoice doc, increments customer `outstandingAmount` by `initialAmountDue` and `totalInvoiced` by `grandTotal`, and records an `activity_logs` entry atomically within a single `writeBatch()`.
   - Lines 136-221: `recordPaymentAtomic(params: RecordPaymentAtomicParams)` records payment, updates invoice `amountPaid`, `amountDue`, and `status`, decrements customer `outstandingAmount`, and records activity log.
   - **Gap Observed**: `atomicMutations.ts` lacks `updateInvoiceAtomic` (needed when an existing invoice is edited, which must adjust customer `outstandingAmount` by the net difference $\Delta \text{due} = \text{newDue} - \text{oldDue}$) and lacks `cancelInvoiceAtomic` (which voids an invoice and decrements customer balance by `oldDue`).

4. **Existing Routing & Layout Status (`src/App.tsx`)**:
   - Lines 10-22: `PlaceholderView` component currently renders a temporary card for placeholder routes.
   - Line 32: `<Route path="invoices" element={<PlaceholderView titleKey="nav.invoices" />} />`. Invoices view is currently an unmounted placeholder.
   - `src/components/modules/invoices/` directory does not exist yet.
   - `src/hooks/useInvoices.ts` does not exist yet.
   - `src/lib/keyboard.ts` does not exist yet.

5. **Compact Card Dimension Constraints (`tests/unit/EmpiricalChallengerM3_4.test.tsx`)**:
   - Lines 563-580: The test runner specifically queries `.h-[82px]` and asserts:
     ```typescript
     const kpiCards = metricsGrid.querySelectorAll('.h-[82px]');
     expect(kpiCards.length).toBe(4);
     const customerCards = customerGrid.querySelectorAll('.h-[82px]');
     expect(customerCards.length).toBe(2);
     customerCards.forEach((card) => {
       expect(card.className).toContain('h-[82px]');
       expect(card.className).toContain('min-w-0');
       const textTruncated = card.querySelectorAll('.truncate');
       expect(textTruncated.length).toBeGreaterThanOrEqual(2);
     });
     ```
   - This proves that any invoice cards view must use `.h-[82px]`, `min-w-0`, and `truncate` to satisfy both the `<90px` user rule and empirical automated test constraints.

6. **Current Test Suite Execution**:
   - `npm test -- --run` executed all 25 test files (352 tests) and passed 100% with exit code 0.

---

## 2. Logic Chain

1. **Real-Time Calculation Without Calculate Button (AC3)**:
   - *Observation Reference*: AC3 states Grand Total must update automatically in real-time as items are added/modified without clicking a calculate button. `calculateInvoiceTotals()` in `src/lib/calculations.ts` is pure and executes in microseconds.
   - *Reasoning*: In React state, maintaining line items in a local state array (`items: InvoiceItemState[]`) and computing derived financial totals via `useMemo(() => calculateInvoiceTotals(items, amountPaid, dueDate, isDraft), [items, amountPaid, dueDate, isDraft])` guarantees synchronous DOM updates on every keystroke (`onChange`).
   - *Implementation Detail*:
     - When any line item input changes (Quantity, Unit Price, Discount, Discount Type, Tax Rate), update the item in state.
     - Each item row immediately computes its own `lineTotal` using `calculateLineItem(item)`.
     - The aggregate display (`#grand-total-display`, Subtotal, Tax, Discount, Amount Due) automatically re-renders with 0ms latency.
     - Zero calculate button: The form contains only "Save Invoice" (or "Save as Draft") and "Cancel", completely eliminating any calculate button.

2. **Keyboard-Driven Grid Navigation & Shortcuts (F-INV-03, F-INV-04)**:
   - *Observation Reference*: `TEST_INFRA.md` lines 317-330 & 558-571 specify exact keyboard sequences: Tab/Shift+Tab progression, Enter on last cell creates a row and focuses Description, Arrow keys move vertically between rows, and global shortcuts (Ctrl+N, Ctrl+S, Esc).
   - *Reasoning*: Standard HTML table navigation only tabs sequentially. Custom grid navigation requires an `onKeyDown` handler on line item inputs that tracks `rowIndex` and `colIndex` (or column field name).
   - *Progression Flow*:
     - Cells per row: `0: description` $\to$ `1: quantity` $\to$ `2: unitPrice` $\to$ `3: discount` $\to$ `4: taxRate`.
     - `Enter` on `taxRate` (or last input): Checks if current row is valid; appends a new item `{ id: crypto.randomUUID(), description: '', quantity: 1, unitPrice: 0, discount: 0, discountType: 'PERCENTAGE', taxRate: 15 }`; uses `requestAnimationFrame` / `setTimeout` to focus the new row's `description` input via ref or `document.getElementById('item-${newIndex}-description')`.
     - `ArrowDown` in column $c$ of row $r$: If $r < \text{items.length} - 1$, moves focus to column $c$ of row $r + 1$.
     - `ArrowUp` in column $c$ of row $r$: If $r > 0$, moves focus to column $c$ of row $r - 1$.
     - `Alt + Delete`: Removes row $r$ (if $\text{items.length} > 1$) and shifts focus to row $\min(r, \text{items.length} - 2)$.
     - `Ctrl+N` / `Cmd+N`: Triggers `handleOpenCreate()`, unless modal is already open.
     - `Ctrl+S` / `Cmd+S`: Calls `preventDefault()`; if valid, executes submit; if invalid, sets validation errors and focuses first invalid field.
     - `Escape`: Closes modal; if form is dirty (`isDirty`), displays a confirmation prompt to avoid accidental loss of data.
     - Guard: Global shortcuts must ignore events when target is a `textarea` (e.g. invoice notes) or when an input is being composed.

3. **Instant Customer Outstanding Balance Synchronization (AC4)**:
   - *Observation Reference*: `atomicMutations.ts` line 70 uses `batch.update(customerRef, { outstandingAmount: increment(initialAmountDue), totalInvoiced: increment(grandTotal) })`.
   - *Reasoning*: Because Firestore uses IndexedDB persistence (`persistentMultipleTabManager`), `batch.commit()` resolves against local cache instantly without network latency. All `onSnapshot` queries with `includeMetadataChanges: true` receive updated customer documents with `hasPendingWrites: true` in 0ms.
   - *Handling Invariants & State Edge Cases*:
     - **Draft Invoices**: A Draft invoice must NOT increment customer's `outstandingAmount` or `totalInvoiced`. As verified in `useCustomerLedger.stress.test.ts` line 40, DRAFT invoices are excluded from balance posting until finalized.
     - **Invoice Modification (`updateInvoiceAtomic`)**: If an invoice's total is edited from $\$500 \to \$800$, customer `outstandingAmount` must be adjusted by the net difference $\Delta = +300$.
     - **Invoice Cancellation (`cancelInvoiceAtomic`)**: When an unpaid invoice with `amountDue = 200` is cancelled, customer `outstandingAmount` must be decremented by $200$, and invoice `status` set to `CANCELLED`.

4. **Mobile-First Compact Card Design (<90px Height)**:
   - *Observation Reference*: User global rule: *"Use compact card designs by default. Cards should occupy less vertical space, make efficient use of available width..."* Empirical tests enforce `h-[82px]`, `min-w-0`, `truncate`.
   - *Reasoning*: Mobile viewport (375px) requires dense 2-row cards where vertical space is tightly bounded.
   - *Card Structure (`h-[82px]`, actual 82px height)*:
     - Top row (h-6): Invoice # (`font-mono font-bold text-xs`) + Customer Name (`truncate max-w-[150px]`) + Status Badge (`text-[10px] px-1.5 py-0.5 rounded-full font-semibold`).
     - Bottom row (h-6): Date / Due Date (`text-[11px] text-slate-400`) + Grand Total (`font-mono font-bold text-xs` with `<BidiIsolate>`) + Chevron (`w-3.5 h-3.5 rtl:rotate-180`).
     - Padding: `px-3 py-2`, `flex flex-col justify-between`.
     - Layout: Responsive grid `grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-2.5`.
     - Desktop toggle: Users can switch between Compact Cards and dense Desktop Table View (`viewMode === 'cards' | 'table'`).

5. **Search & Filter Architecture**:
   - Search: Supports live search across invoice number, customer name, and item descriptions. Reuses `normalizeSearchText` from `useCustomers.ts` to support Arabic diacritics, Hamza variants, and whitespace normalization.
   - Status Filters: `ALL`, `DRAFT`, `UNPAID`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`, `CANCELLED`.
   - Customer Filter: Filter by selected customer (compatible with URL query param `?customerId=...` from CustomerLedger).
   - Date Range Filter: All Time, Today, Last 30 Days, Custom Range.

---

## 3. Caveats

1. **Native PDF Printing in Electron**:
   - `PROJECT.md` line 145 defines `window.electronAPI.printInvoicePDF`. In the browser/unit-test environment, `window.electronAPI` may be mocked or undefined. The print/export action in `InvoiceDetailModal` must defensively fall back to `window.print()` when running in browser mode.
2. **Draft Invoice Balance Boundary**:
   - `createInvoiceAtomic` in `atomicMutations.ts` currently updates customer balance unconditionally. When `invoice.status === 'DRAFT'`, `createInvoiceAtomic` should either not update customer balance or only record the invoice doc and activity log, deferring balance adjustment until the invoice is issued. The implementer should ensure this distinction is maintained.
3. **Overdue Status Dynamism**:
   - An invoice stored as `UNPAID` with a due date in the past becomes overdue dynamically as calendar days cross midnight without database writes. `useInvoices` and `InvoiceList` must evaluate `determineInvoiceStatus()` dynamically against the current date so status badges automatically show "OVERDUE" without requiring a backend cron job.

---

## 4. Conclusion & Technical Implementation Plan

To implement Milestone 4 with zero defects and 100% compliance with acceptance criteria, the following modular architecture should be created:

### 4.1 New Files to Implement

```
src/
├── hooks/
│   └── useInvoices.ts              # Firestore live subscription, search, filter, sort, and invoice metrics
├── lib/
│   └── keyboard.ts                 # Grid navigation helpers and global hotkey listeners (Ctrl+N, Ctrl+S, Esc)
└── components/modules/invoices/
    ├── InvoiceList.tsx             # Directory view with compact cards (h-[82px]), table view toggle, search, filter, KPI grid
    ├── InvoiceModal.tsx            # Invoice Create/Edit modal with real-time calculations (no calculate button) & keyboard grid
    ├── InvoiceDetailModal.tsx      # Comprehensive invoice view: item breakdown, payment status, printable layout, PDF action
    └── LineItemsGrid.tsx           # Keyboard-accessible line item table supporting Tab, Enter, Arrows, live line totals
```

### 4.2 Enhancements to Existing Files

1. **`src/lib/atomicMutations.ts`**:
   - Add `updateInvoiceAtomic(params: UpdateInvoiceAtomicParams)`: Atomically updates invoice and adjusts customer `outstandingAmount` by `newAmountDue - oldAmountDue` and `totalInvoiced` by `newGrandTotal - oldGrandTotal`.
   - Add `cancelInvoiceAtomic(params: CancelInvoiceAtomicParams)`: Atomically sets status to `CANCELLED`, `amountDue = 0`, and decrements customer `outstandingAmount` by `oldAmountDue`.
   - Guard `createInvoiceAtomic`: If `initialStatus === 'DRAFT'`, do not increment customer balance.

2. **`src/App.tsx`**:
   - Replace `<Route path="invoices" element={<PlaceholderView titleKey="nav.invoices" />} />` with `<Route path="invoices" element={<InvoiceList />} />`.

3. **`src/context/DirectionContext.tsx`**:
   - Ensure invoice action labels and statuses (`action.newInvoice`, `status.draft`, `status.unpaid`, `status.partiallyPaid`, `status.paid`, `status.overdue`, `status.cancelled`) are consistently localized.

### 4.3 Component Specifications

#### A. `src/hooks/useInvoices.ts`
- State: `invoices`, `rawInvoices`, `loading`, `error`.
- Search & Filter state: `searchQuery`, `statusFilter` (`ALL` | `DRAFT` | `UNPAID` | `PARTIALLY_PAID` | `PAID` | `OVERDUE` | `CANCELLED`), `customerFilter` (`string | null`), `dateRange` (`{ from?: string; to?: string }`).
- Sorting: `sortBy` (`issueDate` | `dueDate` | `invoiceNumber` | `grandTotal` | `amountDue`), `sortOrder` (`asc` | `desc`).
- Actions:
  - `createInvoice(data)`: calls `createInvoiceAtomic`.
  - `updateInvoice(id, data, oldInvoice)`: calls `updateInvoiceAtomic`.
  - `cancelInvoice(id, currentInvoice)`: calls `cancelInvoiceAtomic`.
  - `getInvoiceById(id)`.
- Live Metrics:
  - `totalCount`, `unpaidCount`, `paidCount`, `overdueCount`, `draftCount`, `totalInvoiced`, `outstandingReceivables`.

#### B. `src/lib/keyboard.ts`
- Utility for line item grid navigation:
  ```typescript
  export interface GridNavigationOptions {
    totalRows: number;
    totalCols: number;
    onAddRow?: () => void;
    onDeleteRow?: (rowIndex: number) => void;
  }
  export function handleGridKeyDown(
    e: React.KeyboardEvent<HTMLElement>,
    rowIndex: number,
    colIndex: number,
    options: GridNavigationOptions
  ): void;
  ```
- Global shortcuts hook:
  ```typescript
  export function useGlobalShortcuts(handlers: {
    onNewInvoice?: () => void;
    onSaveInvoice?: () => void;
    onEscape?: () => void;
    onSearch?: () => void;
  }): void;
  ```

#### C. `src/components/modules/invoices/InvoiceModal.tsx` & `LineItemsGrid.tsx`
- **Zero Calculate Button**: Grand total, subtotal, tax, and discount are derived synchronously via `useMemo` from `calculateInvoiceTotals(items, amountPaid, dueDate, isDraft)`.
- **Keyboard Progression**:
  - Cell inputs: `data-row-index={i}` and `data-col-index={c}`.
  - Cell 0 (Description) $\to$ Cell 1 (Qty) $\to$ Cell 2 (Unit Price) $\to$ Cell 3 (Discount & Discount Type) $\to$ Cell 4 (Tax Rate).
  - Pressing `Enter` on Tax Rate: creates new item and focuses `document.getElementById('item-${newIndex}-desc')`.
  - Pressing `ArrowUp` / `ArrowDown`: moves to same column of adjacent row.
  - Pressing `Alt + Delete`: deletes active row (maintaining $\ge 1$ row).
- **Validation**:
  - Customer selection is required.
  - Issue date required; due date must not be before issue date.
  - At least 1 line item with non-empty description, quantity $> 0$, unit price $\ge 0$.
  - Disables save button during submission (`isSubmitting: true`) to prevent race conditions.

#### D. `src/components/modules/invoices/InvoiceList.tsx`
- **KPI Metrics Grid**: 4 compact cards (<90px height, actual `h-[82px]`) displaying Total Invoices, Unpaid Invoices, Overdue Invoices, and Outstanding Receivables.
- **Search & Filter Bar**:
  - Search input with clear button and 300ms debounce.
  - Status filter pills (`All`, `Unpaid`, `Partially Paid`, `Paid`, `Overdue`, `Draft`, `Cancelled`).
  - Customer dropdown filter (populated from `useCustomers()`).
  - Sort dropdown + direction toggle.
- **Card View (`h-[82px]`)**:
  - Strictly `h-[82px]`, `min-w-0`, `truncate` on text fields.
  - Click card $\to$ opens `InvoiceDetailModal` (or updates URL `?id=${invoice.id}`).
- **Desktop Table View**:
  - Toggle button between cards and table view for power desktop users.

#### E. `src/components/modules/invoices/InvoiceDetailModal.tsx`
- Responsive modal / bottom sheet.
- Itemized breakdown table with unit price, discount, tax, and line totals.
- Balance overview: Subtotal, Total Discount, Total Tax, Grand Total, Amount Paid, Amount Due.
- Actions:
  - "Record Payment": opens `PaymentModal` prefilled with invoice.
  - "Edit Invoice": opens `InvoiceModal` in edit mode (if not cancelled/paid).
  - "Cancel Invoice": prompts confirmation and calls `cancelInvoiceAtomic`.
  - "Print / PDF": calls `window.electronAPI.printInvoicePDF` (with `window.print()` fallback).

---

## 5. Verification Method

To independently verify the implementation after code delivery, execute the following steps:

1. **Full Vitest Test Suite**:
   ```bash
   npm test -- --run
   ```
   *Expected outcome*: All existing 25 test files (352 tests) and all new invoice test suites pass with 0 failures.

2. **Dedicated Invoice Unit & Integration Tests**:
   Create and run `tests/unit/InvoiceForm.test.tsx` and `tests/unit/useInvoices.test.ts`:
   ```bash
   npx vitest run tests/unit/InvoiceForm.test.tsx tests/unit/useInvoices.test.ts
   ```
   *Specific assertions to verify*:
   - **Real-Time Calculation (AC3)**: Changing quantity from `2` to `5` immediately updates `#grand-total-display` without clicking any button.
   - **Keyboard Progression**: Pressing `Enter` on the last cell of row 1 adds row 2 and sets document active element to row 2's description input.
   - **Keyboard Navigation**: Pressing `ArrowDown` in Quantity input moves focus to Quantity input of the next row.
   - **Global Shortcuts**: Pressing `Ctrl+N` opens modal; `Ctrl+S` triggers save; `Escape` closes modal.
   - **Customer Balance Sync (AC4)**: Submitting invoice verifies `writeBatch` increments customer `outstandingAmount` by `amountDue`.
   - **Card Dimension Constraint**: Verifies all rendered invoice list cards in card view contain class `.h-[82px]`, `min-w-0`, and `truncate`.

3. **Electron & Browser Smoke Test**:
   ```bash
   npm run build
   ```
   *Expected outcome*: Vite and TypeScript build complete with 0 errors and zero circular dependencies.

4. **Invalidation Conditions**:
   The implementation is invalidated if:
   - Any "Calculate" button is required to update totals.
   - The invoice cards exceed $90\text{px}$ in height or fail the `h-[82px]` class requirement.
   - Customer outstanding balance does not update instantly upon invoice save.
   - Offline mode fails to persist newly created invoices in local IndexedDB.
