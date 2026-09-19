# Dispatch: Explorer M2-3 Replacement (Network Hook, Sync Indicator & Offline Harness)

**Agent Identity**: teamwork_preview_explorer_m2_3_r2
**Working Directory**: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m2_3_r2
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

Output full implementation blueprints and code in `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m2_3_r2\handoff.md` and report back via send_message.
