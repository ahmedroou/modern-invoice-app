# Project: Modern Offline-First Desktop Invoice Application

## Executive Summary
A modern, offline-first Desktop application for managing accounts, invoices, and payments, featuring a premium SaaS-like UI, real-time calculations, seamless cloud sync (Firebase Firestore with IndexedDB local persistence), full Arabic RTL bidirectional support, and strong keyboard navigation.

---

## Architecture

### System Topology & Process Boundaries
```
+-------------------------------------------------------------------------+
|                              Desktop Host                               |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  |             Electron Main Process (Node.js 22 LTS)                 |  |
|  | - Window Lifecycle & Frameless Window Controls                     |  |
|  | - Privileged IPC Handlers (Native PDF Printing, File Dialogs)      |  |
|  | - Security Policy: contextIsolation: true, nodeIntegration: false  |  |
|  +----------------------------------+--------------------------------+  |
|                                     | (Preload contextBridge API)       |
|                                     v                                   |
|  +-------------------------------------------------------------------+  |
|  |                 Electron Renderer Process (Chromium)               |  |
|  |                                                                   |  |
|  |  +-------------------------------------------------------------+  |  |
|  |  |             React 18 / TypeScript SPA Application           |  |  |
|  |  | - Tailwind CSS Design System (CSS Logical Properties)       |  |  |
|  |  | - DirectionContext (LTR / RTL) & Local Cairo/Tajawal Fonts  |  |  |
|  |  | - ThemeContext (Light / Dark Mode)                          |  |  |
|  |  | - Real-time Calculation Engine (2-decimal financial math)   |  |  |
|  |  | - Keyboard Navigation & Global Shortcut Handlers            |  |  |
|  |  | - Compact Card & Responsive Mobile-First Layout             |  |  |
|  |  +------------------------------+------------------------------+  |  |
|  |                                 |                                 |  |
|  |                                 v                                 |  |
|  |  +-------------------------------------------------------------+  |  |
|  |  |                 Firebase Modular Web SDK v10+               |  |  |
|  |  | - initializeFirestore with persistentMultipleTabManager     |  |  |
|  |  | - Atomic Multi-Doc Mutations via writeBatch()               |  |  |
|  |  | - Network State Detection & Simulated Offline Harness      |  |  |
|  |  +------------------------------+------------------------------+  |  |
|  |                                 | (IndexedDB Storage Engine)      |  |
|  |                                 v                                 |  |
|  |  +-------------------------------------------------------------+  |  |
|  |  |             Chromium Local Cache (IndexedDB)                |  |  |
|  |  | - 100% Offline Read/Write, 0ms Local Persistence           |  |  |
|  |  +------------------------------+------------------------------+  |  |
|  +---------------------------------|---------------------------------+  |
+------------------------------------|------------------------------------+
                                     | (Background Sync when Online)
                                     v
                        +-------------------------+
                        |  Cloud Firestore Server |
                        +-------------------------+
```

### Data Flow
1. **Mutation Trigger**: User creates/updates Customer, Invoice, or Payment.
2. **Atomic Batch**: Domain service initiates `writeBatch(db)`.
   - Creating invoice: saves Invoice doc + increments Customer `outstandingAmount` + writes Activity Log entry.
   - Recording payment: saves Payment doc + adjusts Invoice `amountPaid` / `amountDue` / `status` + decrements Customer `outstandingAmount` + writes Activity Log entry.
3. **Local Immediate Commit**: `batch.commit()` resolves against local IndexedDB cache instantly without network latency.
4. **Reactive UI Update**: `onSnapshot` queries fire immediately with `hasPendingWrites: true`, rendering state to UI with 0ms delay.
5. **Background Cloud Synchronization**: When online, Firestore background worker synchronizes mutations to Cloud Firestore backend. When offline, mutations remain safely queued in IndexedDB across application restarts.

---

## Feature Inventory

Every feature identified in the requirements and survey handoffs is enumerated below with its assigned milestone:

