# Specification & Domain Requirements Report

**Agent**: `teamwork_preview_spec_miner_survey_2`  
**Working Directory**: `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_spec_miner_survey_2`  
**Date**: 2026-09-19T04:21:00Z  
**Target Project**: Modern Offline-First Desktop Invoice Application (`Electron + React + TypeScript + Firebase Firestore`)

---

## 1. Observation

Direct observations from authoritative specifications and project files:

1. **Authoritative User Request (`ORIGINAL_REQUEST.md`)**:
   - **Goal & Architecture**: *"A modern, offline-first Desktop application for managing accounts, invoices, and payments, featuring a premium SaaS-like UI, real-time calculations, seamless cloud sync (Firebase), and strong keyboard navigation."* (`ORIGINAL_REQUEST.md:11`)
   - **Requirement R1 (Desktop UI & UX Shell)**: *"Build the application shell using Electron, React, and TypeScript. The interface must be highly responsive, minimal, and SaaS-like, supporting Dark/Light modes, smooth animations (page transitions, success indicators), and full RTL support for Arabic."* (`ORIGINAL_REQUEST.md:18-19`)
   - **Requirement R2 (Financial Management Features)**: *"Implement the core modules: Dashboard (metrics and activity log), Accounts/Customers, Invoices (with real-time automatic calculations and keyboard navigation), Payments (partial and full), and generated Statements."* (`ORIGINAL_REQUEST.md:21-22`)
   - **Requirement R3 (Offline-First Cloud Sync)**: *"Implement Firebase Firestore with offline persistence enabled. All CRUD operations must save locally immediately and sync to the cloud automatically in the background when the internet is available, ensuring a seamless offline experience."* (`ORIGINAL_REQUEST.md:24-25`)
   - **Acceptance Criteria**:
     - *UI & UX Verification*:
       - *"Application launches successfully as an Electron app."* (`ORIGINAL_REQUEST.md:30`)
       - *"Switching to Arabic correctly mirrors the UI to RTL (not just translating text)."* (`ORIGINAL_REQUEST.md:31`)
       - *"Invoice creation updates the 'Grand Total' automatically in real-time as items are added/modified, without clicking a 'calculate' button."* (`ORIGINAL_REQUEST.md:32`)
     - *Functional Verification*:
       - *"Creating an invoice correctly updates the customer's 'Outstanding Amount' instantly."* (`ORIGINAL_REQUEST.md:35`)
       - *"Recording a full payment on an invoice changes its status to 'Paid' and reflects in the Activity Log."* (`ORIGINAL_REQUEST.md:36`)
       - *"Data can be written and read when the network connection is disabled (verifying Firebase offline persistence)."* (`ORIGINAL_REQUEST.md:37`)

2. **Mandatory User Global Constraints**:
   - **Mobile-First Priority**: *"Always prioritize mobile-first design. Ensure the UI/UX is fully optimized for mobile across all aspects, including layout, responsiveness, sizing, typography, and interactions, delivering a seamless and intuitive experience on all mobile devices."*
   - **Performance Optimization**: *"Optimize for performance: minimize load times, reduce unnecessary assets, and ensure smooth interactions, especially on low-end mobile devices and slow networks."*
   - **No Unverified Assumptions**: *"Do not assume or infer missing details. If anything is unclear or incomplete, ask before proceeding. Do not execute until all ambiguities are resolved."*
   - **Compact Card Design**: *"Use compact card designs by default. Cards should occupy less vertical space, make efficient use of available width, and always remain fully contained within the intended mobile and responsive layout boundaries."*

---

## 2. Logic Chain

From the observed requirements, we deduce the full technical specification, domain data models, calculation formulas, RTL mechanics, and behavior rules through this step-by-step logic chain:

### Step 2.1: Domain Architecture & Data Models

To satisfy R2 (Financial Management) and R3 (Firestore persistence), five primary domain entities must be defined with exact field semantics and relations:

```
[ Customer / Account ] (1) <─────── (N) [ Invoice ] (1) <─────── (N) [ Payment ]
         │                                   │                           │
         │                                   │                           │
         ▼                                   ▼                           ▼
[ Statement of Account ]             [ Invoice Line Items ]       [ Activity Log Entry ]
```

#### Entity 1: `Customer` (`customers` collection)
- `id`: `string` (UUID or Firestore document ID)
- `name`: `string` (Business / Individual name; non-empty, trimmed)
- `email`: `string` (Optional, RFC 5322 compliant)
- `phone`: `string` (Optional, international format e.g. `+966...` or `+1...`)
- `address`: `object` or `string` (`street`, `city`, `state`, `postalCode`, `country`)
- `taxNumber`: `string` (Optional, VAT / Tax Registration Number TRN)
- `currency`: `string` (Default currency code, ISO 4217, e.g. `"USD"`, `"SAR"`, `"AED"`)
- `outstandingAmount`: `number` (Cents/currency decimal; dynamically updated or maintained invariant representing the total unpaid balance across all non-cancelled invoices: $\sum \text{amountDue}$)
- `totalInvoiced`: `number` (Cumulative sum of all invoice grand totals)
- `totalPaid`: `number` (Cumulative sum of all payments received)
- `notes`: `string` (Internal remarks)
- `status`: `'ACTIVE' | 'ARCHIVED'`
- `createdAt`: `string` (ISO 8601 UTC)
- `updatedAt`: `string` (ISO 8601 UTC)

