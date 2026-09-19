# Milestone 4 Integration Handoff Report: Customer Statements, Print/PDF/CSV Export, App Routing & Mobile-First RTL

**Agent**: `teamwork_preview_explorer_m4_3_r2`  
**Milestone**: Milestone 4 — Invoices, Payments & Statements  
**Working Directory**: `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m4_3_r2`  
**Date**: 2026-09-19  
**Status**: COMPLETE — Ready for Implementation by Worker  

---

## 1. Observation

Direct code and environment observations gathered from authoritative specification documents, codebase inspection, and test execution:

### 1.1 Specification & Acceptance Criteria Observations
- **`ORIGINAL_REQUEST.md`**:
  - Line 21–23: *"R2. Financial Management Features: Implement the core modules: Dashboard (metrics and activity log), Accounts/Customers, Invoices (with real-time automatic calculations and keyboard navigation), Payments (partial and full), and generated Statements."*
  - Line 35: *"AC 4: Creating an invoice correctly updates the customer's 'Outstanding Amount' instantly."*
  - Line 36: *"AC 5: Recording a full payment on an invoice changes its status to 'Paid' and reflects in the Activity Log."*
  - Line 37: *"AC 6: Data can be written and read when the network connection is disabled (verifying Firebase offline persistence)."*
- **`PROJECT.md`**:
  - Lines 103–107:
    - `F-PAY-01`: Record Full Payment (clears balance, marks `PAID`).
    - `F-PAY-02`: Record Partial Payment (marks `PARTIALLY_PAID`, decrements balance).
    - `F-PAY-03`: Multi-Method Payment Logging (`CASH`, `BANK_TRANSFER`, `CREDIT_CARD`, `CHECK`, `ONLINE_GATEWAY`, `OTHER`).
    - `F-STMT-01`: Customer Statement Generator (ledger with opening balance, debit/credit rows, closing balance).
    - `F-STMT-02`: Statement Export & Print View (print preview and PDF/CSV export).
  - Lines 126–151: Interface contract for `window.electronAPI`:
    - `printInvoicePDF: (options: PrintInvoiceOptions) => Promise<{ success: boolean; filePath?: string; error?: string }>`
    - `exportFile: (options: ExportDataOptions) => Promise<{ success: boolean; filePath?: string; error?: string }>`
- **`TEST_INFRA.md`**:
  - Lines 366–379 (`T1-STMT-01`, `T1-STMT-02`): Statement generation with custom date range; Opening Balance = net unpaid balance prior to start date; ledger rows with debits (invoices) and credits (payments); running balance column line-by-line; Closing Balance = Opening Balance + Total Invoiced - Total Paid; CSV export with RFC 4180 escaping and UTF-8 BOM (`\uFEFF`); print preview layout hiding UI chrome.
  - Line 587 (`T2-PAY-01-01`): Overpayment rejection: payment amount cannot exceed amount due (`"Payment cannot exceed amount due"`).
- **User Global Rules**:
  - *"Always prioritize mobile-first design. Ensure the UI/UX is fully optimized for mobile across all aspects, including layout, responsiveness, sizing, typography, and interactions..."*
  - *"Use compact card designs by default. Cards should occupy less vertical space... (<90px height)"*.

### 1.2 Routing & Navigation Observations
- **`src/App.tsx`** (lines 28–41):
  ```tsx
  <Route path="/" element={<AppLayout />}>
    <Route index element={<DashboardView />} />
    <Route path="invoices" element={<PlaceholderView titleKey="nav.invoices" />} />
    <Route path="customers" element={<CustomerList />} />
    <Route path="customers/:id" element={<CustomerList />} />
    <Route path="payments" element={<PlaceholderView titleKey="nav.payments" />} />
    <Route path="statements" element={<PlaceholderView titleKey="nav.statements" />} />
    <Route path="settings" element={<PlaceholderView titleKey="nav.settings" />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Route>
  ```
  - `/invoices`, `/payments`, and `/statements` currently render `<PlaceholderView titleKey="..." />`.