| # | Feature ID | Feature Name | Description | Assigned Milestone | Source |
|---|------------|--------------|-------------|--------------------|--------|
| 1 | F-SHELL-01 | Electron App Launch | Native desktop window lifecycle, frameless titlebar with window controls | Milestone 1 | ORIGINAL_REQUEST §R1 |
| 2 | F-SHELL-02 | Mobile-First Shell Layout | Responsive flex/grid layout adapting from mobile (375px) to desktop (1920px) | Milestone 1 | User Global Rule |
| 3 | F-SHELL-03 | Compact KPI & Data Cards | Dense, space-efficient card design minimizing vertical footprint (<90px height) | Milestone 1 | User Global Rule |
| 4 | F-SHELL-04 | Dark / Light Mode Switching | Smooth toggle between Dark and Light color schemes with persistent storage | Milestone 1 | ORIGINAL_REQUEST §R1 |
| 5 | F-RTL-01 | Arabic / English Language Toggle | In-app language switch between English and Arabic with document dir update | Milestone 1 | ORIGINAL_REQUEST §R1 |
| 6 | F-RTL-02 | Complete RTL Mirroring | Bidirectional UI mirroring: sidebar, table columns, text alignment, chevron icons | Milestone 1 | ORIGINAL_REQUEST §R1 |
| 7 | F-RTL-03 | Bidirectional Numeral & Currency Isolation | Prevents bidi scrambling for numbers, currencies, and phone numbers in Arabic mode | Milestone 1 | Domain Spec |
| 8 | F-SHELL-05 | Smooth Transitions & Micro-interactions | Page transitions, button clicks, toast notifications, status badges | Milestone 1 | ORIGINAL_REQUEST §R1 |
| 9 | F-SYNC-01 | Firestore Local Persistence | IndexedDB local cache via persistentMultipleTabManager for instant offline CRUD | Milestone 2 | ORIGINAL_REQUEST §R3 |
| 10 | F-SYNC-02 | Background Cloud Sync Engine | Automatic bidirectional sync between local IndexedDB and remote Cloud Firestore | Milestone 2 | ORIGINAL_REQUEST §R3 |
| 11 | F-SYNC-03 | Network Status & Sync Indicator | Top-bar SaaS status pill indicating Online (Synced), Syncing, or Offline Mode | Milestone 2 | ORIGINAL_REQUEST §R3 |
| 12 | F-SYNC-04 | Offline Test & Simulation Harness | Programmatic harness allowing offline disconnection and verification of local persistence | Milestone 2 | ORIGINAL_REQUEST §R3 |
| 13 | F-CALC-01 | Real-Time Automatic Calculation Engine | Live calculation of line totals, subtotal, discount, tax, and grand total | Milestone 2 | ORIGINAL_REQUEST §R2 |
| 14 | F-CALC-02 | Financial Precision Math | Epsilon-safe 2-decimal financial rounding avoiding binary float arithmetic errors | Milestone 2 | Domain Spec |
| 15 | F-CUST-01 | Customer Directory & CRUD | Form to add, update, view, and search customer profiles | Milestone 3 | ORIGINAL_REQUEST §R2 |
| 16 | F-CUST-02 | Customer Profile & Ledger View | View showing contact info, outstanding balance, and transaction history | Milestone 3 | ORIGINAL_REQUEST §R2 |
| 17 | F-CUST-03 | Instant Customer Balance Sync | Real-time balance updating upon invoice generation, editing, or payment | Milestone 3 | ORIGINAL_REQUEST §R2 |
| 18 | F-DASH-01 | Total Revenue Metric Card | Displays total revenue collected from all completed invoice payments | Milestone 3 | ORIGINAL_REQUEST §R2 |
| 19 | F-DASH-02 | Outstanding Receivables Metric Card | Displays total unpaid balance across all non-cancelled invoices | Milestone 3 | ORIGINAL_REQUEST §R2 |
| 20 | F-DASH-03 | Paid Invoices Counter Card | Real-time counter of invoices whose balance is fully cleared | Milestone 3 | ORIGINAL_REQUEST §R2 |
| 21 | F-DASH-04 | Overdue Invoices Counter Card | Real-time counter of invoices past due date with outstanding balance | Milestone 3 | ORIGINAL_REQUEST §R2 |
| 22 | F-DASH-05 | Real-Time Activity Log | Chronological list of business events (invoices, payments, customers) | Milestone 3 | ORIGINAL_REQUEST §R2 |
| 23 | F-INV-01 | Invoice Creation & Real-Time Calculation | Live updating Grand Total as line items are modified, without calculate button | Milestone 4 | ORIGINAL_REQUEST §R2 |
| 24 | F-INV-02 | Itemized Line Item Management | Dynamic addition, deletion, and recalculation of invoice line items | Milestone 4 | ORIGINAL_REQUEST §R2 |
| 25 | F-INV-03 | Keyboard-Driven Grid Navigation | Fast keyboard navigation (Tab, Shift+Tab, Enter creates row, Arrow navigation) | Milestone 4 | ORIGINAL_REQUEST §R2 |
| 26 | F-INV-04 | Global Keyboard Shortcuts | Hotkeys for power users (Ctrl+N new invoice, Ctrl+S save, Esc close modal) | Milestone 4 | ORIGINAL_REQUEST §R2 |
| 27 | F-INV-05 | Invoice Status Auto-Transition | Automatic transition: Draft -> Unpaid -> Partially Paid -> Paid / Overdue | Milestone 4 | ORIGINAL_REQUEST §R2 |
| 28 | F-INV-06 | Invoice Search & Filter | Filter invoices by customer, status, and date range | Milestone 4 | ORIGINAL_REQUEST §R2 |
| 29 | F-PAY-01 | Record Full Payment | Record payment equal to amountDue; marks invoice Paid, clears balance | Milestone 4 | ORIGINAL_REQUEST §R2 |
| 30 | F-PAY-02 | Record Partial Payment | Record payment less than amountDue; marks invoice Partially Paid, updates balance | Milestone 4 | ORIGINAL_REQUEST §R2 |
| 31 | F-PAY-03 | Multi-Method Payment Logging | Logs payment method (Cash, Bank Transfer, Card, Check) and reference number | Milestone 4 | ORIGINAL_REQUEST §R2 |
| 32 | F-STMT-01 | Customer Statement Generator | Generates customer ledger with opening balance, debit/credit rows, closing balance | Milestone 4 | ORIGINAL_REQUEST §R2 |
| 33 | F-STMT-02 | Statement Export & Print View | Print preview and PDF/CSV export for customer statements and invoices | Milestone 4 | ORIGINAL_REQUEST §R2 |
| 34 | F-VERIF-01 | Full Acceptance Test Pass | Automated execution of all 6 acceptance criteria across E2E test suites | Milestone 5 | ORIGINAL_REQUEST AC |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Foundation, Shell, Theming & RTL | Project scaffolding, Electron main/preload IPC, Tailwind CSS logical properties, Cairo/Tajawal local fonts, ThemeProvider, DirectionProvider, frameless window titlebar, responsive layout shell | None | DONE |
| M2 | Firebase Offline-First & Financial Engine | Firestore config with persistentMultipleTabManager, network detection hook, sync status indicator, offline simulation harness, calculations.ts with 2-decimal epsilon rounding and unit tests | M1 | DONE |
| M3 | Customer Directory & Financial Dashboard | Customer CRUD, Customer ledger view, instant balance updating hook, compact KPI cards (<90px height), chronological Activity Log | M2 | DONE |
| M4 | Invoices, Payments & Statements | Invoice form with live calculations, keyboard grid navigation & shortcuts, status auto-transitions, partial/full payment recording, Statement of Account generator and print/export | M2, M3 | IN_PROGRESS |
| M5 | E2E Acceptance Pass, Adversarial Hardening & Audit | 100% pass of E2E test suite (Tiers 1-4), adversarial edge cases (Tier 5), forensic integrity verification | M1, M2, M3, M4 | PLANNED |

