# BRIEFING — 2026-09-19T09:51:00Z

## Mission
Investigate and design Customer Profile, Ledger View, and Transaction History (CustomerLedger.tsx) for Milestone 3.

## 🔒 My Identity
- Archetype: explorer
- Roles: Customer Ledger & History Specialist
- Working directory: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m3_2
- Original parent: 36d05cd7-07e7-4853-8044-3cce65da5cdc
- Milestone: Milestone 3 (Customer Directory & Financial Dashboard Modules)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Mobile-first (375px) responsive design priority
- Use compact card designs (<90px height)
- Full Arabic RTL mirroring and bidi protection (<BidiIsolate>, dir="rtl", LTR for codes/numbers)
- Financial precision using roundFinancial
- Offline-first queries using Firestore IndexedDB persistence cache

## Current Parent
- Conversation ID: 36d05cd7-07e7-4853-8044-3cce65da5cdc
- Updated: 2026-09-19T09:51:00Z

## Investigation State
- **Explored paths**:
  - `src/types/domain.ts` (Customer, Invoice, Payment, ActivityLog)
  - `src/lib/calculations.ts` (roundFinancial, formatCurrency)
  - `src/lib/firebase.ts` (persistentLocalCache, persistentMultipleTabManager, collection references)
  - `src/lib/atomicMutations.ts` (createInvoiceAtomic, recordPaymentAtomic)
  - `src/components/common/CompactCard.tsx`, `CompactMetricCard.tsx`, `BidiIsolate.tsx`
  - `src/context/DirectionContext.tsx`, `src/hooks/useSyncStatus.ts`
- **Key findings**:
  - Single-field equality queries (`where('customerId', '==', id)`) against `invoices` and `payments` work 100% offline from IndexedDB cache with zero composite index requirements.
  - Joining and sorting must occur in-memory chronologically (Oldest first) with primary sort on `date`, secondary on `createdAt`, and tie-breaker placing Invoice (Debit) before Payment (Credit) to prevent momentary negative balances.
  - Sequential balance updates using `roundFinancial(running + debit - credit)` eliminate IEEE-754 mantissa drift.
  - Mobile layout requires adaptive switch: on `< md` (375px), render compact transaction cards (<75px); on `md+`, render tabular ledger.
  - KPI cards must strictly observe `<90px` height (actual: 82px via `CompactMetricCard`).
  - Strict `<BidiIsolate>` wrapping is required on reference numbers, dates, currencies, and phone numbers.
- **Unexplored areas**: None remaining for Explorer M3-2.

## Key Decisions Made
- Authored drop-in replacement artifacts:
  - `proposed_useCustomerLedger.ts`
  - `proposed_CustomerProfileSummary.tsx`
  - `proposed_CustomerLedger.tsx`
- Complete 5-component handoff report generated in `handoff.md`.

## Artifact Index
- DISPATCH.md — Task assignment and instructions
- progress.md — Liveness heartbeat and milestone tracker
- proposed_useCustomerLedger.ts — Full hook implementation specification
- proposed_CustomerProfileSummary.tsx — Profile and compact KPI cards specification
- proposed_CustomerLedger.tsx — Full mobile-first & desktop ledger component
- handoff.md — Comprehensive 5-component handoff report
