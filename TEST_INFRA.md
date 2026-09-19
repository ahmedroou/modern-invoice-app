# Comprehensive Opaque-Box E2E Testing Framework & Specification (TEST_INFRA)

> **Document Version**: 1.0.0  
> **Project**: Modern Offline-First Desktop Invoice Application  
> **Author**: Test Engineering Architecture (`teamwork_preview_test_writer_e2e_1`)  
> **Target Platforms**: Windows 10/11, macOS, Linux (Electron 30+ / Chromium Renderer / Node 22 LTS)  
> **Framework Stack**: Playwright Electron (`@playwright/test` + `_electron`), Vitest, React Testing Library, `fake-indexeddb`

---

## 1. Executive Summary & Testing Philosophy

This document defines the authoritative End-to-End (E2E), Integration, and Unit testing architecture for the Modern Offline-First Desktop Invoice Application.

### 1.1 Core Testing Principles
1. **Opaque-Box Verification**: Tests validate system behavior through external observable interfaces:
   - Native desktop window lifecycle and IPC bridge (`window.electronAPI`).
   - Accessible DOM elements, ARIA roles, user input simulations, and visual layouts.
   - Reactive data states and persistence guarantees in local IndexedDB.
   - Network disruption and synchronization states via Firestore offline simulation.
2. **Authoritative Expected Output Derivation**:
   - Every test case specifies an exact authoritative source (e.g., `ORIGINAL_REQUEST.md`, `PROJECT.md` interface contracts, IEEE-754 epsilon-safe rounding formulas, W3C Bidi algorithms).
   - Tests assert mathematically deterministic expected values (e.g., exact 2-decimal rounded financial sums) rather than matching incidental implementation artifacts.
3. **Progressive Testability**:
   - Tests are structured into milestones corresponding to `PROJECT.md` deliverables.
   - Tests execute with zero dependencies on future unbuilt milestones.
4. **4-Tier Comprehensive Test Methodology**:
   - **Tier 1 — Feature Coverage**: Comprehensive positive validation covering all primary operations and user interactions across all 32 discrete application features ($\ge 5$ test cases per feature $= 160$ test cases).
   - **Tier 2 — Boundary, Corner & Adversarial Cases**: Validation of extreme numbers, zero values, negative entries, overflow conditions, network drops, rapid duplicate clicks, invalid inputs, and Unicode bidi isolation ($\ge 5$ test cases per feature $= 160$ test cases).
   - **Tier 3 — Cross-Feature Interactions & Combinations**: Multi-module workflows testing simultaneous state interactions (e.g., offline invoice creation + customer balance mutation + real-time calculations + RTL toggle + partial payments + activity log reflection).
   - **Tier 4 — Real-World Business Workflows & User Journeys**: Full lifecycle business operations simulating realistic daily commerce scenarios.

---

## 2. Acceptance Criteria Verification Matrix (ORIGINAL_REQUEST.md)

The table below maps the 6 mandatory Acceptance Criteria directly to automated test suites, test IDs, and execution mechanisms.

| AC # | Acceptance Criterion Description | Target Feature(s) | Primary Test Tier | Automated Test IDs | Verification Mechanism |
|---|---|---|---|---|---|
| **AC 1** | Application launches successfully as an Electron app. | `F-SHELL-01` | Tier 1, Tier 2 | `T1-SHELL-01-01`, `T1-SHELL-01-02`, `T2-SHELL-01-01` | Playwright `_electron.launch()` verifies window handle, title, frameless overlay, context isolation, and DOM mount. |
| **AC 2** | Switching to Arabic correctly mirrors the UI to RTL (sidebar position, table direction, chevron icons). | `F-RTL-01`, `F-RTL-02`, `F-RTL-03` | Tier 1, Tier 2, Tier 3 | `T1-RTL-02-01`, `T1-RTL-02-02`, `T1-RTL-02-03`, `T2-RTL-02-01`, `T3-INT-04` | Playwright evaluates `html[dir="rtl"]`, asserts bounding box coordinates of sidebar ($x > \text{viewport}/2$), verifies reversed table columns, and tests `rtl:scale-x-[-1]` icon transforms. |
| **AC 3** | Invoice creation updates the 'Grand Total' automatically in real-time as items are added/modified, without clicking a 'calculate' button. | `F-CALC-01`, `F-CALC-02`, `F-INV-01`, `F-INV-02` | Tier 1, Tier 2 | `T1-INV-01-01`, `T1-INV-01-02`, `T1-CALC-01-01`, `T2-CALC-01-01` | User input simulation in line item inputs triggers reactive state change; asserts immediate update of DOM `#grand-total-display` within <50ms without button interaction. |
| **AC 4** | Creating an invoice correctly updates the customer's "Outstanding Amount" instantly. | `F-CUST-03`, `F-INV-01` | Tier 1, Tier 3 | `T1-CUST-03-01`, `T1-CUST-03-02`, `T3-INT-01`, `T3-INT-02` | Atomic `writeBatch` executes locally; asserts customer document and DOM ledger view reflect updated $\text{outstandingAmount} \mathrel{+}= \text{grandTotal}$ with 0ms delay. |
| **AC 5** | Recording a full payment on an invoice changes its status to "Paid" and reflects in the Activity Log. | `F-PAY-01`, `F-INV-05`, `F-DASH-05` | Tier 1, Tier 3, Tier 4 | `T1-PAY-01-01`, `T1-PAY-01-02`, `T1-DASH-05-01`, `T3-INT-03` | Submitting payment equal to `amountDue` asserts Invoice status badge flips to `'Paid'` / `'مدفوع'`, customer balance decrements, and newest Activity Log item matches event description. |
| **AC 6** | Data can be written and read when the network connection is disabled (verifying Firebase offline persistence). | `F-SYNC-01`, `F-SYNC-04` | Tier 1, Tier 2, Tier 4 | `T1-SYNC-01-01`, `T1-SYNC-04-01`, `T2-SYNC-01-01`, `T4-WF-03` | Invokes `disableNetwork(db)`; creates customer and invoice while offline; restarts/reloads app window; asserts data renders fully from local IndexedDB cache. |

---

## 3. Test Directory Layout & Infrastructure Setup

### 3.1 Directory Organization
```
modern-invoice-desktop/
├── tests/
│   ├── unit/                                  # Vitest unit test suites (<1s execution)
│   │   ├── calculations.spec.ts               # Financial rounding, line items, taxes, discounts
│   │   ├── formatters.spec.ts                 # Currency isolation, bidi numbers, date formats
│   │   ├── statusMachine.spec.ts              # Invoice state transitions (Draft -> Unpaid -> Paid)
│   │   ├── validation.spec.ts                 # Customer & invoice payload validators
│   │   └── keyboardShortcuts.spec.ts          # Key navigation logic and hotkey mapping
│   ├── integration/                           # Component & Hook integration suites (jsdom + fake-indexeddb)
│   │   ├── InvoiceForm.spec.tsx               # Live real-time calculations, dynamic rows, keyboard focus
│   │   ├── CustomerLedger.spec.tsx            # Balance calculations, statement preview
│   │   ├── DirectionContext.spec.tsx          # RTL/LTR toggle, document attributes, font loading
│   │   ├── ThemeContext.spec.tsx              # Dark/Light switching, localStorage sync
│   │   ├── FirestoreOfflineQueue.spec.ts      # writeBatch persistence, local snapshot cache
│   │   └── MetricsGrid.spec.tsx               # Dashboard KPI live aggregations
│   ├── e2e/                                   # Playwright Electron E2E test suites
│   │   ├── 01_shell_lifecycle.spec.ts         # Window launch, controls, responsive mobile/desktop
│   │   ├── 02_rtl_mirroring.spec.ts           # Arabic toggle, layout mirroring, icon flipping
│   │   ├── 03_invoice_realtime_calc.spec.ts   # Live calculation without calculate button
│   │   ├── 04_customer_balance_sync.spec.ts   # Instant customer balance update on invoice/payment
│   │   ├── 05_payment_status_log.spec.ts      # Full/partial payments, status transition, activity feed
│   │   ├── 06_firestore_offline.spec.ts       # Network drop, offline CRUD, app reload, online resync
│   │   ├── 07_keyboard_poweruser.spec.ts      # Hotkeys (Ctrl+N, Ctrl+S, Esc) & grid navigation
│   │   ├── 08_statements_export.spec.ts       # Statement generation, PDF print preview, CSV export
│   │   └── 09_realworld_workflows.spec.ts     # Tier 4 end-to-end multi-step user scenarios
│   ├── fixtures/                              # Seed data and mock payloads
│   │   ├── customers.json                     # Standard corporate & retail test accounts
│   │   ├── invoices.json                      # Single-item, multi-item, taxed, discounted invoices
│   │   └── payments.json                      # Cash, card, bank transfer payment payloads
│   └── support/                               # E2E test helpers and electron harness
│       ├── electronHarness.ts                 # Playwright Electron launcher & window manager
│       ├── networkSimulator.ts                # Programmatic online/offline toggler
│       ├── assertions.ts                      # Custom Playwright/Vitest financial & bidi assertions
│       └── indexedDbInspector.ts              # Low-level IndexedDB verification helper
├── vitest.config.ts                           # Vitest configuration for unit & integration tests
├── playwright.config.ts                       # Playwright Electron runner configuration
└── package.json                               # Test scripts: test, test:unit, test:integration, test:e2e
```

### 3.2 Test Runner Configuration