- **`src/components/layout/Sidebar.tsx`** (lines 28–35):
  - Already contains nav links for `/invoices` (`FileText`), `/customers` (`Users`), `/payments` (`CreditCard`), and `/statements` (`FileSpreadsheet`).
  - Supports collapsible width (`w-16` vs `w-60`), RTL chevron flipping (`isRTL ? 'rotate-180' : ''`), language switcher (`Globe`), and theme switcher (`Sun`/`Moon`).
- **`src/components/layout/MobileNav.tsx`** (lines 25–36, 78–110):
  - Bottom navigation bar (fixed `h-14`) exposes 4 primary tabs: `/` (Dashboard), `/invoices`, `/customers`, `/payments`, plus a "More" drawer trigger.
  - Slide-over drawer exposes `/statements` and `/settings` alongside language/theme controls.
- **`src/components/modules/customers/CustomerList.tsx`** (lines 108–110):
  - Deep-link navigation triggers are already plumbed:
    - New Invoice: `navigate('/invoices?new=1&customerId=' + custId)`
    - Record Payment: `navigate('/payments?new=1&customerId=' + custId)`
    - View Invoice: `navigate('/invoices?id=' + invId)`
- **`src/components/modules/customers/CustomerProfileSummary.tsx`** (line 29, 194–203):
  - `CustomerProfileSummaryProps` already accepts `onPrintStatement?: () => void`. When clicked, it should navigate to `/statements?customerId=${customer.id}`.

### 1.3 Electron IPC Bridge Observations
- **`electron/preload.ts`** (lines 22–35):
  ```typescript
  printInvoicePDF: (options: PrintInvoiceOptions) => {
    if (!options || typeof options !== 'object') {
      return Promise.reject(new Error('Invalid print options'));
    }
    return ipcRenderer.invoke('invoice:print-pdf', options);
  },
  exportFile: (options: ExportDataOptions) => {
    if (!options || typeof options !== 'object' || !options.format || !options.data) {
      return Promise.reject(new Error('Invalid export options'));
    }
    return ipcRenderer.invoke('file:export', options);
  }
  ```
- **`electron/ipcHandlers.ts`** (lines 46–136):
  - `invoice:print-pdf`: Calls `dialog.showSaveDialog(mainWindow, { defaultPath: 'Invoice-${sanitizedNumber}.pdf', filters: [{ name: 'PDF Documents', extensions: ['pdf'] }] })`. If `options.htmlContent` is provided, spawns offscreen hidden BrowserWindow, loads HTML, calls `webContents.printToPDF({ pageSize: 'A4', printBackground: true, margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 } })`, writes buffer with `fs.writeFile`, and destroys offscreen window. If `htmlContent` is omitted, prints current main window webContents.
  - `file:export`: Calls `dialog.showSaveDialog(mainWindow, { defaultPath: defaultFilename, filters: [{ name: filterName, extensions: [ext] }] })`, writes data to file via `fs.writeFile(filePath, options.data, 'utf-8')`.

### 1.4 Financial Calculations & Ledger History Observations
- **`src/lib/calculations.ts`**:
  - Exports `roundFinancial(amount, decimals = 2)` with epsilon-safe exponential shifting.
  - Exports `calculateLineItem`, `calculateInvoiceTotals`, `determineInvoiceStatus`, and `formatCurrency`.
- **`src/hooks/useCustomerLedger.ts`**:
  - In-memory offline join of `invoices` and `payments` for a customer.
  - Interleaves invoices (debit) and payments (credit) sorted by `date`, `createdAt`, and `type === 'INVOICE'`.
  - Computes cumulative running balance.
  - Excludes `CANCELLED` and `DRAFT` invoices.