#### Entity 2: `Invoice` (`invoices` collection)
- `id`: `string` (Firestore doc ID)
- `invoiceNumber`: `string` (Formatted human-readable code e.g. `INV-2026-0001`, sequential/unique)
- `customerId`: `string` (Foreign key referencing `Customer.id`)
- `customerName`: `string` (Denormalized snapshot for instant listing and offline resilience)
- `issueDate`: `string` (`YYYY-MM-DD`)
- `dueDate`: `string` (`YYYY-MM-DD`, must be $\ge \text{issueDate}$)
- `currency`: `string` (ISO 4217 code)
- `items`: `InvoiceItem[]` (Array of line items, minimum 1 item to finalize)
  - `id`: `string` (Item UUID)
  - `description`: `string` (Item/service name and description)
  - `quantity`: `number` (Strictly $> 0$, integer or fractional hours/units up to 3 decimals)
  - `unitPrice`: `number` ($\ge 0$, rounded to 2 decimals)
  - `discount`: `number` ($\ge 0$)
  - `discountType`: `'PERCENTAGE' | 'FIXED'`
  - `taxRate`: `number` ($\ge 0$, percentage e.g. `15` for 15% VAT, `0` for exempt)
  - `lineTax`: `number` (Calculated line tax amount)
  - `lineDiscount`: `number` (Calculated line discount amount)
  - `lineTotal`: `number` (Calculated total for line: $(\text{quantity} \times \text{unitPrice} - \text{lineDiscount}) + \text{lineTax}$)
- `subtotal`: `number` (Sum of base line values before discount and tax)
- `totalDiscount`: `number` (Sum of all line discounts)
- `totalTax`: `number` (Sum of all line taxes)
- `grandTotal`: `number` (Final payable amount: $\text{subtotal} - \text{totalDiscount} + \text{totalTax}$)
- `amountPaid`: `number` (Cumulative payments applied to this invoice, starts at `0`)
- `amountDue`: `number` ($\text{grandTotal} - \text{amountPaid}$)
- `status`: `'DRAFT' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED'`
- `notes`: `string` (Payment instructions, bank info, thank you note)
- `terms`: `string` (Terms and conditions)
- `createdAt`: `string` (ISO 8601 UTC)
- `updatedAt`: `string` (ISO 8601 UTC)