#### Vitest Config (`vitest.config.ts`)
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/support/vitestSetup.ts'],
    alias: {
      '@': path.resolve(__dirname, './src')
    },
    include: ['tests/unit/**/*.spec.ts', 'tests/integration/**/*.spec.tsx', 'tests/integration/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      lines: 90,
      statements: 90
    }
  }
});
```

#### Playwright Config (`playwright.config.ts`)
```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45000,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Electron desktop testing requires single worker to avoid port/lock collisions
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']]
});
```

---

## 4. Tier 1: Feature Coverage Test Suite (All 32 Features)

Every feature identified in `PROJECT.md` is covered by at least 5 distinct test cases verifying primary capabilities, positive flows, and interface contracts.

```
Total Tier 1 Test Cases: 32 features × 5 cases = 160 test cases
```

### F-SHELL-01: Electron App Launch
- **T1-SHELL-01-01**: Launch Electron binary; verify native window opens with status `ready-to-show`, correct title ("Modern Invoice App"), and min dimensions $768 \times 600$.
- **T1-SHELL-01-02**: Verify custom frameless titlebar is rendered with Minimize, Maximize, and Close control buttons.
- **T1-SHELL-01-03**: Click Minimize button; verify IPC call `window:minimize` is invoked and window state is minimized.
- **T1-SHELL-01-04**: Click Maximize button; verify IPC call `window:maximize` toggles window to maximized state.
- **T1-SHELL-01-05**: Verify `window.electronAPI` is strictly defined and isolated on `window`, confirming `contextIsolation: true` and `nodeIntegration: false`.

### F-SHELL-02: Mobile-First Shell Layout
- **T1-SHELL-02-01**: Set viewport to $375 \times 667$ (mobile); verify standard sidebar is hidden and hamburger drawer button is visible.
- **T1-SHELL-02-02**: Click mobile drawer toggle; verify navigation drawer slides in smoothly and displays all navigation links.
- **T1-SHELL-02-03**: Set viewport to $1024 \times 768$ (tablet/desktop); verify fixed/collapsible sidebar is permanently docked.
- **T1-SHELL-02-04**: Verify main content container uses responsive margins without horizontal overflow (`scrollWidth === clientWidth`).
- **T1-SHELL-02-05**: Resize viewport dynamically across $375\text{px} \to 768\text{px} \to 1440\text{px}$; verify layout adapts smoothly without visual clipping.

### F-SHELL-03: Compact KPI & Data Cards
- **T1-SHELL-03-01**: Measure vertical height of Dashboard Metric cards; verify height does not exceed $90\text{px}$ on desktop.
- **T1-SHELL-03-02**: Verify compact cards display title, metric value, icon badge, and trend indicator in dense inline flex layout.
- **T1-SHELL-03-03**: Inspect mobile viewport ($375\text{px}$); verify metric cards arrange in a dense 2-column grid (`grid-cols-2`).
- **T1-SHELL-03-04**: Verify customer/invoice item cards on mobile occupy $<110\text{px}$ vertical height each.
- **T1-SHELL-03-05**: Verify text truncation (`truncate`) is applied to prevent multi-line card expansion on long names.

### F-SHELL-04: Dark / Light Mode Switching
- **T1-SHELL-04-01**: Click Theme Toggle button; verify `document.documentElement` gains `class="dark"`.
- **T1-SHELL-04-02**: Verify background and text colors update immediately to dark palette (`#0f172a` slate-900 / white text).
- **T1-SHELL-04-03**: Click Theme Toggle again; verify `class="dark"` is removed and light palette is restored.
- **T1-SHELL-04-04**: Reload window; verify chosen theme persists from `localStorage.getItem('app_theme')`.
- **T1-SHELL-04-05**: Select 'System' theme preference; verify app responds to OS system theme changes via `onThemeChanged`.

### F-RTL-01: Arabic / English Language Toggle
- **T1-RTL-01-01**: Verify default language on clean install is English (`<html lang="en">`).
- **T1-RTL-01-02**: Click Language Switcher; select "العربية" (Arabic); verify `<html lang="ar">` is set.
- **T1-RTL-01-03**: Verify core UI labels translate to accurate Arabic terminology (Invoices $\to$ "الفواتير", Customers $\to$ "العملاء", Payments $\to$ "المدفوعات").
- **T1-RTL-01-04**: Switch back to English; verify all labels revert to English instantly without reload.
- **T1-RTL-01-05**: Reload window; verify language choice is preserved in `localStorage.getItem('app_language')`.

