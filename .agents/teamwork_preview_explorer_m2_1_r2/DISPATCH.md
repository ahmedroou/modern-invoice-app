# Dispatch: Explorer M2-1 Replacement (Firestore Offline Persistence & MultiTab Manager)

**Agent Identity**: teamwork_preview_explorer_m2_1_r2
**Working Directory**: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m2_1_r2
**Role**: Firestore Offline Persistence Specialist
**Milestone**: Milestone 2 (Firebase Offline-First & Financial Calculation Engine)

## Task Description
Investigate and specify the exact implementation of Firebase Firestore offline persistence in the Electron Chromium renderer process:
1. `src/lib/firebase.ts`:
   - Configure Firebase modular SDK v11 (`firebase/app`, `firebase/firestore`).
   - Use `initializeFirestore()` with `persistentLocalCache({ tabManager: persistentMultipleTabManager(), cacheSizeBytes: CACHE_SIZE_UNLIMITED })` to bind to Chromium IndexedDB.
   - Explain why `persistentMultipleTabManager` is critical for Electron (preventing single-tab lock collisions during reloads and multi-window views).
   - Support optional emulator connection (`connectFirestoreEmulator`) via environment variables.
2. Atomic Multi-Document Mutations:
   - Provide concrete patterns showing why `writeBatch(db)` MUST be used instead of `runTransaction(db)` for offline operations (transactions fail offline without server concurrency).
   - Show how invoice creation + customer balance increment + activity log writes are executed atomically via `batch.commit()`.

Read:
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\ORIGINAL_REQUEST.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\PROJECT.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_spec_miner_survey_2\handoff.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_survey_3\handoff.md

Output full implementation blueprints and code in `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m2_1_r2\handoff.md` and report back via send_message.

## 2026-09-19T09:30:14Z
<USER_REQUEST>
You are teamwork_preview_explorer_m2_1_r2.
Your working directory is: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m2_1_r2
Your task assignment is in: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m2_1_r2\DISPATCH.md
Read:
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\ORIGINAL_REQUEST.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\PROJECT.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_spec_miner_survey_2\handoff.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_survey_3\handoff.md

Investigate and formulate the code blueprints for Firebase Firestore offline persistence in src/lib/firebase.ts:
- initializeFirestore with persistentMultipleTabManager and CACHE_SIZE_UNLIMITED in Chromium IndexedDB.
- Atomic multi-document mutations using writeBatch() instead of runTransaction().
Write your recommendations and code in c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m2_1_r2\handoff.md and report back via send_message.
</USER_REQUEST>