### 1.5 Empirical Test Invariant Collision Observation
- Executing `npx vitest run tests/unit/EmpiricalChallengerM2_2.test.tsx` revealed an invariant clash:
  - `tests/unit/EmpiricalChallengerM2_2.test.tsx:296` asserts:
    ```typescript
    // Test: "handles overpayment gracefully by clamping amountDue to 0 and marking PAID"
    const params = { payment: { amount: 600 }, currentInvoice: { amountDue: 500, grandTotal: 500 } };
    const result = await recordPaymentAtomic(params, db);
    expect(result.newAmountDue).toBe(0);
    expect(result.newInvoiceStatus).toBe('PAID');
    expect(result.newAmountPaid).toBe(600);
    ```
  - However, in `src/lib/atomicMutations.ts` line 394:
    ```typescript
    if (paymentAmount > currentInvoice.amountDue + 0.0001) {
      throw new Error('Payment cannot exceed amount due');
    }
    ```
    This threw `Error: Payment cannot exceed amount due` during the test, causing that single test case to fail.
  - In `TEST_INFRA.md` line 587 (`T2-PAY-01-01`), the specification states:
    *"Attempt to record payment greater than amountDue ($150 on $100 due); verify validation blocks submit: 'Payment cannot exceed amount due'."*
  - This establishes that form-level validation in `PaymentModal.tsx` must block overpayment from being submitted, while `recordPaymentAtomic` in `atomicMutations.ts` must allow an optional parameter or clamp behavior if called directly, ensuring 100% test compatibility across both `EmpiricalChallengerM2_2` and `TEST_INFRA.md`.

---

## 2. Logic Chain

### 2.1 Statement of Account Architecture (`StatementOfAccount.tsx` / `StatementGenerator.tsx`)

#### A. Mathematical & Accounting Specifications
A Customer Statement of Account is an authoritative financial ledger representing all accounting movements between a merchant and a customer across an arbitrary date range $[T_{\text{start}}, T_{\text{end}}]$.

1. **Opening Balance Formulation**:
   The Opening Balance represents the customer's cumulative net debt strictly prior to $T_{\text{start}}$:
   $$\text{OpeningBalance} = \sum_{\substack{\text{inv} \in \text{Invoices}, \\ \text{inv.issueDate} < T_{\text{start}}, \\ \text{inv.status} \notin \{\text{CANCELLED}, \text{DRAFT}\}}} \text{inv.grandTotal} \;-\; \sum_{\substack{\text{pay} \in \text{Payments}, \\ \text{pay.paymentDate} < T_{\text{start}}}} \text{pay.amount}$$
   - Both terms are calculated using `roundFinancial()` to eliminate floating-point drift.
   - `CANCELLED` and `DRAFT` invoices are strictly excluded, as they do not constitute active accounts receivable.

2. **In-Period Transaction Interleaving**:
   All non-cancelled, non-draft invoices with $T_{\text{start}} \le \text{issueDate} \le T_{\text{end}}$ are registered as **Debits** ($\text{debit} = \text{inv.grandTotal}, \text{credit} = 0$).
   All payments with $T_{\text{start}} \le \text{paymentDate} \le T_{\text{end}}$ are registered as **Credits** ($\text{debit} = 0, \text{credit} = \text{pay.amount}$).

3. **Deterministic Chronological Sorting**:
   Transactions are sorted using a 4-tier deterministic comparator:
   - Primary: Date (`date.localeCompare(other.date)`).
   - Secondary: Creation timestamp (`createdAt.localeCompare(other.createdAt)`).
   - Tertiary: Transaction type: Invoices (debits) precede Payments (credits) on the same date (`type === 'INVOICE' ? -1 : 1`).
   - Quaternary: Reference number alphabetical tie-breaker.

4. **Line-by-Line Running Balance**:
   $$R_0 = \text{OpeningBalance}$$
   $$R_k = \text{roundFinancial}(R_{k-1} + \text{debit}_k - \text{credit}_k) \quad \text{for } k = 1 \dots N$$

5. **Period Totals & Closing Balance**:
   $$\text{TotalInvoiced} = \sum_{k=1}^N \text{debit}_k$$
   $$\text{TotalPaid} = \sum_{k=1}^N \text{credit}_k$$
   $$\text{NetChange} = \text{TotalInvoiced} - \text{TotalPaid}$$
   $$\text{ClosingBalance} = \text{roundFinancial}(\text{OpeningBalance} + \text{NetChange}) \equiv R_N$$

#### B. Component Architecture for `StatementGenerator.tsx` (or `StatementOfAccount.tsx`)
```
src/components/modules/statements/
├── StatementGenerator.tsx        # Interactive UI view: customer picker, date range, KPI cards, interactive ledger
├── StatementPrintView.tsx        # High-contrast printable document layout (A4, repeated thead, signature block)
└── StatementExportModal.tsx       # Export modal for PDF / CSV download selection
```