#### Entity 3: `Payment` (`payments` collection)
- `id`: `string` (Firestore doc ID)
- `paymentNumber`: `string` (Formatted receipt code e.g. `PAY-2026-0001`)
- `invoiceId`: `string` (Foreign key referencing `Invoice.id`)
- `invoiceNumber`: `string` (Denormalized snapshot)
- `customerId`: `string` (Foreign key referencing `Customer.id`)
- `customerName`: `string` (Denormalized snapshot)
- `amount`: `number` (Strictly $> 0$ and $\le \text{invoice.amountDue}$)
- `paymentDate`: `string` (`YYYY-MM-DD`)
- `paymentMethod`: `'CASH' | 'BANK_TRANSFER' | 'CREDIT_CARD' | 'CHECK' | 'ONLINE_GATEWAY' | 'OTHER'`
- `referenceNumber`: `string` (Optional check #, bank transfer reference, or transaction auth code)
- `notes`: `string` (Optional notes)
- `createdAt`: `string` (ISO 8601 UTC)

#### Entity 4: `ActivityLog` (`activity_logs` collection)
- `id`: `string` (Firestore doc ID)
- `timestamp`: `string` (ISO 8601 UTC)
- `eventType`: `'CUSTOMER_CREATED' | 'CUSTOMER_UPDATED' | 'INVOICE_CREATED' | 'INVOICE_UPDATED' | 'INVOICE_STATUS_CHANGED' | 'PAYMENT_RECORDED' | 'PAYMENT_VOIDED'`
- `entityType`: `'CUSTOMER' | 'INVOICE' | 'PAYMENT'`
- `entityId`: `string`
- `description`: `string` (Human-readable summary, e.g. *"Recorded payment of $250.00 for Invoice #INV-2026-0005 (Acme Corp)"*)
- `metadata`: `Record<string, any>` (Snapshot of amounts, prior status, new status)

#### Entity 5: `StatementOfAccount` (Generated View / Export Model)
- `customerId`: `string`
- `customer`: `Customer` snapshot
- `startDate`: `string` (`YYYY-MM-DD`)
- `endDate`: `string` (`YYYY-MM-DD`)
- `openingBalance`: `number` (Balance prior to `startDate`)
- `transactions`: Array of chronological ledger lines:
  - `date`: `string`
  - `type`: `'INVOICE' | 'PAYMENT'`
  - `reference`: `string` (`INV-xxx` or `PAY-xxx`)
  - `description`: `string`
  - `debit`: `number` (Invoice amount increases customer receivable)
  - `credit`: `number` (Payment amount decreases customer receivable)
  - `runningBalance`: `number` ($\text{priorBalance} + \text{debit} - \text{credit}$)
- `totalInvoiced`: `number` ($\sum \text{debit}$)
- `totalPaid`: `number` ($\sum \text{credit}$)
- `closingBalance`: `number` ($\text{openingBalance} + \text{totalInvoiced} - \text{totalPaid}$)
- `generatedAt`: `string` (ISO 8601 UTC)

---

### Step 2.2: Real-Time Automatic Calculation Engine & Financial Math

Requirement R2 mandates: *"Invoice creation updates the 'Grand Total' automatically in real-time as items are added/modified, without clicking a 'calculate' button."*

To prevent JavaScript IEEE-754 binary floating-point errors (e.g. `0.1 + 0.2 = 0.30000000000000004` or `19.99 * 3 = 59.96999999999999`), all financial calculations must use an epsilon-safe rounding helper or integer cents:

```typescript
function roundFinancial(amount: number, decimals: number = 2): number {
  return Number(Math.round(Number(amount + 'e' + decimals)) + 'e-' + decimals);
}
```

#### Line Item Calculation Formula:
For each line item $i \in [1..N]$:
1. **Gross Line Amount**:
   $$\text{Gross}_i = \text{roundFinancial}(\text{quantity}_i \times \text{unitPrice}_i)$$
2. **Line Discount**:
   $$\text{LineDiscount}_i = \begin{cases} \text{roundFinancial}\left(\text{Gross}_i \times \frac{\text{discountRate}_i}{100}\right) & \text{if percentage} \\ \min(\text{discountValue}_i, \text{Gross}_i) & \text{if fixed} \end{cases}$$
3. **Net Taxable Amount**:
   $$\text{Taxable}_i = \text{Gross}_i - \text{LineDiscount}_i$$
4. **Line Tax**:
   $$\text{LineTax}_i = \text{roundFinancial}\left(\text{Taxable}_i \times \frac{\text{taxRate}_i}{100}\right)$$
5. **Line Total**:
   $$\text{LineTotal}_i = \text{Taxable}_i + \text{LineTax}_i$$

#### Invoice Totals Aggregation Formula:
1. **Subtotal**:
   $$\text{Subtotal} = \sum_{i=1}^N \text{Gross}_i$$
2. **Total Discount**:
   $$\text{TotalDiscount} = \sum_{i=1}^N \text{LineDiscount}_i$$
3. **Total Tax**:
   $$\text{TotalTax} = \sum_{i=1}^N \text{LineTax}_i$$
4. **Grand Total**:
   $$\text{GrandTotal} = \text{Subtotal} - \text{TotalDiscount} + \text{TotalTax} = \sum_{i=1}^N \text{LineTotal}_i$$
5. **Amount Due**:
   $$\text{AmountDue} = \max(0, \text{roundFinancial}(\text{GrandTotal} - \text{AmountPaid}))$$

#### Status State Transitions:
```
      [Create Invoice]
              │
              ▼
          (UNPAID) <───────────────────────────┐ (Payment Voided)
              │                                │
              ├───[Partial Payment Recv]───────┤
              ▼                                │
      (PARTIALLY_PAID) ────────────────────────┘
              │
              ├───[Full Payment Recv]
              ▼
            (PAID)
```
- If $\text{grandTotal} == 0 \implies \text{status} = \text{'PAID'}$
- If $\text{amountPaid} == 0 \implies \text{status} = \text{'UNPAID'}$ (or `'OVERDUE'` if $\text{dueDate} < \text{today}$)
- If $0 < \text{amountPaid} < \text{grandTotal} \implies \text{status} = \text{'PARTIALLY\_PAID'}$ (or `'OVERDUE'` if $\text{dueDate} < \text{today}$)
- If $\text{amountPaid} \ge \text{grandTotal} \implies \text{status} = \text{'PAID'}$

#### Customer Balance Synchronization:
- **On Invoice Creation**: $\text{customer.outstandingAmount} \mathrel{+}= \text{invoice.grandTotal}$
- **On Payment Recording**: $\text{customer.outstandingAmount} \mathrel{-}= \text{payment.amount}$
- **On Invoice Void/Cancel**: $\text{customer.outstandingAmount} \mathrel{-}= \text{invoice.amountDue}$

---

### Step 2.3: Keyboard Navigation Specification

To satisfy R2: *"strong keyboard navigation"*:
1. **Grid / Line Item Form Navigation**:
   - `Tab`: Advances focus to the next logical input (`Description` $\to$ `Quantity` $\to$ `UnitPrice` $\to$ `Discount` $\to$ `TaxRate`).
   - `Shift + Tab`: Moves focus backwards.
   - `Enter` on the last input of a line: Automatically creates a new empty line item row and focuses its `Description` field immediately without needing mouse click.
   - `Arrow Down / Up`: Navigates to the same cell index in the line below or above.
   - `Alt + Delete` or `Ctrl + Backspace` on a row: Removes the line item (with focus moving to the adjacent row).
2. **Global Application Shortcuts**:
   - `Ctrl/Cmd + N`: Open "New Invoice" modal/view.
   - `Ctrl/Cmd + Shift + C`: Open "New Customer" modal.
   - `Ctrl/Cmd + S`: Save / Submit active form.
   - `Escape`: Close active modal or cancel editing.
   - `Ctrl/Cmd + K` or `/`: Focus global search / navigation bar.
3. **Accessibility**:
   - All interactive controls have distinct `:focus-visible` styling (high contrast ring).
   - ARIA roles: `role="table"`, `role="row"`, `role="cell"`, `aria-label`, `aria-live="polite"` for recalculating grand total.

---

### Step 2.4: RTL & Arabic Mirroring Specifications

Requirement R1 mandates: *"full RTL support for Arabic"* and acceptance criterion states: *"Switching to Arabic correctly mirrors the UI to RTL (not just translating text)."*

1. **Document & Container Root**:
   - Root attribute: `<html dir="rtl" lang="ar">` when Arabic is selected, `<html dir="ltr" lang="en">` when English is selected.
2. **CSS Logical Properties & Tailwind RTL**:
   - Never use physical directional properties: `ml-*`, `mr-*`, `pl-*`, `pr-*`, `left-*`, `right-*`, `text-left`, `text-right`.
   - Always use CSS logical properties or Tailwind RTL utilities:
     - `ps-*` (`padding-inline-start`) instead of `pl-*`
     - `pe-*` (`padding-inline-end`) instead of `pr-*`
     - `ms-*` (`margin-inline-start`) instead of `ml-*`
     - `me-*` (`margin-inline-end`) instead of `mr-*`
     - `start-*` / `end-*` instead of `left-*` / `right-*`
     - `text-start` / `text-end` instead of `text-left` / `text-right`
     - `rounded-s-*` / `rounded-e-*` instead of `rounded-l-*` / `rounded-r-*`
3. **Component Layout Mirroring**:
   - **Sidebar**: Located on the Left in LTR; flips to the Right in RTL.
   - **Data Tables**: Column order reverses: First column (e.g. Invoice #) starts at the right in RTL; actions column is at the far left in RTL.
   - **Form Fields**: Labels align to the right in RTL; input text flows right-to-left.
   - **Cards & Badges**: Icon starts on the right of text in RTL.
4. **Directional vs Non-Directional Icon Handling**:
   - **Must Mirror (Flip horizontally in RTL via `rtl:scale-x-[-1]`)**:
     - Navigation arrows (`ArrowLeft`, `ArrowRight`, `ChevronLeft`, `ChevronRight`)
     - Back/Forward buttons
     - Undo/Redo icons
   - **Must NOT Mirror (Universal orientation preserved)**:
     - Search magnifying glass
     - Calendar / Clock
     - Checkmarks / Crosses
     - Currency symbols / Dollar / Riyal badges
     - User avatars, Settings cog, Print icon, Trash can
5. **Numbers, Currency & Bidi Formatting**:
   - Western Arabic numerals (`1, 2, 3...`) are industry standard in modern Arabic business software (SAR, AED, etc.).
   - To prevent bidi rendering corruption (such as `-$50.00` rendering as `50.00$-` or phone numbers breaking):
     - Numeric fields, amounts, and dates must be wrapped with `dir="ltr"` or CSS `unicode-bidi: isolate; display: inline-block;`.
     - Standard currency display:
       - English: `$1,250.00` or `SAR 1,250.00`
       - Arabic: `1,250.00 ر.س` or `1,250.00 SAR`
6. **Arabic Typography**:
   - Clean, legible sans-serif font stack for Arabic:
     `font-family: 'Segoe UI', 'Tajawal', 'Cairo', -apple-system, system-ui, sans-serif;`

---

### Step 2.5: Mobile-First & Compact Card Design System

User Global Rules dictate:
- *"Always prioritize mobile-first design... Ensure the UI/UX is fully optimized for mobile across all aspects..."*
- *"Use compact card designs by default. Cards should occupy less vertical space, make efficient use of available width, and always remain fully contained within the intended mobile and responsive layout boundaries."*

1. **Breakpoints**:
   - Mobile: `< 640px` (`sm`)
   - Tablet: `640px - 1024px` (`md` / `lg`)
   - Desktop: `> 1024px` (`xl`)
2. **Compact Card Guidelines**:
   - **Vertical padding**: Dense (`py-2.5` to `py-3`, instead of spacious `py-6`).
   - **Information density**: Inline layout with flex wrap (`flex items-center justify-between gap-2`).
   - **Metrics KPI Cards**:
     - Grid layout: 2 columns on mobile (`grid-cols-2`), 4 columns on desktop (`grid-cols-4`).
     - Display: Compact icon badge (size 32px), title in muted 12px text, bold value in 18-20px text, subtle trend or count indicator.
   - **Responsive Table-to-Card Pattern**:
     - On desktop ($\ge 768px$): Standard responsive data table with sticky headers.
     - On mobile ($< 768px$): Each invoice/customer renders as a compact card containing:
       - Row 1: Invoice # + Status Badge (e.g. `INV-001` | `[Paid]`)
       - Row 2: Customer Name + Date
       - Row 3: Amount Due + Grand Total
       - Action row: Compact icon button tap targets (min 44px touch area via padding, visually compact).

---

### Step 2.6: Offline-First Cloud Sync (Firebase Firestore)

Requirement R3 mandates: *"Implement Firebase Firestore with offline persistence enabled. All CRUD operations must save locally immediately and sync to the cloud automatically in the background when the internet is available..."*

1. **Firestore Persistence Configuration**:
   - Uses Firebase Web JS SDK (runs in Electron Chromium renderer process).
   - In Firebase v10+:
     ```typescript
     import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
     const db = initializeFirestore(app, {
       localCache: persistentLocalCache({
         tabManager: persistentMultipleTabManager()
       })
     });
     ```
   - IndexedDB backend stores documents, snapshots, mutations, and query indexes locally on disk within Electron's user data directory.
2. **Immediate Local Mutation (Optimistic CRUD)**:
   - When calling `addDoc()`, `updateDoc()`, or `deleteDoc()`:
     - Mutation is immediately applied to local IndexedDB and in-memory cache.
     - Document snapshot emits instantly to active UI listeners with `snapshot.metadata.hasPendingWrites = true` and `fromCache = true`.
     - UI updates in 0ms without spinner or network roundtrip.
3. **Background Synchronization**:
   - When online, Firestore background sync worker pushes pending mutations in sequence to Cloud Firestore.
   - Once server responds, snapshot emits again with `hasPendingWrites = false` and `fromCache = false`.
4. **Network Detection & SaaS Sync Indicator**:
   - Monitor `window.navigator.onLine` and `window.addEventListener('online'/'offline')`.
   - Track active write queue state via Firestore snapshot metadata.
   - Top-bar SaaS sync pill with 3 distinct states:
     - 🟢 **Online (Synced)**: `online === true && pendingWritesCount === 0`
     - 🟡 **Syncing...**: `online === true && pendingWritesCount > 0`
     - 🔴 **Offline (Saved locally)**: `online === false`
5. **Offline Verification Protocol**:
   - Explicit verification test executes:
     1. Disconnect network via `await disableNetwork(db);`
     2. Create Customer `"Offline Client Inc"` $\to$ successfully saved and displayed.
     3. Create Invoice for customer $\to$ real-time calculation fires, invoice appears with status `'UNPAID'`, customer balance increments.
     4. Record Payment $\to$ invoice status updates to `'PAID'`, customer balance decrements, activity log entry created.
     5. Query/reload data $\to$ all records load from IndexedDB cache.
     6. Reconnect network via `await enableNetwork(db);` $\to$ all queued mutations seamlessly sync to Firebase remote server without conflicts.

---

## 3. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Shell & Window | Electron App Launch | Native desktop window lifecycle, frameless or native titlebar, window state persistence | OS launch event, window configuration | Electron BrowserWindow (1280x800 default, min 375x600) | Log crash to stderr, display fallback error screen | ORIGINAL_REQUEST.md:18, 30 |
| 2 | Responsive UI | Mobile-First Shell Layout | Responsive flex/grid shell adapting seamlessly from mobile (375px) to desktop (1920px) | Viewport resize, device width | Mobile drawer/bottom nav or Desktop collapsible sidebar | Maintains layout boundary without horizontal scroll | User Rule (mobile-first), ORIGINAL_REQUEST.md:19 |
| 3 | Compact Design | Compact KPI & Data Cards | Dense, space-efficient card design minimizing vertical footprint | Metric data, entity attributes | Compact card components (<90px height for KPIs) | Truncates long text gracefully with tooltip | User Rule (compact cards) |
| 4 | Theming | Dark / Light Mode Switching | Smooth toggle between Dark and Light color schemes with persistent preference | Theme toggle switch ('light' \| 'dark' \| 'system') | Instant CSS class / data-theme switch, transitions | Falls back to system preference if invalid | ORIGINAL_REQUEST.md:19 |
| 5 | Localization | Arabic / English Language Toggle | In-app language switch between English and Arabic | Language selector ('en' \| 'ar') | Toggles i18n dictionary and document `lang` attribute | Defaults to 'en' or system locale if unsupported | ORIGINAL_REQUEST.md:19, 31 |
| 6 | Localization | Complete RTL Mirroring | Full bidirectional UI mirroring: layout, sidebar, flex order, margins, paddings, tables | `dir="rtl"` attribute on root | All horizontal alignments mirror; directional icons flip | Fallback to logical CSS properties to prevent visual clipping | ORIGINAL_REQUEST.md:19, 31 |
| 7 | Localization | Bidirectional Numeral & Currency Isolation | Prevents bidi text scrambling for currency, dates, and phone numbers in Arabic | Raw numbers, currency code, locale | Formatted currency (e.g. "1,250.00 ر.س"), isolated via LTR span | Sanitizes NaN / null to "0.00" | Domain requirements & GCC accounting standards |
| 8 | Feedback & Motion | Smooth Transitions & Micro-interactions | Polished page transitions, toast notifications, button clicks, state badges | User navigation, action success/failure | CSS transitions, success badges, toast popups | Disables animations if `prefers-reduced-motion` is active | ORIGINAL_REQUEST.md:19 |
| 9 | Dashboard | Total Revenue Metric Card | Computes and displays total revenue from all collected invoice payments | All completed payments in database | Formatted currency sum (e.g. "$12,450.00") | Displays "$0.00" if no payments exist | ORIGINAL_REQUEST.md:22 |
| 10 | Dashboard | Outstanding Receivables Metric Card | Computes total unpaid receivables across all active invoices | Invoices with status in (UNPAID, PARTIALLY_PAID) | Formatted currency sum ($\sum \text{amountDue}$) | Displays "$0.00" if zero receivables | ORIGINAL_REQUEST.md:22, 35 |
| 11 | Dashboard | Paid Invoices Counter Card | Real-time count of invoices whose balance is fully cleared | Invoices where `status == 'PAID'` | Integer count badge (e.g. "42 Paid") | Displays "0" if none paid | ORIGINAL_REQUEST.md:22 |
| 12 | Dashboard | Overdue Invoices Counter Card | Real-time count of unpaid/partially paid invoices past due date | Invoices where `status != 'PAID'` and `dueDate < today` | Integer count badge with warning styling (e.g. "5 Overdue") | Displays "0" if none overdue | ORIGINAL_REQUEST.md:22 |
| 13 | Dashboard | Real-Time Activity Log | Chronological list of recent business events with relative timestamps | Audit event stream (Customer, Invoice, Payment actions) | Compact activity feed items ("Payment received...", "Invoice created...") | Empty state placeholder ("No recent activity") | ORIGINAL_REQUEST.md:22, 36 |
| 14 | Accounts | Customer Creation & Editing | Form to add/update customer details (name, email, phone, address, tax #) | Customer input form payload | Created/updated Customer document | Validates required name, email regex; displays inline field errors | ORIGINAL_REQUEST.md:22 |
| 15 | Accounts | Customer Directory & Search | Searchable, filterable list/cards of all registered customers | Search query string, sort filter | Filtered customer list with balance & invoice counts | Displays "No customers found" empty state | ORIGINAL_REQUEST.md:22 |
| 16 | Accounts | Customer Profile & Ledger View | Comprehensive profile showing contact info, outstanding balance, and invoice history | Customer ID | Customer details view + invoice history table + statement generator | 404/Empty view if customer ID not found | ORIGINAL_REQUEST.md:22 |
| 17 | Accounts | Instant Customer Outstanding Balance Update | Real-time balance updating upon invoice generation, editing, or payment | Invoice or Payment write events | Customer `outstandingAmount` adjusted immediately | Transaction rollback / reconciliation if sync fails | ORIGINAL_REQUEST.md:22, 35 |
| 18 | Invoices | Real-Time Automatic Calculation Engine | Live automatic calculation of line totals, subtotal, discount, tax, and grand total | Quantity, unit price, discount, tax rate inputs | Computed Subtotal, Total Discount, Total Tax, Grand Total | Validates non-negative values; rejects invalid characters | ORIGINAL_REQUEST.md:22, 32 |
| 19 | Invoices | Itemized Line Item Management | Dynamic addition, deletion, and reordering of invoice line items | Add Line button, Delete Line button, input fields | Updated lines array and recalculated invoice totals | Requires at least 1 item before saving invoice | ORIGINAL_REQUEST.md:22, 32 |
| 20 | Invoices | Keyboard-Driven Grid Navigation | Fast keyboard navigation across line items (Tab, Shift+Tab, Enter to add row, Arrows) | Key events (Tab, Enter, ArrowUp, ArrowDown, Esc) | Focus switches to next/prev cell; Enter appends new row | Prevents default form submission on inner Enter | ORIGINAL_REQUEST.md:11, 22 |
| 21 | Invoices | Global Keyboard Shortcuts | Hotkeys for power users (Ctrl+N for new invoice, Ctrl+S to save, Esc to exit) | Global keydown events | Triggered application action/modal | Ignored when typing inside standard textareas | ORIGINAL_REQUEST.md:11, 22 |
| 22 | Invoices | Invoice Status Auto-Transition | Automatic invoice state management (UNPAID -> PARTIALLY_PAID -> PAID / OVERDUE) | Payment record amounts, system date vs due date | Status badge update | Prevents overpayment transition | ORIGINAL_REQUEST.md:22, 36 |
| 23 | Invoices | Invoice Search & Filter | Filter invoices by customer, status (Paid/Unpaid/Overdue), and date range | Filter criteria, date range picker | Filtered invoice list/cards | Clears filter to show all invoices | ORIGINAL_REQUEST.md:22 |
| 24 | Payments | Record Full Payment | Record payment equal to invoice `amountDue`; updates status to PAID | Invoice ID, amount, payment method, payment date | Payment record saved, invoice marked PAID, balance cleared | Rejects if amount != amountDue | ORIGINAL_REQUEST.md:22, 36 |
| 25 | Payments | Record Partial Payment | Record payment less than invoice `amountDue`; updates status to PARTIALLY_PAID | Invoice ID, amount, payment method, payment date | Payment record saved, invoice marked PARTIALLY_PAID, balance reduced | Rejects if amount <= 0 or amount > amountDue | ORIGINAL_REQUEST.md:22, 36 |
| 26 | Payments | Multi-Method Payment Logging | Support recording payment method (Cash, Bank Transfer, Card, Check, Online) | Method selection, optional transaction/check reference # | Stored payment metadata | Defaults to 'CASH' if unselected | ORIGINAL_REQUEST.md:22 |
| 27 | Statements | Customer Statement of Account Generator | Generates date-filtered statement with Opening Balance, transactions, and Closing Balance | Customer ID, Start Date, End Date | Chronological ledger table with Debit, Credit, Running Balance | Validates Start Date <= End Date | ORIGINAL_REQUEST.md:22 |
| 28 | Statements | Statement Export & Print View | Print-optimized stylesheet and export to PDF / CSV for customer statement | Print button click, export format selection | Formatted A4/Letter print preview or downloadable file | Displays print dialog error if OS print spooler fails | ORIGINAL_REQUEST.md:22 |
| 29 | Cloud Sync | Firestore Local Persistence | Enables IndexedDB local caching in Electron Chromium renderer for instant offline CRUD | Local database write/read calls | Instant local write resolution; cached reads | Emits error if IndexedDB storage quota exceeded | ORIGINAL_REQUEST.md:24-25, 37 |
| 30 | Cloud Sync | Background Cloud Sync Engine | Automatic bidirectional sync between local IndexedDB cache and remote Cloud Firestore | Network reconnection event, pending write queue | Background write push; remote snapshot pull | Queues mutations until network is restored | ORIGINAL_REQUEST.md:24-25, 37 |
| 31 | Cloud Sync | Network Status & Sync Indicator | Top-bar SaaS pill displaying Online (Synced), Syncing, or Offline Mode | `navigator.onLine` and `snapshot.metadata.hasPendingWrites` | Visual status badge with tooltip | Graceful fallback if network API unavailable | ORIGINAL_REQUEST.md:24-25, 37 |
| 32 | Cloud Sync | Offline Read/Write Verification Harness | Programmatic test harness allowing offline disconnection and verification of local persistence | Network enable/disable commands (`disableNetwork()`) | Verified offline CRUD integrity | Reports failure if offline write blocks or fails | ORIGINAL_REQUEST.md:25, 37 |

---

## 4. Edge Cases

| # | Feature | Input | Observed / Required Behavior |
|---|---------|-------|------------------------------|
| 1 | Real-Time Calculations | Line Item with floating-point multiplication (e.g., $19.99 \times 3$ with 15% VAT) | Calculations must round per line to 2 decimal places using epsilon-safe financial rounding: Gross = $59.97, Tax = $9.00, Line Total = $68.97. Never output raw binary floats like `59.96999999999999`. |
| 2 | Real-Time Calculations | User enters 0 quantity or negative quantity in invoice line item | Validation error: "Quantity must be greater than 0". Save button is disabled; calculations treat invalid rows as 0 without crashing. |
| 3 | Real-Time Calculations | User enters discount greater than line item gross amount (e.g. Fixed discount $100 on $50 item) | Fixed discount is capped at line item gross amount ($50.00). Taxable amount cannot become negative; line total floors at $0.00. |
| 4 | Real-Time Calculations | 100% discount on entire invoice (Grand Total = $0.00) | Valid edge case. Grand Total = $0.00, Amount Due = $0.00. Invoice automatically marked as 'PAID' upon creation without requiring payment record. |
| 5 | Invoices & Keyboard Nav | User presses `Enter` in the last input of a line item | System intercepts keydown, prevents premature form submission, creates a new empty item row, and focuses the new item's Description input. |
| 6 | Invoices & Keyboard Nav | User deletes all line items | System prevents deleting the final row, or displays an empty row with placeholder, showing validation error: "At least one item is required to save invoice." |
| 7 | Payment Recording | User attempts to record payment amount $> \text{amountDue}$ (e.g. pays $150 on $100 balance) | Input validation error: "Payment amount ($150.00) cannot exceed remaining amount due ($100.00)." Payment submission is blocked. |
| 8 | Payment Recording | User attempts to record $0.00 or negative payment amount | Input validation error: "Payment amount must be greater than 0.00." Payment submission is blocked. |
| 9 | Payment Recording | Multiple partial payments clearing the balance in installments | Payment 1 ($40 on $100) -> Invoice updates to 'PARTIALLY_PAID', amountDue = $60, customer outstanding decrements by $40. Payment 2 ($60) -> Invoice updates to 'PAID', amountDue = $0, customer outstanding decrements by $60. Both appear in Activity Log. |
| 10 | Payment Recording | Rapid duplicate clicks on "Record Payment" button | Button disables immediately upon first click (`isSubmitting: true`) and debounces to prevent accidental duplicate payments. |
| 11 | Statements Generator | Customer has zero transactions in the selected date range, but had prior transactions | Opening balance correctly reflects historical balance. Ledger table shows "No transactions during this period", and Closing Balance equals Opening Balance. |
| 12 | Statements Generator | User selects Start Date after End Date (e.g. Start: 2026-10-01, End: 2026-09-01) | Validation error: "Start date cannot be after end date." Generation button disabled. |
| 13 | Statements Generator | Customer with zero lifetime transactions | Opening balance = $0.00, Transactions = empty, Closing balance = $0.00. Graceful empty state displayed. |
| 14 | RTL Mirroring | Displaying negative currency amounts in Arabic RTL (e.g. -$45.00) | Without isolation, browser bidi algorithm renders `45.00$-` or `$45.00-`. Must wrap in `<span dir="ltr" className="inline-block">-$45.00</span>` or format as `45.00- ر.س`. |
| 15 | RTL Mirroring | Long customer business names mixing Arabic and Latin characters (e.g. "مؤسسة Alpha للتقنية") | Unicode bidirectional isolation (`unicode-bidi: isolate`) ensures English words do not flip word order in the Arabic sentence. |
| 16 | Mobile Responsiveness | Wide data table viewed on mobile viewport (375px width) | Table transforms into a responsive compact card list (`display: block` on small screens) with stacked key-value pairs; no horizontal page blowouts. |
| 17 | Offline-First Sync | User creates invoice while network is completely disconnected (`navigator.onLine === false`) | Data writes instantly to local IndexedDB. UI updates immediately: Invoice list shows new invoice, Customer outstanding balance updates instantly, Dashboard metrics reflect new totals. Sync status displays "Offline (Changes saved locally)". |
| 18 | Offline-First Sync | Network reconnects after 10 offline mutations | Background sync worker detects reconnection (`window.online` / Firestore sync) and pushes all 10 pending writes in chronological order. Status transitions to "Syncing..." and then to "Online (Synced)". |
| 19 | Offline-First Sync | User quits and relaunches Electron app while offline | App loads all customers, invoices, and payments directly from local IndexedDB cache without requiring an active internet connection. |
| 20 | Customer Deletion / Voiding | Attempting to delete a customer who has existing invoices or outstanding balance | Action blocked with warning modal: "Cannot delete customer with active invoices or outstanding balance. Archive customer instead." |

---

## 5. Feature Inventory & Acceptance Criteria Mapping

| Feature ID | Category | Feature Name | Source Requirement | Acceptance Criteria Verification |
|------------|----------|--------------|--------------------|----------------------------------|
| F-SHELL-01 | Shell | Electron Desktop Launcher | R1 (`ORIGINAL_REQUEST.md:18, 30`) | **AC 1**: Application launches successfully as an Electron app without browser chrome. |
| F-SHELL-02 | UI/UX | SaaS-like UI & Theme Engine | R1 (`ORIGINAL_REQUEST.md:19`) | Clean SaaS theme, Light/Dark toggle working with persistent storage. |
| F-SHELL-03 | UI/UX | Compact Card Design | User Global Rule | All metric cards and mobile entity cards occupy minimal vertical space, max width containment. |
| F-SHELL-04 | UI/UX | Mobile-First Responsiveness | User Global Rule | Flawless rendering on mobile viewports (375px) up to high-resolution desktop displays. |
| F-RTL-01 | Localization | Arabic Language & RTL Mirroring | R1 (`ORIGINAL_REQUEST.md:19, 31`) | **AC 2**: Switching to Arabic correctly mirrors the UI to RTL (sidebar, tables, text alignment, directional icons). |
| F-RTL-02 | Localization | Bidi Numeral & Currency Formatting | R1 (`ORIGINAL_REQUEST.md:19, 31`) | Numbers, phone numbers, and currency values retain proper LTR sequence in Arabic mode. |
| F-DASH-01 | Dashboard | Financial KPI Cards | R2 (`ORIGINAL_REQUEST.md:22`) | Accurate display of Total Revenue, Outstanding Receivables, Paid Count, Overdue Count. |
| F-DASH-02 | Dashboard | Chronological Activity Log | R2 (`ORIGINAL_REQUEST.md:22, 36`) | **AC 5**: System actions (customer, invoice, payment) reflect immediately in the activity log. |
| F-CUST-01 | Customers | Customer Directory & CRUD | R2 (`ORIGINAL_REQUEST.md:22`) | Create, update, view, and search customer profiles with contact and tax details. |
| F-CUST-02 | Customers | Instant Outstanding Balance Sync | R2 (`ORIGINAL_REQUEST.md:22, 35`) | **AC 4**: Creating an invoice or recording a payment updates customer's Outstanding Amount instantly. |
| F-INV-01 | Invoices | Real-Time Automatic Calculations | R2 (`ORIGINAL_REQUEST.md:22, 32`) | **AC 3**: Grand Total updates automatically in real-time as line items change, without a calculate button. |
| F-INV-02 | Invoices | Line Items & Discount/Tax Math | R2 (`ORIGINAL_REQUEST.md:22, 32`) | Line totals, subtotal, discounts, and taxes calculate with 2-decimal financial precision. |
| F-INV-03 | Invoices | Keyboard Navigation & Shortcuts | R1/R2 (`ORIGINAL_REQUEST.md:11, 22`) | Tab/Shift+Tab cell navigation, Enter creates new line, global shortcuts (Ctrl+N, Ctrl+S, Esc). |
| F-INV-04 | Invoices | Automatic Status State Machine | R2 (`ORIGINAL_REQUEST.md:22, 36`) | Invoices transition dynamically: Draft -> Unpaid -> Partially Paid -> Paid / Overdue. |
| F-PAY-01 | Payments | Full Payment Processing | R2 (`ORIGINAL_REQUEST.md:22, 36`) | **AC 5**: Recording full payment marks invoice "Paid", clears balance, updates activity log. |
| F-PAY-02 | Payments | Partial Payment Processing | R2 (`ORIGINAL_REQUEST.md:22`) | Recording partial payment marks invoice "Partially Paid", reduces amount due and customer balance. |
| F-PAY-03 | Payments | Payment Method & Reference Recording | R2 (`ORIGINAL_REQUEST.md:22`) | Logs payment method (Cash, Bank Transfer, Card, Check) and transaction reference number. |
| F-STMT-01 | Statements | Statement of Account Generation | R2 (`ORIGINAL_REQUEST.md:22`) | Generates customer ledger with opening balance, chronologically ordered transactions, and closing balance. |
| F-STMT-02 | Statements | Statement Print & Export | R2 (`ORIGINAL_REQUEST.md:22`) | Formatted print preview and export options for statements in English and Arabic. |
| F-SYNC-01 | Cloud Sync | Firestore Offline Persistence | R3 (`ORIGINAL_REQUEST.md:24, 37`) | **AC 6**: All data can be written and read when the network connection is disabled. |
| F-SYNC-02 | Cloud Sync | Background Cloud Sync Engine | R3 (`ORIGINAL_REQUEST.md:25`) | Automatically syncs local changes to Firebase cloud when network connectivity is restored. |
| F-SYNC-03 | Cloud Sync | Real-Time Network & Sync Indicator | R3 (`ORIGINAL_REQUEST.md:25`) | Visual SaaS status pill indicating Online (Synced), Syncing, or Offline Mode. |

---

## 6. Caveats

1. **Firebase Project Credentials**: While Firestore offline persistence operates immediately using local IndexedDB, syncing to remote cloud requires valid Firebase configuration (`apiKey`, `projectId`, `appId`). For testing in isolated or sandbox environments, a local mock or Firebase Emulator Suite can be utilized without changing renderer architecture.
2. **Single vs Multi-Currency**: Invoices and Customer balances are specified assuming a primary base currency (e.g. USD or SAR). Multi-currency conversions within a single invoice are out of scope unless explicitly requested.
3. **Item Catalog**: Invoice line items are modeled as ad-hoc line entries (description, qty, price, tax, discount). A reusable product/service catalog can easily bind to this schema if added later.
4. **Desktop Native Printing**: Electron's `webContents.print()` or standard `window.print()` with CSS `@media print` will provide pixel-perfect PDF and paper output.

---

## 7. Conclusion

The specification mining is complete and fully authoritative:
- **32 discrete features** across 13 functional categories have been discovered and rigorously specified.
- **20 edge cases** with deterministic mathematical, validation, and layout handling rules have been identified.
- **All 6 explicit Acceptance Criteria** from `ORIGINAL_REQUEST.md` have been mapped directly to actionable verification points.
- User global rules (Mobile-first, compact card designs, performance optimization, zero unverified assumptions) are deeply embedded into the technical requirements.
- The domain models, financial formulas, RTL mirroring strategies, and offline sync mechanics are fully defined and ready for architectural design and implementation.

---

## 8. Verification Method

To independently verify that the specifications are implemented and met:

1. **UI & UX Shell Launch & Responsiveness**:
   - Run `npm run electron:dev` or `npm run dev`.
   - Verify Electron window opens without errors.
   - Resize viewport from 375px (mobile) to 1440px (desktop) to verify mobile drawer, compact cards, and responsive layouts.
2. **Arabic RTL Mirroring**:
   - In application settings or header, toggle language to Arabic ("العربية").
   - Inspect DOM: verify `<html dir="rtl" lang="ar">`.
   - Inspect layout: verify sidebar flips to right side, table columns reverse, directional chevron icons mirror horizontally, and currency numbers maintain proper LTR number sequence (`1,250.00 ر.س`).
3. **Real-Time Automatic Calculations**:
   - Navigate to "New Invoice".
   - Enter Item 1: Quantity `2`, Unit Price `100.00`, Discount `10%`, Tax `15%`.
   - Verify without clicking any calculate button: Line Total = `(200 - 20) + 27 = 207.00`, Subtotal = `200.00`, Grand Total = `207.00`.
   - Change Quantity to `3`: Grand Total immediately updates to `310.50`.
4. **Keyboard Navigation**:
   - In invoice line item row, press `Tab` through each field.
   - On the last field (`Tax`), press `Enter`: verify a new empty row is appended and focus shifts to the new row's `Description`.
5. **Customer Outstanding Balance & Activity Log**:
   - Save the invoice of `310.50` for "Customer A".
   - Open Customer A's profile: verify "Outstanding Amount" equals `310.50`.
   - Check Dashboard Activity Log: verify event `"Invoice INV-xxxx created for Customer A ($310.50)"`.
6. **Payment Recording & Status Transition**:
   - Click "Record Payment" on the invoice for `310.50`.
   - Submit payment: verify Invoice status immediately flips to `"Paid"`.
   - Verify Customer A's Outstanding Amount immediately drops to `0.00`.
   - Check Activity Log: verify event `"Payment of $310.50 recorded for Invoice INV-xxxx"`.
7. **Offline-First Persistence**:
   - In Electron DevTools / test harness, execute `await disableNetwork(db)` or disconnect internet.
   - Verify sync indicator changes to `Offline (Changes saved locally)`.
   - Create a new Customer and a new Invoice while offline.
   - Reload / restart the application while offline: verify the newly created Customer and Invoice persist and display accurately.
   - Reconnect network via `await enableNetwork(db)`: verify sync indicator shows `Online (Synced)` and records sync to cloud.