---

## Interface Contracts

### 1. Electron Main <-> Preload Bridge (`window.electronAPI`)
```typescript
export interface PrintInvoiceOptions {
  invoiceId: string;
  invoiceNumber: string;
  htmlContent?: string;
}

export interface ExportDataOptions {
  format: 'json' | 'csv';
  data: string;
  suggestedFilename: string;
}

export interface IElectronAPI {
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  printInvoicePDF: (options: PrintInvoiceOptions) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  exportFile: (options: ExportDataOptions) => Promise<{ success: boolean; filePath?: string }>;
  getAppVersion: () => Promise<string>;
  getSystemTheme: () => Promise<'light' | 'dark'>;
  onThemeChanged: (callback: (theme: 'light' | 'dark') => void) => () => void;
}
```

### 2. Financial Math Engine (`src/lib/calculations.ts`)
```typescript
export interface LineItemInput {
  quantity: number;
  unitPrice: number;
  discount: number;
  discountType: 'PERCENTAGE' | 'FIXED';
  taxRate: number;
}

export interface CalculatedLineItem extends LineItemInput {
  grossAmount: number;
  lineDiscount: number;
  taxableAmount: number;
  lineTax: number;
  lineTotal: number;
}

export interface InvoiceTotals {
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
  amountDue: number;
}

export function roundFinancial(amount: number, decimals?: number): number;
export function calculateLineItem(item: LineItemInput): CalculatedLineItem;
export function calculateInvoiceTotals(items: LineItemInput[], amountPaid?: number): InvoiceTotals;
export function formatCurrency(amount: number, currency?: string, locale?: string): string;
```

### 3. Direction & RTL Context (`src/context/DirectionContext.tsx`)
```typescript
export type Direction = 'ltr' | 'rtl';
export type Language = 'en' | 'ar';

export interface DirectionContextValue {
  direction: Direction;
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
}
```