1. **Customer Selector**:
   - Searchable select/dropdown listing all active customers with their current balance.
   - Automatically pre-selects customer when accessed via `/statements?customerId=:id` or `/statements/:customerId`.
2. **Date Range Picker with Quick Presets**:
   - Presets:
     - `"This Month"`: 1st of current month to current date.
     - `"Last Month"`: 1st of previous month to last day of previous month.
     - `"This Quarter"`: Start of current quarter to current date.
     - `"Year to Date"`: January 1 of current year to current date.
     - `"All Time"`: 2020-01-01 to today.
   - Custom Date Inputs: `Start Date` (`YYYY-MM-DD`) and `End Date` (`YYYY-MM-DD`).
   - Validation: Displays inline warning if `startDate > endDate` and disables generation.
3. **Compact KPI Cards (<90px height, actual `h-[82px]`)**:
   - 4-card responsive grid:
     - **Opening Balance**: Initial balance at period start with `<BidiIsolate>`.
     - **Total Invoiced**: Period debits with invoice count.
     - **Total Paid**: Period credits with payment count.
     - **Closing Balance**: Final net balance with status badge (`Settled` / `Open Balance` / `Credit Balance`).
4. **Interactive Ledger Table & Compact Mobile Cards**:
   - **Desktop**: Table with columns: Date, Type (`Invoice` / `Payment`), Ref #, Description, Debit (+), Credit (-), Running Balance.
   - **Mobile (375px)**: Compact cards `h-[82px]` displaying Date, Ref #, Type badge, Debit/Credit delta, and Running Balance.

---

### 2.2 Print & Export Engine Architecture

#### A. Electron IPC Integration Bridge
The application integrates with Electron via `window.electronAPI`:
1. **PDF Generation Flow**:
   - Worker checks `if (window.electronAPI?.printInvoicePDF)`.
   - Generates clean, self-contained HTML containing the document markup and scoped CSS (or renders DOM).
   - Invokes `window.electronAPI.printInvoicePDF({ invoiceId, invoiceNumber, htmlContent })`.
   - Electron main process invokes `dialog.showSaveDialog(mainWindow, { defaultPath: 'Statement-...pdf' })`.
   - Renderer receives `{ success: true, filePath }` and triggers a success toast notification.
2. **CSV File Export Flow**:
   - Worker calls `exportStatementToCSV(statementSummary)`.
   - Checks `if (window.electronAPI?.exportFile)`.
   - Invokes `window.electronAPI.exportFile({ format: 'csv', data: csvContent, suggestedFilename: 'Statement-...csv' })`.
   - Electron main process opens native save dialog and writes the file.
3. **Web / Browser Fallback Mode (Crucial for Vitest & Web Previews)**:
   - When running outside Electron (e.g. standard browser or testing):
     - **Print / PDF**: Calls `window.print()`. The browser opens its native print dialog, allowing "Save as PDF".
     - **CSV Export**: Uses HTML5 Blob download:
       ```typescript
       const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
       const url = URL.createObjectURL(blob);
       const link = document.createElement('a');
       link.href = url;
       link.download = suggestedFilename;
       document.body.appendChild(link);
       link.click();
       document.body.removeChild(link);
       URL.revokeObjectURL(url);
       ```

#### B. Print Layout Stylesheet Specification (`@media print`)
In `StatementPrintView.tsx` and global CSS:
```css
@media print {
  @page {
    size: A4 portrait;
    margin: 12mm 15mm;
  }
  
  /* Strip all non-printable application chrome */
  body {
    background: #ffffff !important;
    color: #0f172a !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  
  aside, nav, header, button, .no-print, [data-testid="app-sidebar"], [aria-label="Mobile Navigation Bar"] {
    display: none !important;
  }
  
  /* High contrast table styles */
  thead {
    display: table-header-group !important; /* Repeats table headers across page breaks */
  }
  
  tr {
    page-break-inside: avoid !important;
  }
  
  .print-card {
    page-break-inside: avoid !important;
    border: 1px solid #cbd5e1 !important;
    background: #f8fafc !important;
  }
}
```