### F-RTL-02: Complete RTL Mirroring
- **T1-RTL-02-01**: When Arabic is active, assert `<html dir="rtl">` is set on the document root.
- **T1-RTL-02-02**: Measure sidebar bounding box in RTL; verify its horizontal position is docked to the right edge ($x > \text{viewportWidth} / 2$).
- **T1-RTL-02-03**: Inspect data table in RTL; verify column 1 (Invoice #) is at the right edge and actions column is at the left edge.
- **T1-RTL-02-04**: Inspect directional navigation chevron icons in RTL; verify CSS class contains `rtl:scale-x-[-1]`.
- **T1-RTL-02-05**: Verify form field labels align to the right (`text-start` with `dir="rtl"`).

### F-RTL-03: Bidirectional Numeral & Currency Isolation
- **T1-RTL-03-01**: Inspect invoice currency string in Arabic mode; verify currency symbol appears in correct position (`1,250.00 ر.س` or `SAR 1,250.00`).
- **T1-RTL-03-02**: Verify numeric spans contain `dir="ltr"` or `unicode-bidi: isolate` to prevent arithmetic sign scrambling.
- **T1-RTL-03-03**: Enter customer phone number `+966 50 123 4567` in Arabic mode; verify number displays without inverted digits.
- **T1-RTL-03-04**: Display negative balance `-$150.00` in RTL mode; verify minus sign renders on the correct side without splitting.
- **T1-RTL-03-05**: Verify standard Western Arabic numerals (`0, 1, 2, 3...`) are rendered consistently across financial tables.

### F-SHELL-05: Smooth Transitions & Micro-interactions
- **T1-SHELL-05-01**: Navigate between Dashboard and Invoices; verify view transition executes without layout flash.
- **T1-SHELL-05-02**: Trigger a save operation; verify button displays loading spinner and disables during execution.
- **T1-SHELL-05-03**: Verify toast notification pops in with slide-up animation and auto-dismisses after 4 seconds.
- **T1-SHELL-05-04**: Hover over interactive buttons and table rows; verify subtle background transition (`transition-colors duration-150`).
- **T1-SHELL-05-05**: Verify status badges (e.g. Paid, Unpaid) have smooth color transitions on status change.

### F-SYNC-01: Firestore Local Persistence
- **T1-SYNC-01-01**: Initialize Firestore; verify `persistentLocalCache` and `persistentMultipleTabManager` initialize without error.
- **T1-SYNC-01-02**: Write a customer document; verify promise resolves immediately against local cache with 0ms network latency.
- **T1-SYNC-01-03**: Query customer collection; verify returned snapshot has `fromCache: true` when offline.
- **T1-SYNC-01-04**: Update an existing invoice while disconnected; verify local read reflects new values immediately.
- **T1-SYNC-01-05**: Verify pending mutations are retained in IndexedDB across page reloads.

### F-SYNC-02: Background Cloud Sync Engine
- **T1-SYNC-02-01**: Connect app to network; perform document mutation; verify snapshot metadata transitions to `hasPendingWrites: false`.
- **T1-SYNC-02-02**: Disconnect network, perform 3 writes, reconnect network; verify all 3 writes sync to remote backend.
- **T1-SYNC-02-03**: Verify writes are synchronized in strict chronological sequence based on client creation timestamp.
- **T1-SYNC-02-04**: Verify remote document updates pushed from cloud reflect in real-time `onSnapshot` listeners.
- **T1-SYNC-02-05**: Verify background synchronization does not freeze or block renderer UI thread.

### F-SYNC-03: Network Status & Sync Indicator
- **T1-SYNC-03-01**: When online with zero pending writes, verify status pill displays "Online (Synced)" with green indicator.
- **T1-SYNC-03-02**: Disconnect network; verify status pill transitions to "Offline (Saved locally)" with amber indicator.
- **T1-SYNC-03-03**: Trigger mutations while offline; verify pending write count badge increments (e.g. "3 pending").
- **T1-SYNC-03-04**: Reconnect network; verify status pill changes to "Syncing..." with rotating icon until queue clears.
- **T1-SYNC-03-05**: Once sync completes, verify pill transitions back to "Online (Synced)".

### F-SYNC-04: Offline Test & Simulation Harness
- **T1-SYNC-04-01**: Invoke test helper `window.__TEST_SIMULATE_OFFLINE__()`; verify `disableNetwork(db)` executes successfully.
- **T1-SYNC-04-02**: Verify app enters offline mode without OS network disconnection.
- **T1-SYNC-04-03**: Perform complete Customer CRUD cycle while harness is offline; verify all operations succeed locally.
- **T1-SYNC-04-04**: Invoke `window.__TEST_SIMULATE_ONLINE__()`; verify `enableNetwork(db)` restores active connection.
- **T1-SYNC-04-05**: Query Firestore backend; verify all documents created in step T1-SYNC-04-03 exist on server.

### F-CALC-01: Real-Time Automatic Calculation Engine
- **T1-CALC-01-01**: In Invoice form, enter Quantity `3` and Unit Price `50.00`; verify Line Total updates to `150.00` immediately.
- **T1-CALC-01-02**: Add a second item with Quantity `2` and Unit Price `25.00`; verify Subtotal displays `200.00`.
- **T1-CALC-01-03**: Enter 10% Discount on first line; verify line discount calculates to `15.00` and Line Total to `135.00`.
- **T1-CALC-01-04**: Apply 15% Tax Rate on both lines; verify Total Tax calculates to $13.50 + 7.50 = 21.00$.
- **T1-CALC-01-05**: Verify Grand Total calculates to $135.00 + 50.00 + 7.50 = 206.00$ without clicking any calculate button.

### F-CALC-02: Financial Precision Math
- **T1-CALC-02-01**: Execute financial calculation $0.1 + 0.2$; verify `roundFinancial(0.1 + 0.2, 2)` returns strictly `0.30`, not `0.30000000000000004`.
- **T1-CALC-02-02**: Test $19.99 \times 3$ with 15% VAT; verify gross is `59.97`, tax is `9.00`, and total is `68.97`.
- **T1-CALC-02-03**: Test fractional quantity $2.375$ hours at $\$85.00$/hr; verify gross is `201.88` rounded correctly.
- **T1-CALC-02-04**: Test fixed line discount of $\$12.3333$; verify line discount is clamped and rounded to `12.33`.
- **T1-CALC-02-05**: Verify `formatCurrency(1250.5, 'USD')` outputs formatted string `"$1,250.50"`.

### F-CUST-01: Customer Directory & CRUD
- **T1-CUST-01-01**: Fill customer form (Name: "Acme Corp", Email: "info@acme.com", Currency: "USD"); click Save; verify customer appears in list.
- **T1-CUST-01-02**: Click Edit Customer; change phone to "+1 555-0199"; click Update; verify change is saved and displayed.
- **T1-CUST-01-03**: Search customer directory by query "Acme"; verify list filters to show only matching customers.
- **T1-CUST-01-04**: View customer card; verify contact details, tax number, and status badge ("ACTIVE") display accurately.
- **T1-CUST-01-05**: Archive customer; verify status changes to "ARCHIVED" and customer is excluded from active dropdowns.

### F-CUST-02: Customer Profile & Ledger View
- **T1-CUST-02-01**: Click on customer in directory; verify customer details view opens displaying summary cards.
- **T1-CUST-02-02**: Verify customer ledger displays lifetime Total Invoiced, Total Paid, and Outstanding Amount.
- **T1-CUST-02-03**: Verify transaction history table lists all invoices and payments linked to this customer in chronological order.
- **T1-CUST-02-04**: Click on an invoice row in the customer ledger; verify it navigates directly to the invoice details modal/view.
- **T1-CUST-02-05**: Click on a payment row in the ledger; verify it opens payment receipt details.

### F-CUST-03: Instant Customer Balance Sync
- **T1-CUST-03-01**: Create new invoice for $\$450.00$ assigned to customer with initial balance $\$0.00$; verify customer Outstanding Amount updates to `450.00` immediately.
- **T1-CUST-03-02**: Record partial payment of $\$150.00$; verify customer Outstanding Amount drops to `300.00` instantly.
- **T1-CUST-03-03**: Record remaining payment of $\$300.00$; verify customer Outstanding Amount drops to `0.00`.
- **T1-CUST-03-04**: Cancel an unpaid invoice of $\$200.00$; verify customer Outstanding Amount decrements by `200.00`.
- **T1-CUST-03-05**: Verify Customer directory list item reflects updated balance in real-time without manual page refresh.

### F-DASH-01: Total Revenue Metric Card
- **T1-DASH-01-01**: With zero payments in database, verify Total Revenue card displays `$0.00`.
- **T1-DASH-01-02**: Record payment of $\$500.00$; verify Total Revenue card updates immediately to `$500.00`.
- **T1-DASH-01-03**: Record second payment of $\$250.75$; verify Total Revenue card displays `$750.75`.
- **T1-DASH-01-04**: Switch app currency/locale to Arabic; verify Total Revenue card displays `750.75 ر.س`.
- **T1-DASH-01-05**: Verify Total Revenue excludes uncollected or draft invoice amounts.

### F-DASH-02: Outstanding Receivables Metric Card
- **T1-DASH-02-01**: With zero invoices, verify Outstanding Receivables card displays `$0.00`.
- **T1-DASH-02-02**: Create an invoice for $\$1,000.00$; verify Outstanding Receivables updates to `$1,000.00`.
- **T1-DASH-02-03**: Record partial payment of $\$400.00$; verify Outstanding Receivables updates to `$600.00`.
- **T1-DASH-02-04**: Create second invoice for $\$350.00$; verify Outstanding Receivables updates to `$950.00`.
- **T1-DASH-02-05**: Void second invoice; verify Outstanding Receivables card returns to `$600.00`.

### F-DASH-03: Paid Invoices Counter Card
- **T1-DASH-03-01**: With zero paid invoices, verify Paid Invoices counter displays `0`.
- **T1-DASH-03-02**: Create an unpaid invoice; verify Paid Invoices counter remains `0`.
- **T1-DASH-03-03**: Record full payment on the invoice; verify Paid Invoices counter increments to `1`.
- **T1-DASH-03-04**: Record full payment on a second invoice; verify counter increments to `2`.
- **T1-DASH-03-05**: Record partial payment on a third invoice; verify Paid Invoices counter remains `2`.

### F-DASH-04: Overdue Invoices Counter Card
- **T1-DASH-04-01**: Create invoice with future due date; verify Overdue Invoices counter is `0`.
- **T1-DASH-04-02**: Create invoice with due date in the past (e.g. 5 days ago); verify Overdue Invoices counter displays `1`.
- **T1-DASH-04-03**: Record full payment on the overdue invoice; verify Overdue counter decrements to `0`.
- **T1-DASH-04-04**: Create 3 invoices with past due dates; verify Overdue counter displays `3` with warning styling.
- **T1-DASH-04-05**: Record partial payment on an overdue invoice; verify it remains counted as overdue until fully settled.

### F-DASH-05: Real-Time Activity Log
- **T1-DASH-05-01**: Create a customer "Zenith Ltd"; verify Activity Log prepends an entry: "Customer 'Zenith Ltd' created".
- **T1-DASH-05-02**: Create invoice `INV-001` for $\$500$; verify Activity Log prepends: "Invoice INV-001 created ($500.00)".
- **T1-DASH-05-03**: Record payment of $\$500$; verify Activity Log prepends: "Payment of $500.00 recorded for INV-001".
- **T1-DASH-05-04**: Verify Activity Log entries show relative timestamps (e.g. "Just now", "2m ago").
- **T1-DASH-05-05**: Verify Activity Log scrolls smoothly and displays up to 50 recent events without UI stutter.

### F-INV-01: Invoice Creation & Real-Time Calculation
- **T1-INV-01-01**: Open New Invoice modal; verify default issue date is today and invoice number is auto-generated (e.g. `INV-2026-0001`).
- **T1-INV-01-02**: Add line item with Quantity `4`, Unit Price `100`; verify Grand Total displays `$400.00` immediately without clicking calculate.
- **T1-INV-01-03**: Modify Quantity to `6`; verify Grand Total updates to `$600.00` in real-time.
- **T1-INV-01-04**: Select Customer from dropdown; verify customer currency and terms populate automatically.
- **T1-INV-01-05**: Click Save Invoice; verify invoice saves to database, modal closes, and invoice appears in invoice list.

### F-INV-02: Itemized Line Item Management
- **T1-INV-02-01**: In Invoice form, click "Add Line Item" button; verify a second row is appended to the grid.
- **T1-INV-02-02**: Populate Item 1 ($100) and Item 2 ($150); verify Subtotal reflects `$250.00`.
- **T1-INV-02-03**: Click Delete button on Item 1; verify Item 1 is removed and Subtotal recalculates to `$150.00`.
- **T1-INV-02-04**: Switch discount type from PERCENTAGE (10%) to FIXED ($20); verify recalculation occurs instantly.
- **T1-INV-02-05**: Add 5 line items; verify all 5 calculate and aggregate into Grand Total correctly.

### F-INV-03: Keyboard-Driven Grid Navigation
- **T1-INV-03-01**: In invoice line item row, focus `Description` input; press `Tab`; verify focus moves to `Quantity`.
- **T1-INV-03-02**: Press `Tab` repeatedly; verify focus moves in sequence: `Quantity` $\to$ `UnitPrice` $\to$ `Discount` $\to$ `TaxRate`.
- **T1-INV-03-03**: On `TaxRate` (last cell in row), press `Enter`; verify a new line item row is created and its `Description` is focused.
- **T1-INV-03-04**: Press `Shift + Tab`; verify focus navigates backwards through cells.
- **T1-INV-03-05**: Press `ArrowDown` in Quantity input of row 1; verify focus moves to Quantity input of row 2.

### F-INV-04: Global Keyboard Shortcuts
- **T1-INV-04-01**: Press `Ctrl + N` (or `Cmd + N` on macOS); verify "New Invoice" modal opens immediately from any view.
- **T1-INV-04-02**: Inside active modal, press `Escape`; verify modal closes (prompting confirmation if form is dirty).
- **T1-INV-04-03**: Press `Ctrl + S`; verify active invoice form validates and submits.
- **T1-INV-04-04**: Press `Ctrl + K` or `/`; verify global search bar is focused.
- **T1-INV-04-05**: Verify global shortcuts do not trigger while typing standard text inside textareas or notes.

### F-INV-05: Invoice Status Auto-Transition
- **T1-INV-05-01**: Create invoice with future due date; verify status defaults to `UNPAID`.
- **T1-INV-05-02**: Record partial payment (less than Grand Total); verify status transitions to `PARTIALLY_PAID`.
- **T1-INV-05-03**: Record payment of remaining balance; verify status transitions to `PAID`.
- **T1-INV-05-04**: Create invoice with past due date; verify status evaluates to `OVERDUE`.
- **T1-INV-05-05**: Void/cancel invoice; verify status updates to `CANCELLED` and `amountDue` is set to `0`.

### F-INV-06: Invoice Search & Filter
- **T1-INV-06-01**: Search invoice list by invoice number "INV-2026-0001"; verify list filters to single matching row.
- **T1-INV-06-02**: Filter invoices by status "PAID"; verify only paid invoices are displayed.
- **T1-INV-06-03**: Filter invoices by status "OVERDUE"; verify only overdue invoices are displayed.
- **T1-INV-06-04**: Filter invoices by Customer "Acme Corp"; verify only invoices for Acme Corp appear.
- **T1-INV-06-05**: Select date range filter (last 30 days); verify only invoices issued within range are returned.

### F-PAY-01: Record Full Payment
- **T1-PAY-01-01**: Open Payment Modal for invoice with `amountDue = 500.00`; verify payment amount input defaults to `500.00`.
- **T1-PAY-01-02**: Select Payment Method "BANK_TRANSFER"; enter reference "TXN-98765"; click Submit; verify payment record created.
- **T1-PAY-01-03**: Verify Invoice `amountPaid` updates to `500.00` and `amountDue` updates to `0.00`.
- **T1-PAY-01-04**: Verify Invoice status badge flips to "Paid" with green styling.
- **T1-PAY-01-05**: Verify customer `outstandingAmount` is decremented by `500.00`.

### F-PAY-02: Record Partial Payment
- **T1-PAY-02-01**: Open Payment Modal for invoice with `amountDue = 1,000.00`; enter amount `400.00`; click Submit.
- **T1-PAY-02-02**: Verify Payment record of `400.00` is saved.
- **T1-PAY-02-03**: Verify Invoice `amountPaid` is `400.00` and `amountDue` is `600.00`.
- **T1-PAY-02-04**: Verify Invoice status badge updates to "Partially Paid" (amber badge).
- **T1-PAY-02-05**: Verify customer `outstandingAmount` is decremented by exactly `400.00`.

### F-PAY-03: Multi-Method Payment Logging
- **T1-PAY-03-01**: Record payment with method "CASH"; verify payment receipt indicates "Cash".
- **T1-PAY-03-02**: Record payment with method "CREDIT_CARD" and auth code "AUTH-4321"; verify metadata is saved.
- **T1-PAY-03-03**: Record payment with method "CHECK" and check number "CHK-5501"; verify details display in payment details.
- **T1-PAY-03-04**: View Payments List; verify payment method column displays appropriate method icon and reference text.
- **T1-PAY-03-05**: Filter Payments List by payment method "BANK_TRANSFER"; verify only bank transfer receipts are shown.

### F-STMT-01: Customer Statement Generator
- **T1-STMT-01-01**: Open Statement Generator for Customer; select date range `2026-01-01` to `2026-03-31`; click Generate.
- **T1-STMT-01-02**: Verify Opening Balance reflects customer's cumulative net balance prior to `2026-01-01`.
- **T1-STMT-01-03**: Verify ledger rows include all invoices (debits) and payments (credits) within the period.
- **T1-STMT-01-04**: Verify running balance column calculates correctly line by line: $\text{prev} + \text{debit} - \text{credit}$.
- **T1-STMT-01-05**: Verify Closing Balance equals: $\text{Opening Balance} + \text{Total Invoiced} - \text{Total Paid}$.

### F-STMT-02: Statement Export & Print View
- **T1-STMT-02-01**: Click "Print Statement"; verify print preview layout renders with clean page margins and company branding.
- **T1-STMT-02-02**: In Arabic mode, verify print preview renders in full RTL layout with Arabic font.
- **T1-STMT-02-03**: Click "Export CSV"; verify CSV file is generated with matching ledger transactions and balance columns.
- **T1-STMT-02-04**: Click "Save as PDF"; verify `electronAPI.printInvoicePDF` is called and returns valid file path.
- **T1-STMT-02-05**: Verify print stylesheet hides UI navigation, sidebars, and action buttons during print preview.

---

## 5. Tier 2: Boundary, Corner & Adversarial Cases (All 32 Features)

Tier 2 targets edge cases, extreme inputs, arithmetic precision boundaries, rapid event collisions, network disconnects, and malicious/malformed inputs.

```
Total Tier 2 Test Cases: 32 features × 5 cases = 160 test cases
```

### F-SHELL-01: Electron App Launch (Boundaries)
- **T2-SHELL-01-01**: Launch app when previous session crashed or lockfile remained; verify app launches cleanly without hang.
- **T2-SHELL-01-02**: Launch app on screen with non-standard display scaling (125%, 150%, 200% DPI); verify titlebar and UI scale crisply without blur.
- **T2-SHELL-01-03**: Attempt to resize window below minimum width ($768\text{px}$); verify Electron enforces `minWidth` constraint.
- **T2-SHELL-01-04**: Trigger rapid double-click on frameless titlebar drag area; verify window maximizes/restores without titlebar jump.
- **T2-SHELL-01-05**: Inject script attempting `require('fs')` from renderer DevTools; verify Node access is rejected (`require is not defined`).

### F-SHELL-02: Mobile-First Shell Layout (Boundaries)
- **T2-SHELL-02-01**: Set viewport to ultra-narrow width ($320\text{px}$ iPhone SE legacy); verify layout wraps cleanly with zero horizontal scrollbar.
- **T2-SHELL-02-02**: Rotate device from portrait ($375 \times 667$) to landscape ($667 \times 375$); verify drawer and headers adjust layout without clipping.
- **T2-SHELL-02-03**: Open mobile navigation drawer and rapidly resize window to desktop ($1280\text{px}$); verify mobile drawer closes and desktop sidebar renders.
- **T2-SHELL-02-04**: Enter 200-character customer name; verify mobile card truncates with ellipsis and does not blow out container width.
- **T2-SHELL-02-05**: Test touch tap targets on mobile; verify all buttons maintain minimum $44 \times 44\text{px}$ touch bounding area.

### F-SHELL-03: Compact KPI & Data Cards (Boundaries)
- **T2-SHELL-03-01**: Display 12-digit currency value (`$999,999,999.99`); verify compact card font scales down gracefully without text overflow.
- **T2-SHELL-03-02**: Load 0 records (fresh database); verify all compact KPI cards render `$0.00` or `0` without `NaN` or `undefined`.
- **T2-SHELL-03-03**: Fast data updates (100 rapid invoice additions); verify metric cards update without layout recalculation thrashing.
- **T2-SHELL-03-04**: Extreme aspect ratio window ($1920 \times 400$); verify compact cards stay contained in upper viewport.
- **T2-SHELL-03-05**: Card subtitle containing multi-line text; verify CSS clamps to 1 line (`line-clamp-1`).

### F-SHELL-04: Dark / Light Mode Switching (Boundaries)
- **T2-SHELL-04-01**: Rapidly toggle theme button 10 times in 1 second; verify no flickering or inconsistent class states.
- **T2-SHELL-04-02**: Simulate corrupted `localStorage.getItem('app_theme') = 'invalid_theme'`; verify fallback to default 'system'.
- **T2-SHELL-04-03**: Toggle theme while high-contrast OS mode is active; verify accessibility colors remain compliant ($>4.5:1$ contrast ratio).
- **T2-SHELL-04-04**: Switch theme while invoice modal is open; verify modal overlay, inputs, and borders update theme dynamically.
- **T2-SHELL-04-05**: Verify print stylesheet forces high-contrast white background even when dark mode is currently active.

### F-RTL-01: Arabic / English Language Toggle (Boundaries)
- **T2-RTL-01-01**: Rapidly toggle language button back and forth 5 times; verify DOM `dir` and `lang` stay synchronized.
- **T2-RTL-01-02**: Corrupt `localStorage.getItem('app_language') = 'de'`; verify app falls back gracefully to 'en'.
- **T2-RTL-01-03**: Switch language while typing inside invoice description input; verify entered text is preserved without form reset.
- **T2-RTL-01-04**: Verify zero external network requests to Google Fonts occur when switching to Arabic (offline local fonts only).
- **T2-RTL-01-05**: Switch language when validation error tooltips are visible; verify error messages translate to Arabic immediately.

### F-RTL-02: Complete RTL Mirroring (Boundaries)
- **T2-RTL-02-01**: Open modal in RTL mode; verify modal close button is positioned on top-left (mirrored from top-right in LTR).
- **T2-RTL-02-02**: Test nested flex container with mixed text; verify `start-0` and `end-0` logical positions evaluate correctly.
- **T2-RTL-02-03**: Verify non-directional icons (search magnifier, printer, trash can) retain universal orientation in RTL.
- **T2-RTL-02-04**: Test horizontal scroll in tables in RTL; verify scrollbar begins at the right edge (`scrollLeft = 0` at right).
- **T2-RTL-02-05**: Print preview in RTL mode; verify page headers and page number counters mirror correctly.

### F-RTL-03: Bidirectional Numeral & Currency Isolation (Boundaries)
- **T2-RTL-03-01**: Render negative financial value `-$0.01` in Arabic RTL; verify minus sign renders on left of digits without trailing inversion.
- **T2-RTL-03-02**: Render mixed Arabic and English customer name `"Al-Amal مؤسسة Solutions"`; verify word order does not scramble.
- **T2-RTL-03-03**: Format invoice reference containing dashes `"INV-2026-0099"`; verify dashes do not reverse order in RTL.
- **T2-RTL-03-04**: Render date `"2026-09-19"` in RTL; verify ISO date order is preserved without year jumping to the end.
- **T2-RTL-03-05**: Input international phone `+966 (11) 234-5678`; verify parentheses do not invert in RTL.

### F-SHELL-05: Smooth Transitions & Micro-interactions (Boundaries)
- **T2-SHELL-05-01**: Enable `prefers-reduced-motion: reduce` in OS; verify all UI transitions and animations are disabled immediately.
- **T2-SHELL-05-02**: Spawn 20 toast notifications in rapid succession; verify toasts queue and stack gracefully without overlapping.
- **T2-SHELL-05-03**: Rapidly click disabled button during network latency; verify zero duplicate handler triggers.
- **T2-SHELL-05-04**: Close modal mid-transition; verify component unmounts cleanly without animation memory leak.
- **T2-SHELL-05-05**: Test dropdown open/close on low-end throttled CPU (4x slowdown); verify no frame drops or layout freeze.

### F-SYNC-01: Firestore Local Persistence (Boundaries)
- **T2-SYNC-01-01**: Write 1,000 documents while completely offline; verify IndexedDB handles storage without quota error.
- **T2-SYNC-01-02**: Force close Electron process during an offline batch write; restart app; verify IndexedDB database is not corrupted.
- **T2-SYNC-01-03**: Query documents using complex multi-field filters while offline; verify IndexedDB local index resolves query.
- **T2-SYNC-01-04**: Attempt to read non-existent document while offline; verify returns clean `null` snapshot rather than hanging.
- **T2-SYNC-01-05**: Test simultaneous write from two Electron browser windows; verify `persistentMultipleTabManager` synchronizes state without tab locks.

### F-SYNC-02: Background Cloud Sync Engine (Boundaries)
- **T2-SYNC-02-01**: Flapping network connection (online $\to$ offline $\to$ online every 500ms); verify sync engine recovers without crash.
- **T2-SYNC-02-02**: Server returns `permission-denied` error on sync; verify client displays sync error banner and retains local copy.
- **T2-SYNC-02-03**: Accumulate 50 offline writes; reconnect to slow 3G network; verify writes stream to server reliably.
- **T2-SYNC-02-04**: Edit same document locally while offline after remote edit occurred on server; verify last-write-wins resolution.
- **T2-SYNC-02-05**: Reconnect after 24 hours offline; verify queue synchronizes seamlessly without timestamp expiration.

### F-SYNC-03: Network Status & Sync Indicator (Boundaries)
- **T2-SYNC-03-01**: `navigator.onLine` reports true but Firestore server is unreachable; verify status reflects connection latency.
- **T2-SYNC-03-02**: Rapidly disconnect and reconnect network; verify indicator does not get stuck in "Syncing..." state.
- **T2-SYNC-03-03**: Hover over sync badge while 15 items are pending; verify tooltip displays itemized count ("15 changes pending sync").
- **T2-SYNC-03-04**: Disconnect network while saving an invoice; verify badge transitions to offline within $<100\text{ms}$.
- **T2-SYNC-03-05**: Verify sync indicator component does not trigger unnecessary re-renders in parent components.

### F-SYNC-04: Offline Test & Simulation Harness (Boundaries)
- **T2-SYNC-04-01**: Call `simulateOffline()` twice consecutively; verify idempotency without rejection.
- **T2-SYNC-04-02**: Call `simulateOnline()` while already online; verify no operational disruption.
- **T2-SYNC-04-03**: Disconnect via harness, write document, verify document has `hasPendingWrites: true`, reconnect, verify `hasPendingWrites: false`.
- **T2-SYNC-04-04**: Execute simulated offline test suite 50 times in automated loop; verify zero memory leaks or lingering sockets.
- **T2-SYNC-04-05**: Verify harness APIs are inaccessible in production builds (`process.env.NODE_ENV === 'production'`).

### F-CALC-01: Real-Time Automatic Calculation Engine (Boundaries)
- **T2-CALC-01-01**: Enter 0 in Quantity field; verify line total is `$0.00` and validation prevents invoice save.
- **T2-CALC-01-02**: Enter negative quantity (`-5`); verify input is rejected or flagged with error: "Quantity must be greater than 0".
- **T2-CALC-01-03**: Enter fixed discount greater than line gross amount ($150 discount on $100 item); verify discount is capped at `$100.00` (line total floors at `$0.00`).
- **T2-CALC-01-04**: Enter 100% discount on entire invoice; verify Grand Total calculates to `$0.00` and invoice creates as `PAID`.
- **T2-CALC-01-05**: Enter extreme quantity `999,999` at `$99,999.99`; verify calculations compute accurately without `Infinity`.

### F-CALC-02: Financial Precision Math (Boundaries)
- **T2-CALC-02-01**: Round half up on exact boundaries: `roundFinancial(2.005, 2)` must return `2.01`, not `2.00`.
- **T2-CALC-02-02**: Round half down on boundary: `roundFinancial(2.004, 2)` must return `2.00`.
- **T2-CALC-02-03**: Test fractional cent items (e.g. 10 items at $\$0.004$ each); verify line gross is `$0.04`.
- **T2-CALC-02-04**: Pass `NaN`, `null`, or non-numeric string to `roundFinancial`; verify returns `0.00` safely without throw.
- **T2-CALC-02-05**: Test rounding on negative numbers: `roundFinancial(-2.005, 2)` must return `-2.01`.

### F-CUST-01: Customer Directory & CRUD (Boundaries)
- **T2-CUST-01-01**: Submit customer form with empty name; verify form validation halts submit and highlights name input.
- **T2-CUST-01-02**: Enter invalid email format (`user@domain`); verify RFC 5322 validation error displays.
- **T2-CUST-01-03**: Enter name with leading and trailing whitespace (`"  Alpha LLC  "`); verify name is trimmed to `"Alpha LLC"`.
- **T2-CUST-01-04**: Create customer with identical name as existing customer; verify system allows or warns with disambiguation.
- **T2-CUST-01-05**: Enter 500-character address; verify address renders without overflowing container boundaries.

### F-CUST-02: Customer Profile & Ledger View (Boundaries)
- **T2-CUST-02-01**: Open profile for customer with 0 historical invoices; verify ledger renders empty state illustration and `$0.00` totals.
- **T2-CUST-02-02**: Open profile for customer with 500 historical transactions; verify table virtualizes or paginates without lag.
- **T2-CUST-02-03**: Attempt to access customer profile with non-existent ID (`cust-999999`); verify renders clean "Customer not found" view.
- **T2-CUST-02-04**: Customer with negative outstanding amount (credit balance / overpayment); verify renders credit badge clearly.
- **T2-CUST-02-05**: View customer ledger while offline; verify complete history displays from IndexedDB.

### F-CUST-03: Instant Customer Balance Sync (Boundaries)
- **T2-CUST-03-01**: Rapidly create 5 invoices for same customer in 2 seconds; verify final customer `outstandingAmount` equals exact sum of all 5 invoices.
- **T2-CUST-03-02**: Create invoice for $\$100$, edit invoice to $\$150$; verify customer balance adjusts from $\$100 \to \$150$ (net $+50$).
- **T2-CUST-03-03**: Delete draft invoice; verify customer balance is not affected.
- **T2-CUST-03-04**: Create invoice while offline, verify customer balance updates locally, restart app, verify balance remains updated.
- **T2-CUST-03-05**: Concurrently record payment and create invoice; verify atomic batch updates maintain exact balance invariant.

### F-DASH-01: Total Revenue Metric Card (Boundaries)
- **T2-DASH-01-01**: Void a payment of $\$300$; verify Total Revenue card decrements by $\$300.00$ immediately.
- **T2-DASH-01-02**: Record 100 payments of $\$1.00$ each; verify Total Revenue increases by exactly `$100.00`.
- **T2-DASH-01-03**: Create payment with 0 amount; verify validation rejects write and Total Revenue is unchanged.
- **T2-DASH-01-04**: Total Revenue exceeding $\$10,000,000$; verify formatted output uses proper grouping separators (`$10,000,000.00`).
- **T2-DASH-01-05**: Change system clock / timezone; verify Total Revenue calculation does not produce NaN.

### F-DASH-02: Outstanding Receivables Metric Card (Boundaries)
- **T2-DASH-02-01**: Fully pay all outstanding invoices; verify Outstanding Receivables drops to strictly `$0.00`.
- **T2-DASH-02-02**: Mark invoice as CANCELLED; verify its remaining `amountDue` is deducted from Outstanding Receivables.
- **T2-DASH-02-03**: Create invoice in DRAFT status; verify draft amounts are excluded from Outstanding Receivables.
- **T2-DASH-02-04**: Partial payment exceeding invoice balance; verify payment validation blocks overpayment and prevents negative receivables.
- **T2-DASH-02-05**: Verify Outstanding Receivables updates reactively when invoice line items are modified in an unpaid invoice.

### F-DASH-03: Paid Invoices Counter Card (Boundaries)
- **T2-DASH-03-01**: Pay invoice with 2 partial installments; verify counter increments only on the final installment that clears the balance.
- **T2-DASH-03-02**: Void payment on a paid invoice; verify invoice returns to `UNPAID` and Paid Invoices counter decrements by 1.
- **T2-DASH-03-03**: Create invoice with $\$0.00$ total (100% discount); verify counts as Paid immediately upon creation.
- **T2-DASH-03-04**: Database with 1,000 paid invoices; verify counter renders instantly without client-side lag.
- **T2-DASH-03-05**: Delete a paid invoice; verify Paid counter decrements accordingly.

### F-DASH-04: Overdue Invoices Counter Card (Boundaries)
- **T2-DASH-04-01**: Invoice due date is today; verify invoice is NOT counted as overdue until date crosses midnight.
- **T2-DASH-04-02**: Invoice due date was yesterday but balance is fully paid; verify invoice is NOT counted as overdue.
- **T2-DASH-04-03**: Invoice due date was yesterday with $\$0.01$ remaining; verify invoice IS counted as overdue.
- **T2-DASH-04-04**: Cancel an overdue invoice; verify Overdue counter decrements immediately.
- **T2-DASH-04-05**: Leap year due date (`2028-02-29`); verify date parsing handles leap year accurately.

### F-DASH-05: Real-Time Activity Log (Boundaries)
- **T2-DASH-05-01**: Rapid burst of 20 simultaneous events; verify Activity Log captures all 20 events with correct millisecond sorting.
- **T2-DASH-05-02**: Activity Log event with special HTML/script characters (`<script>alert(1)</script>`); verify proper sanitization (no XSS).
- **T2-DASH-05-03**: Event description in Arabic; verify text renders correctly without bidi corruption.
- **T2-DASH-05-04**: Activity Log with 10,000 historic entries; verify view limits initial query to 50 latest records for peak performance.
- **T2-DASH-05-05**: Disconnect network, perform actions; verify activity logs persist locally in IndexedDB and appear in UI.

### F-INV-01: Invoice Creation & Real-Time Calculation (Boundaries)
- **T2-INV-01-01**: User clears quantity input (empty string `""`); verify calculation treats empty as `0` without displaying `NaN`.
- **T2-INV-01-02**: User enters non-numeric input (`"abc"`) into price field; verify input is rejected or prevented by number formatting.
- **T2-INV-01-03**: Fast typing (10 keystrokes in 200ms); verify calculations keep pace with zero lag or race conditions.
- **T2-INV-01-04**: Due date set earlier than Issue date; verify validation error: "Due date cannot be before issue date."
- **T2-INV-01-05**: Click "Save Invoice" multiple times in rapid succession; verify button disables immediately (`isSubmitting: true`) preventing duplicate invoices.

### F-INV-02: Itemized Line Item Management (Boundaries)
- **T2-INV-02-01**: Attempt to delete the only remaining line item; verify system prevents deletion or immediately resets with blank row and requires $\ge 1$ item.
- **T2-INV-02-02**: Add 50 line items to a single invoice; verify grid renders smoothly and Grand Total sums all 50 accurately.
- **T2-INV-02-03**: Delete row from middle of 10 items; verify remaining rows preserve their data and indices collapse cleanly.
- **T2-INV-02-04**: Line item description with 500 characters; verify input field expands or scrolls without breaking table alignment.
- **T2-INV-02-05**: Tax rate with 2 decimal places (e.g. `8.875%` NYC sales tax); verify tax computes with proper rounding.

### F-INV-03: Keyboard-Driven Grid Navigation (Boundaries)
- **T2-INV-03-01**: Press `Enter` in last cell of row while description is blank; verify row creation requires non-empty description or handles cleanly.
- **T2-INV-03-02**: Press `Shift + Tab` on the very first cell of row 1; verify focus moves backwards to customer select dropdown.
- **T2-INV-03-03**: Press `ArrowUp` on row 1; verify focus remains safely in row 1 without error.
- **T2-INV-03-04**: Press `ArrowDown` on the last row; verify focus remains in last row.
- **T2-INV-03-05**: Press `Alt + Delete` hotkey inside a line item row; verify row is deleted and focus transitions to next available row.

### F-INV-04: Global Keyboard Shortcuts (Boundaries)
- **T2-INV-04-01**: Press `Ctrl + N` while New Invoice modal is already open; verify no duplicate modal is spawned.
- **T2-INV-04-02**: Press `Escape` while an input has uncommitted text; verify modal confirms before discarding changes.
- **T2-INV-04-03**: Press `Ctrl + S` when form has validation errors; verify form does NOT save, focuses first invalid input, and displays inline errors.
- **T2-INV-04-04**: Press `Ctrl + N` while offline; verify New Invoice modal opens and functions seamlessly.
- **T2-INV-04-05**: Press keyboard shortcuts on macOS (`Cmd + N`, `Cmd + S`); verify `metaKey` modifier is supported alongside `ctrlKey`.

### F-INV-05: Invoice Status Auto-Transition (Boundaries)
- **T2-INV-05-01**: Record payment equal to `amountDue - 0.01` (1 cent short); verify status remains `PARTIALLY_PAID`, not `PAID`.
- **T2-INV-05-02**: Record final 1 cent payment; verify status transitions from `PARTIALLY_PAID` to `PAID`.
- **T2-INV-05-03**: Attempt to record payment on a `CANCELLED` invoice; verify action is blocked with error.
- **T2-INV-05-04**: Attempt to record payment on an already `PAID` invoice; verify payment button is disabled.
- **T2-INV-05-05**: Invoice is overdue by 1 day, then full payment recorded; verify status changes to `PAID` and clears overdue flag.

### F-INV-06: Invoice Search & Filter (Boundaries)
- **T2-INV-06-01**: Search with special characters (`%`, `_`, `*`, `'`, `"` ); verify search does not crash or execute SQL/regex injection.
- **T2-INV-06-02**: Search with leading and trailing spaces; verify query is trimmed before filtering.
- **T2-INV-06-03**: Apply overlapping filters with zero matches; verify clean "No invoices found matching criteria" message with "Clear Filters" button.
- **T2-INV-06-04**: Filter with Start Date > End Date; verify UI flags date error and prevents invalid query.
- **T2-INV-06-05**: Search across 1,000 invoices while typing; verify debounce (300ms) prevents UI stuttering.

### F-PAY-01: Record Full Payment (Boundaries)
- **T2-PAY-01-01**: Attempt to record payment greater than `amountDue` ($150 on $100 due); verify validation blocks submit: "Payment cannot exceed amount due".
- **T2-PAY-01-02**: Record full payment on invoice while network is offline; verify payment records, invoice marks Paid, customer balance clears in local IndexedDB.
- **T2-PAY-01-03**: Double click "Submit Payment" button rapidly; verify only single payment document is created.
- **T2-PAY-01-04**: Set payment date to future date; verify system permits or displays warning based on business rules.
- **T2-PAY-01-05**: Record payment with foreign currency; verify invoice currency and payment currency match.

### F-PAY-02: Record Partial Payment (Boundaries)
- **T2-PAY-02-01**: Attempt to record partial payment of `$0.00`; verify validation rejects: "Amount must be greater than 0.00".
- **T2-PAY-02-02**: Attempt to record negative payment (`-$50.00`); verify validation rejects negative values.
- **T2-PAY-02-03**: Record partial payment of `$0.01`; verify invoice updates `amountPaid = 0.01` and `amountDue = grandTotal - 0.01`.
- **T2-PAY-02-04**: Record 10 partial payments of `$10.00` on `$100.00` invoice; verify on 10th payment status becomes `PAID`.
- **T2-PAY-02-05**: Partial payment with 3 decimal places (e.g. `25.555`); verify rounded to `25.56` before recording.

### F-PAY-03: Multi-Method Payment Logging (Boundaries)
- **T2-PAY-03-01**: Select method "CHECK" without entering check number; verify optional reference allows blank or prompts reminder.
- **T2-PAY-03-02**: Enter reference number with 100 characters; verify saved and truncated cleanly in table display.
- **T2-PAY-03-03**: Record payment without selecting method; verify defaults automatically to "CASH".
- **T2-PAY-03-04**: Add notes with emojis/Arabic characters to payment record; verify stored with complete UTF-8 fidelity.
- **T2-PAY-03-05**: Payment receipt print preview; verify payment method and reference appear prominently.

### F-STMT-01: Customer Statement Generator (Boundaries)
- **T2-STMT-01-01**: Select Start Date = End Date (single day statement); verify transactions for that single day are included accurately.
- **T2-STMT-01-02**: Generate statement for date range where no transactions occurred, but prior balance exists; verify Opening Balance = Closing Balance and table shows "No transactions during period".
- **T2-STMT-01-03**: Customer with 1,000 transactions; verify statement generates in $<1$ second with accurate arithmetic.
- **T2-STMT-01-04**: Generate statement for customer created today with zero activity; verify Opening = $0.00, Closing = $0.00.
- **T2-STMT-01-05**: Verify transactions on exact boundary dates (`00:00:00` and `23:59:59`) are included.

### F-STMT-02: Statement Export & Print View (Boundaries)
- **T2-STMT-02-01**: Export CSV for customer with commas and quotes in customer name/notes (`"Acme, Inc.", "Notes with \"quotes\""`); verify proper RFC 4180 CSV escaping.
- **T2-STMT-02-02**: Generate PDF for multi-page statement (10 pages); verify table headers repeat on each printed page (`thead { display: table-header-group }`).
- **T2-STMT-02-03**: Print statement while offline; verify prints successfully without remote network resources.
- **T2-STMT-02-04**: Cancel OS file save dialog during export; verify application handles cancellation gracefully without unhandled promise rejection.
- **T2-STMT-02-05**: Verify exported CSV contains UTF-8 BOM so Excel opens Arabic customer names without garbled text.

---

## 6. Tier 3: Cross-Feature Interactions & Combinations

Tier 3 exercises multi-component interactions where actions in one domain propagate across multiple subsystems.

### T3-INT-01: Complete Offline Lifecycle with Customer Balance & Activity Logging
- **Modules**: `F-SYNC-01` (Persistence), `F-SYNC-04` (Harness), `F-CUST-01` (Customers), `F-INV-01` (Invoices), `F-CUST-03` (Balance Sync), `F-DASH-05` (Activity Log)
- **Precondition**: App running in Electron, test harness active.
- **Steps**:
  1. Trigger `simulateOffline()`; verify sync pill shows "Offline".
  2. Create Customer "Delta Dynamics" (Opening Balance = $0.00).
  3. Create Invoice `INV-OFF-01` for Delta Dynamics: 2 items ($100 + $200) + 15% VAT = $345.00.
  4. Assert Customer Outstanding Balance updates to `$345.00` immediately in DOM.
  5. Assert Activity Log displays "Customer created" and "Invoice INV-OFF-01 created ($345.00)".
  6. Reload Electron window (`window.reload()`) while still offline.
  7. Assert Delta Dynamics exists with balance `$345.00` loaded from local IndexedDB.
  8. Trigger `simulateOnline()`; verify sync indicator transitions to "Syncing..." and then "Online (Synced)".
- **Authoritative Invariant**: Local IndexedDB holds atomic multi-doc batch; zero data loss across window reloads; seamless remote cloud synchronization.

### T3-INT-02: Invoice Modification & Automatic Recalculation Cascading to Customer Ledger
- **Modules**: `F-INV-01`, `F-INV-02`, `F-CALC-01`, `F-CUST-03`, `F-DASH-02`
- **Precondition**: Customer "Omega Corp" has existing invoice of `$500.00`. Customer Outstanding Balance = `$500.00`.
- **Steps**:
  1. Open existing invoice in edit mode.
  2. Increase Item 1 quantity from `5` to `8` ($100/ea); Grand Total automatically recalculates to `$800.00`.
  3. Save invoice.
  4. Assert Customer Omega Corp Outstanding Balance updates to `$800.00`.
  5. Assert Dashboard Outstanding Receivables updates by $+300.00$.
- **Authoritative Invariant**: Invoice modification adjusts customer balance by exact net difference: $\Delta \text{Balance} = \text{newGrandTotal} - \text{oldGrandTotal}$.

### T3-INT-03: Multi-Stage Installment Payments, Status State Machine & Activity Feed
- **Modules**: `F-INV-05` (Status), `F-PAY-01` / `F-PAY-02` (Payments), `F-CUST-03` (Balance), `F-DASH-01` / `F-DASH-03` (Dashboard)
- **Precondition**: Invoice `INV-MULTI-01` created for `$1,000.00`. Status = `UNPAID`.
- **Steps**:
  1. Record Payment 1: `$300.00` via "BANK_TRANSFER".
     - Assert Invoice status $\to$ `PARTIALLY_PAID`.
     - Assert `amountPaid = 300.00`, `amountDue = 700.00`.
     - Assert Customer balance decrements to `$700.00`.
     - Assert Activity Log records: "Payment of $300.00 recorded for INV-MULTI-01".
  2. Record Payment 2: `$700.00` via "CHECK".
     - Assert Invoice status $\to$ `PAID`.
     - Assert `amountPaid = 1,000.00`, `amountDue = 0.00`.
     - Assert Customer balance decrements to `$0.00`.
     - Assert Dashboard Paid Invoices counter increments by 1.
     - Assert Activity Log records: "Payment of $700.00 recorded for INV-MULTI-01".
- **Authoritative Invariant**: Invoice status dynamically tracks ratio of `amountPaid` to `grandTotal`; customer balance matches $\sum \text{amountDue}$.

### T3-INT-04: Full Arabic RTL Mirroring Across Complex Forms & Keyboard Navigation
- **Modules**: `F-RTL-01`, `F-RTL-02`, `F-RTL-03`, `F-INV-01`, `F-INV-03`
- **Precondition**: App in English LTR.
- **Steps**:
  1. Open "New Invoice" modal.
  2. Switch language to Arabic ("العربية").
  3. Assert modal flips direction (`dir="rtl"`), close button moves to top-left.
  4. Assert line item table columns order from right to left: Description $\to$ Qty $\to$ Price $\to$ Discount $\to$ Tax $\to$ Total.
  5. Focus Description input; press `Tab`; verify focus moves logically to Quantity (right-to-left flow).
  6. Fill row; press `Enter` on last cell; verify new row is appended and focused at the rightmost cell (Description).
  7. Verify currency total shows `ر.س` or `SAR` without scrambled numerals.
- **Authoritative Invariant**: Keyboard tab order and spatial visual layout correspond 1:1 in both LTR and RTL.

### T3-INT-05: Statement of Account Generation After Voided / Cancelled Invoices
- **Modules**: `F-STMT-01`, `F-INV-05`, `F-PAY-01`, `F-CUST-02`
- **Precondition**: Customer "Bavaria Ltd" with 2 invoices: Inv 1 ($400, Paid) and Inv 2 ($600, Unpaid).
- **Steps**:
  1. Cancel Inv 2 ($600).
  2. Open Statement Generator for Bavaria Ltd.
  3. Verify Statement lists Inv 1 (Debit $400), Payment 1 (Credit $400), and Inv 2 marked Void/Cancelled (Debit $0.00 or marked cancelled).
  4. Assert Statement Closing Balance equals `$0.00`.
- **Authoritative Invariant**: Cancelled invoices do not inflate customer receivables or statement closing balances.

### T3-INT-06: High-DPI Mobile Viewport Keyboard Data Entry
- **Modules**: `F-SHELL-02`, `F-SHELL-03`, `F-INV-01`, `F-INV-03`
- **Precondition**: Viewport set to mobile ($375 \times 667$).
- **Steps**:
  1. Open New Invoice form; verify form displays responsive mobile card-based line item inputs.
  2. Enter items using on-screen/keyboard inputs; verify Grand Total sticks to viewport bottom with high visibility.
  3. Verify compact cards prevent vertical scrolling blowout.

### T3-INT-07: Global Hotkeys Triggering Modals Across Different App Views
- **Modules**: `F-INV-04`, `F-CUST-01`, `F-DASH-01`
- **Precondition**: User is currently on Dashboard view.
- **Steps**:
  1. Press `Ctrl + N`; verify New Invoice modal opens immediately.
  2. Press `Escape`; verify modal closes and Dashboard is restored.
  3. Navigate to Customer Directory; press `Ctrl + N`; verify New Invoice modal opens.
  4. Press `Ctrl + Shift + C`; verify New Customer modal opens.
- **Authoritative Invariant**: Global hotkey dispatchers operate identically regardless of active route.

### T3-INT-08: Dark Mode Theme Persistence Across Window Reloads & Offline Mode
- **Modules**: `F-SHELL-04`, `F-SYNC-01`
- **Precondition**: Network offline (`disableNetwork()`).
- **Steps**:
  1. Switch to Dark Mode.
  2. Verify dark classes applied.
  3. Reload window while offline.
  4. Verify dark mode is instantly applied on initial render without light-mode flash (`FOUC`).

### T3-INT-09: Overdue Invoice Calculation Across Real-Time Date Transitions
- **Modules**: `F-DASH-04`, `F-INV-05`
- **Precondition**: Invoice created with due date set to today.
- **Steps**:
  1. Verify Overdue count is 0.
  2. Mock system date to advance by 24 hours (past midnight).
  3. Trigger query refresh; verify Overdue counter increments to 1.
  4. Verify Invoice status badge in list displays "Overdue" (red badge).

### T3-INT-10: Simultaneous Multi-Tab / Multi-Window IndexedDB Concurrency
- **Modules**: `F-SYNC-01`, `F-SYNC-02`
- **Precondition**: Two Electron browser windows opened against same user data directory.
- **Steps**:
  1. Create Customer in Window 1.
  2. Verify Window 2 receives real-time snapshot update via `BroadcastChannel` in `persistentMultipleTabManager`.
  3. Create Invoice in Window 2.
  4. Verify Window 1 reflects new invoice immediately.

### T3-INT-11: Customer Balance Integrity Under Heavy Rapid Invoicing
- **Modules**: `F-CUST-03`, `F-INV-01`
- **Precondition**: Customer with `$0.00` balance.
- **Steps**:
  1. Generate 20 invoices of varying amounts in parallel via atomic batches.
  2. Assert Customer `outstandingAmount` equals $\sum_{i=1}^{20} \text{invoice}_i.\text{grandTotal}$.
  3. Assert no lost updates or race conditions occurred.

### T3-INT-12: Complete Statement Reconciliation with Multi-Method Payments
- **Modules**: `F-STMT-01`, `F-PAY-03`
- **Precondition**: Customer with 3 invoices and 3 payments across Cash, Bank Transfer, and Card.
- **Steps**:
  1. Generate Statement of Account.
  2. Verify each payment line reflects exact payment method and reference number.
  3. Verify running balance decreases on each credit line.

### T3-INT-13: RTL Numerals and Currencies Inside Exported CSV and Printed PDFs
- **Modules**: `F-RTL-03`, `F-STMT-02`
- **Precondition**: Arabic mode active.
- **Steps**:
  1. Export Statement to CSV.
  2. Parse CSV; verify numbers are standard numeric floats (e.g. `1250.50`), and Arabic text is properly encoded in UTF-8 with BOM (`\uFEFF`).
  3. Print PDF; verify numbers render with LTR isolation in print CSS.

### T3-INT-14: Activity Log Event Retention and FIFO Pruning
- **Modules**: `F-DASH-05`
- **Precondition**: Activity log contains 50 entries.
- **Steps**:
  1. Perform new action (e.g. create invoice).
  2. Verify new event appears at top (index 0).
  3. Verify total rendered entries stays capped at limit without memory buildup.

### T3-INT-15: Recovery from Network Partition During Multi-Document Batch Submit
- **Modules**: `F-SYNC-01`, `F-SYNC-02`, `F-INV-01`, `F-CUST-03`
- **Precondition**: Network active.
- **Steps**:
  1. Initiate invoice save.
  2. Simulate network disconnect at the exact moment of submit.
  3. Verify writeBatch commits safely to local IndexedDB.
  4. Verify UI shows invoice saved and customer balance updated.
  5. Reconnect network; verify batch syncs cleanly to Firestore cloud.

---

## 7. Tier 4: Real-World Business Workflows & User Scenarios

Tier 4 tests model end-to-end user journeys simulating complete business operations.

### T4-WF-01: Freelancer Monthly Invoicing & Full Payment Cycle
- **Scenario**: A freelance consultant sets up a client, enters itemized billable hours and expenses, delivers the invoice, and records payment upon bank transfer receipt.
- **Steps**:
  1. **Client Setup**: Create customer "Apex Software Solutions" (SAR currency, tax ID `300123456700003`).
  2. **Invoice Generation**:
     - Line 1: "Fullstack Architecture Consulting" — 40 hours @ 150.00 SAR/hr.
     - Line 2: "Cloud Infrastructure Setup" — 1 unit @ 1,200.00 SAR (Fixed discount: 200.00 SAR).
     - Tax Rate: 15% VAT applied to both lines.
     - Real-Time Verification: Gross = $6,000 + 1,200 = 7,200$; Discount = $200$; Taxable = $7,000$; Tax = $1,050$; Grand Total = $8,050.00$ SAR.
  3. **Verification**: Save invoice; verify customer Outstanding Amount is `8,050.00` SAR; verify Activity Log records invoice creation.
  4. **Full Payment**: Client pays full amount via Bank Transfer with reference `SAR-WIRE-8891`.
  5. **Settlement**: Record full payment; verify invoice status is `PAID`; customer Outstanding Amount is `0.00` SAR; Total Revenue is updated by $+8,050.00$ SAR.

### T4-WF-02: Staggered Milestone Payments for Commercial Construction Contract
- **Scenario**: A contractor issues a $\$50,000.00$ invoice with payments split across 3 milestones (Deposit, Progress, Final).
- **Steps**:
  1. Create customer "Horizon Properties".
  2. Create invoice `INV-2026-CON` for $\$50,000.00$. Status is `UNPAID`.
  3. **Milestone 1 (Deposit 20%)**: Record payment of $\$10,000.00$.
     - Verify invoice status $\to$ `PARTIALLY_PAID`.
     - Verify `amountDue` is $\$40,000.00$; customer balance is $\$40,000.00$.
  4. **Milestone 2 (Progress 50%)**: Record payment of $\$25,000.00$.
     - Verify invoice status $\to$ `PARTIALLY_PAID`.
     - Verify `amountDue` is $\$15,000.00$; customer balance is $\$15,000.00$.
  5. **Milestone 3 (Final 30%)**: Record payment of $\$15,000.00$.
     - Verify invoice status $\to$ `PAID`.
     - Verify `amountDue` is $\$0.00$; customer balance is $\$0.00$.
  6. Generate Customer Statement; verify all 3 milestone payments appear in chronological order with accurate running balances.

### T4-WF-03: Field Service Technician Working Offline in Saudi Desert (Acceptance Master Test)
- **Scenario**: A technician operates the application in remote areas with zero connectivity, creating customer records and invoices in Arabic RTL, then syncing when back at headquarters.
- **Steps**:
  1. Technician launches Electron app.
  2. Toggles language to Arabic ("العربية"); asserts full RTL layout mirroring.
  3. Simulates zero network connectivity (`simulateOffline()`); sync indicator shows "Offline (Saved locally)".
  4. Creates customer "شركة الرمال الذهبية للتجارة" (Golden Sands Trading).
  5. Creates invoice:
     - Item 1: "صيانة مضخات هيدروليكية" (Hydraulic pump maintenance), Qty: 2, Price: 1,500.00 SAR, Tax: 15%.
     - Real-Time Check: Grand Total updates automatically to `3,450.00 ر.س`.
  6. Saves invoice while offline.
  7. Asserts customer balance shows `3,450.00 ر.س`.
  8. Technician closes Electron app and reboots laptop.
  9. Technician restarts Electron app while still offline.
  10. Asserts customer and invoice load perfectly from persistent IndexedDB.
  11. Records full cash payment of `3,450.00 ر.س` while offline; invoice status updates to "مدفوع" (Paid).
  12. Technician reconnects to office internet (`simulateOnline()`).
  13. Sync indicator shows "Syncing..." $\to$ "Online (Synced)".
  14. Backend Firestore emulator confirms all records exist with identical IDs and zero sync conflicts.

### T4-WF-04: Overdue Account Recovery & Statement Audit
- **Scenario**: Managing delinquent customer accounts, auditing transaction history, and exporting statements for collections.
- **Steps**:
  1. Locate customer with 2 overdue invoices ($1,500 and $2,200).
  2. Dashboard displays Overdue Invoices count $\ge 2$.
  3. Open Customer Ledger; verify both invoices are flagged with Overdue warning badges.
  4. Generate Statement of Account for last 90 days.
  5. Export statement to PDF; verify header displays company logo, customer details, and aging summary.
  6. Customer issues check clearing invoice 1; record payment; verify Overdue count decrements by 1.

### T4-WF-05: High-Speed Counter Sale with Pure Keyboard Navigation
- **Scenario**: Cashier processing rapid retail sales using only keyboard shortcuts without touching mouse.
- **Steps**:
  1. Cashier presses `Ctrl + N` to open New Invoice modal.
  2. Uses `ArrowDown` to pick "Walk-in Retail Customer" from customer select; presses `Enter`.
  3. Focus jumps to line items. Types "USB-C Fast Charger"; presses `Tab`.
  4. Types Qty `3`; presses `Tab`.
  5. Types Unit Price `25.00`; presses `Tab`.
  6. Leaves discount `0`; presses `Tab`.
  7. Selects Tax `15%`; presses `Enter`.
  8. A new empty line appears automatically with focus in Description.
  9. Types "HDMI Cable 2M"; presses `Tab`; Qty `2`; Price `15.00`.
  10. Asserts Grand Total shows `$116.15`.
  11. Presses `Ctrl + S` to save invoice. Modal closes.
  12. Total elapsed time $<15$ seconds; zero mouse events fired.

### T4-WF-06: Disputed Invoice Adjustment & Line Item Deletion
- **Scenario**: Customer questions an extra line item on an unpaid invoice; merchant edits invoice to remove item.
- **Steps**:
  1. Open invoice `INV-2026-0045` ($1,200 total: Item 1 $800 + Item 2 $400).
  2. Customer balance is currently `$1,200.00`.
  3. Delete Item 2 ($400) from invoice line item table.
  4. Grand Total automatically recalculates to `$800.00`.
  5. Save modified invoice.
  6. Customer Outstanding Amount drops from `$1,200.00 \to \$800.00`.
  7. Activity Log records: "Invoice INV-2026-0045 updated (New total: $800.00)".

### T4-WF-07: Tax Exemption & Fixed Discount Wholesale Purchase
- **Scenario**: Wholesale client with official tax exemption certificate purchasing in bulk with fixed volume discount.
- **Steps**:
  1. Create customer "National Charity Foundation" (Tax Exempt: True).
  2. Create invoice for 100 units @ $50.00 = $5,000.00.
  3. Apply Fixed Discount of $500.00.
  4. Set Tax Rate to 0% (Tax Exempt).
  5. Assert: Subtotal = $5,000.00, Discount = $500.00, Tax = $0.00, Grand Total = $4,500.00.
  6. Save invoice and verify print preview shows "Tax Exempt (0% VAT)".

### T4-WF-08: Fiscal Year-End Comprehensive Audit & CSV Export
- **Scenario**: Business accountant exporting complete year-to-date ledgers for external audit.
- **Steps**:
  1. Filter invoice directory by date range: `2026-01-01` to `2026-12-31`.
  2. Verify metrics match sum of all non-cancelled invoices.
  3. Export invoice list to CSV; verify all columns (Invoice #, Customer, Date, Subtotal, Tax, Grand Total, Status) populate accurately.
  4. Verify CSV adheres to RFC 4180 with standard decimal formatting.

### T4-WF-09: Interrupted Session & Recovery with Unsaved Form Confirmation
- **Scenario**: User begins drafting an invoice with 5 line items, accidentally presses Escape or Close window.
- **Steps**:
  1. Open New Invoice modal; fill 5 line items.
  2. Press `Escape` or click modal backdrop.
  3. System prompts confirmation dialog: "You have unsaved changes. Are you sure you want to discard?".
  4. Click "Cancel"; verify modal remains open with all 5 line items intact.
  5. Press `Ctrl + S`; verify invoice saves successfully.

### T4-WF-10: Multi-Currency Separation Integrity
- **Scenario**: Merchant servicing domestic clients (SAR) and international clients (USD).
- **Steps**:
  1. Create Customer A with currency `USD`.
  2. Create Customer B with currency `SAR`.
  3. Create USD invoice for Customer A ($500.00 USD).
  4. Create SAR invoice for Customer B (1,500.00 SAR).
  5. Assert Customer A profile displays balance `$500.00 USD`.
  6. Assert Customer B profile displays balance `1,500.00 ر.س`.
  7. Verify invoices isolate currencies and do not add incompatible currency values directly without warning.

---

## 8. Test Automation Execution & CI/CD Pipeline

### 8.1 NPM Script Interface
The following standard scripts are defined in `package.json`:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "test:offline": "playwright test tests/e2e/06_firestore_offline.spec.ts",
    "test:coverage": "vitest run --coverage"
  }
}
```

### 8.2 Playwright Electron Launcher (`tests/support/electronHarness.ts`)
```typescript
import { _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';

export interface TestAppInstance {
  app: ElectronApplication;
  window: Page;
  cleanup: () => Promise<void>;
}

export async function launchTestApp(): Promise<TestAppInstance> {
  const app = await electron.launch({
    args: [path.join(__dirname, '../../dist-electron/main.js')],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      VITE_USE_FIREBASE_EMULATOR: 'true'
    }
  });

  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  return {
    app,
    window,
    cleanup: async () => {
      await app.close();
    }
  };
}
```

### 8.3 CI/CD GitHub Actions Workflow (`.github/workflows/test.yml`)
```yaml
name: Test Suite (Unit, Integration, Electron E2E)

