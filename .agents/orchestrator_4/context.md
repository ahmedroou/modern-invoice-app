# Orchestrator Launch Context — Generation 4

## Project Overview
Modern offline-first Desktop application for managing accounts, invoices, and payments, built with Electron, React, TypeScript, and Firebase Firestore (offline persistence).

## Authority & Requirements
- **Authoritative User Request**: `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\ORIGINAL_REQUEST.md`
- **Architecture & Milestones**: `c:\Users\ayami\Documents\antigravity\focused-hypatia\PROJECT.md`
- **E2E Test Architecture**: `c:\Users\ayami\Documents\antigravity\focused-hypatia\TEST_INFRA.md`

## Current Codebase Status
- **Automated Tests**: 340/340 tests passing across 24 test suites (`npm test`).
- **Production Build**: Clean build passes (`npm run build` runs `tsc && vite build`).
- **Smoke Tests**: Live headless Electron smoke test passes (`npm run test:smoke`, 10/10 IPC methods verified).
- **M1 (App Shell, Theming & RTL Foundation)**: COMPLETE & CERTIFIED.
- **M2 (Offline Firebase Persistence & Financial Math Engine)**: COMPLETE & CERTIFIED.
- **M3 (Customer Directory & Financial Dashboard Modules)**: Code implemented, 340 tests passing, strict TypeScript clean, compact cards (<90px) verified. Wrap Gate 3 certification.

## Immediate Objective: Rapidly Deliver M4 & M5
Per user instruction:
> *USER NOTE: Focus on completing the remaining milestones (M4 Invoices, M5 E2E Testing) rapidly and ensuring the final application is delivered in the best possible shape and quality.*

### Milestone 4: Invoices, Payments & Statements
1. **Invoice Management & Real-Time Calculation Engine**:
   - Invoice list and creation/editing forms.
   - Real-time automatic calculations: Line totals (`quantity * unitPrice - discount + tax`), Subtotal, Total Discount, Total Tax, and Grand Total update automatically on keystroke/change without a 'calculate' button.
   - Strong keyboard navigation: Tab/Enter progression through item rows, arrow keys, shortcut to add row, escape to cancel.
   - Updating customer's "Outstanding Amount" instantly via atomic batch mutations (`writeBatch`).
   - Compact cards for invoice list (<90px height) and mobile-first responsive layout.
2. **Payments Module**:
   - Record partial and full payments against invoices.
   - Automatic status transition to "Paid" when fully paid, "Partial" when partially paid.
   - Activity log reflection: Every payment records an activity log entry instantly.
   - Updates customer balance and invoice remaining balance atomically.
3. **Statements Generation**:
   - Customer statement view / print-ready statement.
   - Date range filtering, opening balance, transactions (invoices, payments), running balances, and closing balance.
   - Bilingual (English & Arabic RTL) statement formatting.

### Milestone 5: E2E Acceptance Pass, Adversarial Coverage & Final Verification
1. Opaque-box E2E test suite covering:
   - Electron app launch.
   - Arabic RTL mirroring and layout containment.
   - Invoice creation with real-time automatic Grand Total calculations.
   - Customer outstanding amount instant update.
   - Full payment recording, status change to "Paid", and activity log reflection.
   - Offline CRUD operations when network is disabled (IndexedDB persistence).
2. Clean forensic audit, zero cheating, 100% genuine code.
3. Report victory to Sentinel with full verification evidence.

## User Global Rules to Enforce
- **Mobile-First Design**: UI/UX fully optimized for mobile responsiveness across all views (compact card designs <90px height, efficient use of width, no horizontal overflow).
- **Arabic RTL**: Full mirroring, correct directionality, Tajawal/Cairo typography.
- **Offline-First**: Never use `runTransaction` for offline paths; use `writeBatch` for guaranteed local writes. Epsilon-safe financial calculations.