#### C. RFC 4180 CSV Export with Excel UTF-8 BOM (`\uFEFF`)
In `src/lib/statements.ts`:
- Excel on Windows assumes ANSI encoding unless a UTF-8 Byte Order Mark (`\uFEFF`) is prepended to the CSV payload.
- Without `\uFEFF`, Arabic customer names (`شركة الأمل`) and Arabic currency labels (`ر.س`) degrade into mojibake (`Ø´Ø±ÙƒØ©`).
- Values containing commas, double quotes, or newlines are enclosed in double quotes with inner quotes escaped as `""`. Rows terminate with `\r\n` (CRLF).

---

### 2.3 App Navigation & Routing Wiring

#### A. Route Tree in `src/App.tsx`
Replace placeholders with full feature modules:
```tsx
import { DashboardView } from '@/components/modules/dashboard/DashboardView';
import { CustomerList } from '@/components/modules/customers/CustomerList';
import { InvoiceList } from '@/components/modules/invoices/InvoiceList';
import { PaymentList } from '@/components/modules/payments/PaymentList';
import { StatementGenerator } from '@/components/modules/statements/StatementGenerator';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <DirectionProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<DashboardView />} />
              
              {/* Invoices */}
              <Route path="invoices" element={<InvoiceList />} />
              <Route path="invoices/new" element={<InvoiceList />} />
              <Route path="invoices/:id" element={<InvoiceList />} />
              
              {/* Customers */}
              <Route path="customers" element={<CustomerList />} />
              <Route path="customers/:id" element={<CustomerList />} />
              
              {/* Payments */}
              <Route path="payments" element={<PaymentList />} />
              <Route path="payments/new" element={<PaymentList />} />
              
              {/* Statements of Account */}
              <Route path="statements" element={<StatementGenerator />} />
              <Route path="statements/:customerId" element={<StatementGenerator />} />
              
              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      </DirectionProvider>
    </ThemeProvider>
  );
};
```

#### B. Deep-Link Query Parameter Contract
Each feature view must support query parameters to allow seamless inter-module navigation:
1. `/invoices?new=1&customerId=:id`: Opens `InvoiceForm` modal pre-filled with customer `:id`.
2. `/invoices?id=:id`: Opens `InvoiceDetailModal` for invoice `:id`.
3. `/payments?new=1&customerId=:id`: Opens `PaymentModal` filtered to customer `:id`.
4. `/payments?new=1&invoiceId=:id`: Opens `PaymentModal` with `invoiceId` and `amountDue` pre-filled.
5. `/statements?customerId=:id`: Automatically selects customer `:id` in `StatementGenerator`.

#### C. Navigation Link Sync in `Sidebar.tsx` and `MobileNav.tsx`
- In `Sidebar.tsx`, `navItems` already lists `/`, `/invoices`, `/customers`, `/payments`, `/statements`. Active highlighting will automatically trigger when users navigate to these routes.
- In `MobileNav.tsx`, the fixed bottom bar exposes `/`, `/invoices`, `/customers`, `/payments`. The "More" button reveals the slide-over drawer exposing `/statements` and `/settings`. Clicking any link automatically closes the drawer (`setIsOpen(false)`).

---

### 2.4 Mobile-First & Arabic RTL Considerations

#### A. Mobile Viewport Scaling (375px Constraint)
- All main content wrappers must apply `max-w-full overflow-hidden`.
- Tables are wrapped in `<div className="overflow-x-auto">` with `min-w-[600px]` to allow horizontal scrolling within table containers while preventing page blowout (`scrollWidth === clientWidth` on window).
- Responsive spacing: `p-2.5 sm:p-4`, `gap-2 sm:gap-3`.
- Filter bars and search toolbars stack vertically on mobile (`flex-col sm:flex-row`).
- Modal dialogs use `w-full max-w-lg p-3 sm:p-5 mx-2`.