### 4. Domain Data Interfaces (`src/types/domain.ts`)
```typescript
export type InvoiceStatus = 'DRAFT' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CREDIT_CARD' | 'CHECK' | 'ONLINE_GATEWAY' | 'OTHER';

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

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  discountType: 'PERCENTAGE' | 'FIXED';
  taxRate: number;
  lineDiscount: number;
  lineTax: number;
  lineTotal: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  items: InvoiceItem[];
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
  amountPaid: number;
  amountDue: number;
  status: InvoiceStatus;
  notes?: string;
  terms?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  paymentNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  notes?: string;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  eventType: 'CUSTOMER_CREATED' | 'CUSTOMER_UPDATED' | 'INVOICE_CREATED' | 'INVOICE_UPDATED' | 'INVOICE_STATUS_CHANGED' | 'PAYMENT_RECORDED';
  entityType: 'CUSTOMER' | 'INVOICE' | 'PAYMENT';
  entityId: string;
  description: string;
  metadata?: Record<string, any>;
}
```

---

## Code Layout

```
modern-invoice-desktop/
├── electron/
│   ├── main.ts                    # Native Electron window lifecycle, frameless overlay
│   ├── preload.ts                 # Secure contextBridge API definition
│   └── ipcHandlers.ts             # IPC listeners for PDF printing, dialogs, window controls
├── src/
│   ├── assets/
│   │   └── fonts/                 # Cairo & Tajawal local .woff2 fonts (offline-ready)
│   ├── components/
│   │   ├── layout/
│   │   │   ├── TitleBar.tsx       # Custom SaaS frameless titlebar with window controls
│   │   │   ├── Sidebar.tsx        # Responsive collapsible sidebar (flips in RTL)
│   │   │   ├── MobileNav.tsx      # Mobile drawer/bottom navigation
│   │   │   └── AppLayout.tsx      # Root responsive wrapper
│   │   ├── common/
│   │   │   ├── CompactCard.tsx    # Space-efficient card component (<90px KPI)
│   │   │   ├── SyncBadge.tsx      # SaaS network & sync status indicator
│   │   │   ├── Modal.tsx          # Accessible modal dialog with focus trapping
│   │   │   └── Button.tsx         # Styled button with loading state and ripple
│   │   └── modules/
│   │       ├── dashboard/
│   │       │   ├── DashboardView.tsx
│   │       │   ├── MetricsGrid.tsx
│   │       │   └── ActivityFeed.tsx
│   │       ├── customers/
│   │       │   ├── CustomerList.tsx
│   │       │   ├── CustomerModal.tsx
│   │       │   └── CustomerLedger.tsx
│   │       ├── invoices/
│   │       │   ├── InvoiceList.tsx
│   │       │   ├── InvoiceForm.tsx # Real-time calculations & keyboard grid navigation
│   │       │   └── InvoiceDetail.tsx
│   │       ├── payments/
│   │       │   ├── PaymentModal.tsx
│   │       │   └── PaymentList.tsx
│   │       └── statements/
│   │           ├── StatementGenerator.tsx
│   │           └── StatementPrintView.tsx
│   ├── context/
│   │   ├── DirectionContext.tsx   # LTR/RTL bidirectional management
│   │   └── ThemeContext.tsx       # Light/Dark mode state management
│   ├── hooks/
│   │   ├── useInvoices.ts         # Firestore live query & batch actions for invoices
│   │   ├── useCustomers.ts        # Firestore live query & batch actions for customers
│   │   ├── usePayments.ts         # Payment recording & invoice status updates
│   │   ├── useActivityLog.ts      # Activity feed subscription
│   │   └── useSyncStatus.ts       # Network online/offline & pending write detector
│   ├── lib/
│   │   ├── firebase.ts            # Firestore persistentMultipleTabManager initialization
│   │   ├── calculations.ts        # Epsilon-safe financial calculations and currency format
│   │   └── keyboard.ts            # Global hotkey and grid navigation helpers
│   ├── types/
│   │   ├── domain.ts              # Data interfaces (Customer, Invoice, Payment, Log)
│   │   └── electron.d.ts          # Window.electronAPI typed signatures
│   ├── App.tsx                    # Root routing & layout container
│   ├── index.css                  # Tailwind styles & local @font-face rules
│   └── main.tsx                   # React 18 DOM mount
├── tests/
│   ├── unit/                      # Vitest unit tests (calculations, formatting, hooks)
│   ├── integration/               # Component integration tests (forms, offline simulation)
│   └── e2e/                       # Playwright Electron end-to-end acceptance tests
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```
