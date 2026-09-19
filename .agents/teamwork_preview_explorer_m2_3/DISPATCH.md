# Dispatch: Explorer M2-3 (Network Hook, Sync Indicator & Offline Harness)

**Agent Identity**: teamwork_preview_explorer_m2_3
**Working Directory**: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m2_3
**Role**: Network Hook, Sync Indicator & Offline Harness Specialist
**Milestone**: Milestone 2 (Firebase Offline-First & Financial Calculation Engine)

## Task Description
Investigate and specify the network state detection, SaaS sync indicator, and offline simulation test harness:
1. `src/hooks/useSyncStatus.ts`:
   - Listens to `window.addEventListener('online'/'offline')`.
   - Tracks pending writes across active Firestore snapshots (`snapshot.metadata.hasPendingWrites`).
   - Returns `{ isOnline: boolean, pendingSyncCount: number, status: 'synced' | 'syncing' | 'offline' }`.
2. `src/components/common/SyncBadge.tsx`:
   - Top-bar SaaS pill component displaying 3 distinct states:
     - 🟢 **Online (Synced)**: `online && pendingSyncCount === 0`
     - 🟡 **Syncing...**: `online && pendingSyncCount > 0`
     - 🔴 **Offline (Changes saved locally)**: `!online`
   - Bilingual (English & Arabic) and styled with compact pill geometry and tooltip.
3. Offline Simulation Harness (`tests/support/offline-harness.ts`):
   - Programmatically toggles Firestore network state via `disableNetwork(db)` and `enableNetwork(db)`.
   - Provides helper functions for integration tests to verify Acceptance Criterion AC6 ("Data can be written and read when network connection is disabled").
4. Unit tests: Design tests in `tests/unit/sync.test.ts`.

Read:
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\ORIGINAL_REQUEST.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\PROJECT.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_spec_miner_survey_2\handoff.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_survey_3\handoff.md

Output full implementation blueprints and code in `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m2_3\handoff.md` and report back via send_message.

## 2026-09-19T05:01:51Z
You are teamwork_preview_explorer_m2_3.
Your working directory is: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m2_3
Your task assignment is in: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m2_3\DISPATCH.md
Read:
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\ORIGINAL_REQUEST.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\PROJECT.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_spec_miner_survey_2\handoff.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_survey_3\handoff.md

Investigate and formulate the code blueprints for:
- src/hooks/useSyncStatus.ts (online/offline and pending write tracking).
- src/components/common/SyncBadge.tsx (compact SaaS status pill: Online/Synced, Syncing, Offline).
- tests/support/offline-harness.ts (programmatic disableNetwork/enableNetwork for AC6 verification).
- Unit test specifications for tests/unit/sync.test.ts.
Write your recommendations and code in c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m2_3\handoff.md and report back via send_message.