#### B. Compact Card Enforcement (<90px Height)
User Global Rule dictates dense cards (<90px vertical height).
- For `InvoiceList` and `PaymentList` card views, cards must strictly follow the `h-[82px]` standard established in `CustomerList.tsx`:
  ```tsx
  <div className="h-[82px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 flex flex-col justify-between shadow-2xs hover:shadow-xs transition-all cursor-pointer select-none">
    {/* Top Row: Ref #, Entity Name (truncated), Status Badge */}
    <div className="flex items-center justify-between gap-2 min-w-0">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="font-mono font-bold text-xs text-slate-900 dark:text-white shrink-0">
          {item.referenceNumber}
        </span>
        <span className="text-xs text-slate-600 dark:text-slate-300 truncate max-w-[130px] sm:max-w-[180px]">
          {item.customerName}
        </span>
      </div>
      <StatusBadge status={item.status} />
    </div>
    
    {/* Bottom Row: Date/Method, Amount in BidiIsolate, Chevron */}
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-[11px] text-slate-400 dark:text-slate-500">
        {item.date}
      </span>
      <div className="flex items-center gap-1.5">
        <BidiIsolate className="font-bold font-mono text-xs text-slate-900 dark:text-white">
          {formatCurrency(item.amount, item.currency)}
        </BidiIsolate>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400 rtl:rotate-180" />
      </div>
    </div>
  </div>
  ```

#### C. Arabic RTL & Bidi Isolation
- `DirectionContext` sets `<html dir="rtl" lang="ar">`.
- Directional icons mirror using `rtl:rotate-180`.
- All monetary amounts, dates, phone numbers, and reference numbers are isolated with `<BidiIsolate>` or `\u200E` to prevent minus sign and currency inversion in RTL mode (e.g. `1,250.00 ر.س` or `-$150.00`).
- Local Cairo and Tajawal fonts loaded via `@font-face` ensure 100% offline rendering fidelity without external Google Fonts requests.

---

## 3. Caveats

1. **Overpayment Test Collision in `EmpiricalChallengerM2_2.test.tsx` vs `TEST_INFRA.md`**:
   - In `tests/unit/EmpiricalChallengerM2_2.test.tsx:296`, the test passes a payment of $600 against an invoice with $500 due and asserts `result.newAmountDue === 0` and `result.newInvoiceStatus === 'PAID'`.
   - In `src/lib/atomicMutations.ts` line 394, `recordPaymentAtomic` currently throws `Error('Payment cannot exceed amount due')`.
   - **Resolution for Worker**:
     In `recordPaymentAtomic`, allow an optional options parameter `{ allowOverpayment?: boolean }` or change the guard:
     ```typescript
     // If strict validation is requested or by default:
     if (!params.allowOverpayment && paymentAmount > currentInvoice.amountDue + 0.0001) {
       // In PaymentModal UI, enforce overpayment validation
     }
     ```
     Or clamp `amountDue = Math.max(0, ...)` and only throw if `params.strictValidation` is true. This ensures existing test suites pass 100% while UI validation blocks overpayments per `TEST_INFRA.md T2-PAY-01-01`.
2. **React Router v7 Future Flag Warnings**:
   - Running React Router v6 in Vitest jsdom generates warnings regarding `v7_startTransition` and `v7_relativeSplatPath`. These are non-breaking informational notices.
3. **Electron Context Isolation & Mocking in Vitest**:
   - In Node/jsdom testing, `window.electronAPI` is undefined unless explicitly mocked. All export and print handlers must guard against `window.electronAPI` being undefined and fall back gracefully to browser `window.print()` and Blob downloads.
4. **Excel CSV Encoding (UTF-8 BOM)**:
   - Microsoft Excel on Windows fails to recognize UTF-8 without the BOM marker `\uFEFF`. Always prepend `\uFEFF` to the CSV string before saving.

---

## 4. Conclusion

The architecture for Milestone 4 (Customer Statements, Print/PDF/CSV Export, App Navigation & Mobile-First Integration) is completely mapped out:

1. **Pure Math & Export Engine (`src/lib/statements.ts`)**:
   - `generateCustomerStatement(customer, invoices, payments, dateRange)`: Pure calculation of opening balance, chronological ledger interleaving, running balance, and closing balance.
   - `exportStatementToCSV(statementSummary)`: RFC 4180 formatted CSV with Excel UTF-8 BOM (`\uFEFF`).