on:
  push:
    branches: [master, main]
  pull_request:
    branches: [master, main]

jobs:
  test:
    runs-on: windows-latest

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js 22 LTS
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Run Vitest Unit & Integration Tests
        run: npm run test:coverage

      - name: Build Application for Electron E2E
        run: npm run build

      - name: Run Playwright Electron E2E Suite
        run: npm run test:e2e

      - name: Upload Test Reports
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-reports
          path: |
            playwright-report/
            coverage/
```

---

## 9. Quality Verification & Defect Escalation Protocol

### 9.1 Zero Facade Test Policy
- Tests MUST interact with real DOM elements, trigger real event dispatches, and assert real state updates.
- Tests that always pass (e.g. `expect(true).toBe(true)` or empty callbacks) are strictly forbidden and will be flagged during code review.

### 9.2 Defect Escalation Standard
When an opaque-box test discovers an implementation defect during milestone development:
1. **Do NOT modify implementation code** (strictly reserved for implementing agents).
2. Document the defect in the agent's `handoff.md` with:
   - Target Feature ID and Test ID.
   - Exact input payload.
   - Observed behavior vs Expected output (authoritative source cited).
   - Verbatim stack trace or error log.
3. Message the orchestrator via `send_message` with defect details for delegation to the implementing agent.

---

## 10. Summary & Sign-off

The opaque-box E2E testing framework specified herein provides:
- **100% Feature Coverage**: All 32 discrete features mapped to $\ge 5$ Tier 1 tests ($160$ tests) and $\ge 5$ Tier 2 edge cases ($160$ tests).
- **15 Tier 3 Cross-Feature Integration Suites**: Exhaustive validation of multi-subsystem state synchronization.
- **10 Tier 4 Real-World Business Workflows**: End-to-end customer, invoicing, payment, and statement lifecycles.
- **Direct Acceptance Criteria Mapping**: AC 1 through AC 6 are rigorously verified via automated Playwright Electron and Vitest suites.
- **Robust Offline & RTL Verification**: Native desktop persistence and bidirectional Arabic layout mirroring are guaranteed.
