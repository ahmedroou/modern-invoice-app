# BRIEFING — 2026-09-19T09:30:14Z

## Mission
Investigate and formulate the code blueprints for Firebase Firestore offline persistence in src/lib/firebase.ts with persistentMultipleTabManager, CACHE_SIZE_UNLIMITED, emulator support, and writeBatch atomic multi-document mutations.

## 🔒 My Identity
- Archetype: explorer
- Roles: Firestore Offline Persistence Specialist
- Working directory: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m2_1_r2
- Original parent: 36d05cd7-07e7-4853-8044-3cce65da5cdc
- Milestone: Milestone 2 (Firebase Offline-First & Financial Calculation Engine)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement directly in source code (code proposals go in handoff/proposed files)
- Configure Firebase modular SDK v11 (`firebase/app`, `firebase/firestore`)
- Use `initializeFirestore()` with `persistentLocalCache({ tabManager: persistentMultipleTabManager(), cacheSizeBytes: CACHE_SIZE_UNLIMITED })`
- Detail why `persistentMultipleTabManager` is critical for Electron (IndexedDB lock contention on reload/multi-window)
- Detail why `writeBatch(db)` MUST be used instead of `runTransaction(db)` for offline operations
- Deliver comprehensive blueprints in `handoff.md` and report back via `send_message` to parent (`36d05cd7-07e7-4853-8044-3cce65da5cdc`)

## Current Parent
- Conversation ID: 36d05cd7-07e7-4853-8044-3cce65da5cdc
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `ORIGINAL_REQUEST.md` (R1-R3, AC1-AC6)
  - `PROJECT.md` (System topology, offline data flow, interface contracts, code layout)
  - `.agents/teamwork_preview_spec_miner_survey_2/handoff.md` (Financial domain model, offline sync mechanics)
  - `.agents/teamwork_preview_explorer_survey_3/handoff.md` (Electron + React architecture, v10+ Firestore persistence patterns)
  - `package.json` (Confirmed `firebase: ^11.4.0`, Node 22, Electron 34, Vite 5)
  - `src/types/domain.ts` (Customer, Invoice, Payment, ActivityLog schemas)
  - `node_modules/@firebase/firestore` (Source inspection of `WebStorageSharedClientState`, `IndexedDbPersistence`, `persistentMultipleTabManager`, `writeBatch`)
- **Key findings**:
  - `persistentMultipleTabManager()` coordinates tab leases using WebStorage (`window.localStorage`) and Web Locks, eliminating crashes on Electron window reloads and multi-window views.
  - `CACHE_SIZE_UNLIMITED` (-1) completely disables LRU garbage collection, preserving financial history indefinitely.
  - `runTransaction()` requires server roundtrip to guarantee ACID isolation; it fails offline with `[code=unavailable]`.
  - `writeBatch()` writes atomically to the local IndexedDB mutation queue and resolves immediately, triggering reactive UI updates (`hasPendingWrites: true`) in 0ms.
  - Full type safety verified across `proposed_firebase.ts` and `proposed_atomic_mutations.ts` with zero TypeScript errors.
- **Unexplored areas**:
  - None within Milestone 2-1 scope. Ready for implementation.

## Key Decisions Made
- Architected `src/lib/firebase.ts` with singleton FirebaseApp, guarded `initializeFirestore` fallback, and optional emulator hook.
- Implemented network simulation hooks (`simulateOffline`, `simulateOnline`) mapped to `window.__TEST_SIMULATE_OFFLINE__` for Playwright E2E automation.
- Specified atomic multi-document workflows for Invoice Creation (`createInvoiceAtomic`) and Payment Recording (`recordPaymentAtomic`) using `writeBatch()`.

## Artifact Index
- `.agents/teamwork_preview_explorer_m2_1_r2/DISPATCH.md` — Task definition and assignment
- `.agents/teamwork_preview_explorer_m2_1_r2/BRIEFING.md` — Working memory and identity
- `.agents/teamwork_preview_explorer_m2_1_r2/progress.md` — Liveness heartbeat and milestone progress
- `.agents/teamwork_preview_explorer_m2_1_r2/proposed_firebase.ts` — Full implementation blueprint for `src/lib/firebase.ts`
- `.agents/teamwork_preview_explorer_m2_1_r2/proposed_atomic_mutations.ts` — Full implementation blueprint for atomic batch operations
- `.agents/teamwork_preview_explorer_m2_1_r2/handoff.md` — Final 5-component handoff report