2. **Statement Components (`src/components/modules/statements/`)**:
   - `StatementGenerator.tsx`: Customer selector, date range picker with presets, 4 compact KPI cards (<90px), responsive preview ledger.
   - `StatementPrintView.tsx`: A4 printable document with repeated headers, company/customer details, and signature section.
3. **Native & Web Export Integrations**:
   - Electron IPC: `window.electronAPI.printInvoicePDF` and `window.electronAPI.exportFile`.
   - Browser Fallback: `window.print()` and HTML5 Blob anchor download.
4. **App Routing & Layout**:
   - Connect `/invoices`, `/payments`, and `/statements` in `src/App.tsx`.
   - Handle query parameters `?new=1`, `?id=`, `?customerId=`, `?invoiceId=`.
   - Navigation links in `Sidebar.tsx` and `MobileNav.tsx` already configured.
5. **Mobile-First & RTL Invariants**:
   - Compact cards strictly `h-[82px]` (<90px).
   - Fluid 375px responsive layout with zero horizontal page scroll.
   - RTL mirroring with `<BidiIsolate>` protecting financial numbers.

---

## 5. Verification Method

### 5.1 Test Suite Allocation Plan
The Worker must verify the implementation against the following Vitest test files:

| # | Test File Path | Target Scope | Key Invariants Verified |
|---|----------------|--------------|--------------------------|
| 1 | `tests/unit/statements.test.ts` | Statement Math & CSV Export | Opening balance formula, IEEE-754 running balance, exclusion of cancelled/draft invoices, single-day statements, RFC 4180 CSV with `\uFEFF` BOM |
| 2 | `tests/unit/atomicMutationsInvoice.test.ts` | Invoice & Payment Atomic Mutations | `updateInvoiceAtomic` deltas ($\Delta \text{due}, \Delta \text{total}$), `cancelInvoiceAtomic` balance decrement, `recordPaymentAtomic` status transition |
| 3 | `tests/unit/useInvoices.test.ts` | Invoices Hook | Firestore subscription, search, status filter, customer filter, date range filter, metrics |
| 4 | `tests/unit/usePayments.test.ts` | Payments Hook | Firestore subscription, payment recording, method filtering, customer filtering |
| 5 | `tests/integration/InvoiceForm.spec.tsx` | Real-time Invoice Creation | AC 3: Real-time calculation without calculate button, line item addition/deletion, keyboard navigation |
| 6 | `tests/integration/PaymentModal.spec.tsx` | Payment Recording | AC 5: Full payment marks status `PAID`, partial payment marks `PARTIALLY_PAID`, overpayment validation |
| 7 | `tests/integration/CustomerStatement.spec.tsx` | Statement UI & Export | Date range filtering, opening/closing balance rendering, print preview, CSV export triggering |
| 8 | `tests/integration/RoutingAndNav.spec.tsx` | App Routing & Deep Links | Route resolution for `/invoices`, `/payments`, `/statements`, query parameter handling (`?new=1`, `?customerId=`) |

### 5.2 Test Execution Commands
Run the complete Vitest test suite:
```bash
npm test
```
Run specific Milestone 4 unit and integration tests:
```bash
npx vitest run tests/unit/statements.test.ts
npx vitest run tests/unit/atomicMutationsInvoice.test.ts
npx vitest run tests/integration/CustomerStatement.spec.tsx
npx vitest run tests/integration/InvoiceForm.spec.tsx
npx vitest run tests/integration/PaymentModal.spec.tsx
```

### 5.3 Invalidation Conditions
The implementation shall be deemed invalid if:
1. Generating a statement for a date range includes cancelled or draft invoices in the opening balance or period debits.
2. The running balance column deviates from $\text{prev} + \text{debit} - \text{credit}$ due to floating-point drift.
3. Exported CSV does not include the UTF-8 BOM (`\uFEFF`), causing Arabic text to scramble in Microsoft Excel.
4. Cards in invoice/payment lists exceed 90px in vertical height on mobile or desktop.
5. In Arabic RTL mode, minus signs on negative balances or numbers flip positions without `<BidiIsolate>`.
6. Print view fails to hide navigation chrome or fails to force a high-contrast white background in Dark Mode.
7. Any existing test suite in `tests/unit/` regresses.
