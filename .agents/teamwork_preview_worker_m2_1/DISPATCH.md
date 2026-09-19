# Dispatch: Worker M2-1 (Milestone 2 Implementation)

**Agent Identity**: teamwork_preview_worker_m2_1
**Working Directory**: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_worker_m2_1
**Role**: Firebase Offline-First & Financial Math Implementation Specialist
**Milestone**: Milestone 2 (Firebase Offline-First & Financial Calculation Engine)

## Task Description
Implement Milestone 2 by integrating Firebase Firestore offline persistence, atomic batched mutations, real-time financial math, sync status monitoring, and offline simulation test harnesses according to the blueprints from Explorers M2-1, M2-2, and M2-3:

### Mandatory Inputs to Read:
1. `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\ORIGINAL_REQUEST.md` (MANDATORY)
2. `c:\Users\ayami\Documents\antigravity\focused-hypatia\PROJECT.md`
3. Explorer M2-1 Blueprint (Firebase Persistence & writeBatch):
   - `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m2_1_r2\handoff.md`
   - `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m2_1_r2\proposed_firebase.ts`
   - `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m2_1_r2\proposed_atomic_mutations.ts`
4. Explorer M2-2 Blueprint (Financial Math & Precision):
   - `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m2_2_r2\handoff.md`
   - `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m2_2_r2\proposed_calculations.ts`
   - `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m2_2_r2\proposed_calculations.test.ts`
5. Explorer M2-3 Blueprint (SyncStatus, SyncBadge & Offline Harness):
   - `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m2_3_r2\handoff.md`

### Write Ownership
You have exclusive write access to:
- `src/lib/firebase.ts`
- `src/lib/calculations.ts`
- `src/lib/atomicMutations.ts`
- `src/hooks/useSyncStatus.ts`
- `src/components/common/SyncBadge.tsx`
- `src/components/layout/AppLayout.tsx` (integrate SyncBadge in top bar)
- `src/components/layout/MobileNav.tsx` (integrate SyncBadge in mobile header)
- `tests/support/offline-harness.ts`
- `tests/unit/calculations.test.ts`
- `tests/unit/sync.test.ts`

### Implementation Steps:
1. Implement `src/lib/firebase.ts`:
   Configure `initializeFirestore` with `persistentLocalCache({ tabManager: persistentMultipleTabManager(), cacheSizeBytes: CACHE_SIZE_UNLIMITED })` and offline test hooks (`simulateOffline`, `simulateOnline`, `window.__TEST_SIMULATE_OFFLINE__`).
2. Implement `src/lib/calculations.ts`:
   Implement epsilon-safe `roundFinancial`, `calculateLineItem` (percentage & fixed discount capping, taxes, lineTotal), `calculateInvoiceTotals` (subtotal, totalDiscount, totalTax, grandTotal, amountDue, status state transitions), and `formatCurrency` (Arabic RTL bidi protection with `\u200e`).
3. Implement `src/lib/atomicMutations.ts`:
   Implement `createInvoiceAtomic` and `recordPaymentAtomic` using `writeBatch(db)` to guarantee 100% offline atomic writes without network dependencies.
4. Implement `src/hooks/useSyncStatus.ts` and `src/components/common/SyncBadge.tsx`:
   Track `online`/`offline` and pending writes. Mount `<SyncBadge />` in `AppLayout.tsx` and `MobileNav.tsx` with compact pill styling and Arabic/English tooltips.
5. Implement `tests/support/offline-harness.ts` and tests:
   Add `tests/unit/calculations.test.ts` and `tests/unit/sync.test.ts`.
6. Run Verification Commands:
   - `npm run build` (confirm clean compilation, 0 TypeScript errors).
   - `npm test` (confirm all unit tests pass, including new calculation and sync tests).
   - `npm run test:smoke` (confirm headless Electron launch continues to pass cleanly).

### MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Document all findings and command outputs in `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_worker_m2_1\handoff.md` and report back via `send_message`.

## 2026-09-19T09:35:17Z
Implement Milestone 2 (Firebase Offline-First Persistence & Financial Calculation Engine):
1. src/lib/firebase.ts: initializeFirestore with persistentMultipleTabManager and CACHE_SIZE_UNLIMITED in IndexedDB, plus offline simulation hooks.
2. src/lib/calculations.ts: epsilon-safe roundFinancial, calculateLineItem, calculateInvoiceTotals, and formatCurrency with Arabic RTL bidi protection.
3. src/lib/atomicMutations.ts: atomic writeBatch() operations for createInvoiceAtomic and recordPaymentAtomic.
4. src/hooks/useSyncStatus.ts and src/components/common/SyncBadge.tsx: network/pending write tracker and compact top-bar SaaS sync pill integrated in AppLayout and MobileNav.
5. tests/support/offline-harness.ts, tests/unit/calculations.test.ts, and tests/unit/sync.test.ts.
6. Run npm run build, npm test, and npm run test:smoke to verify clean builds and 100% test passes.
