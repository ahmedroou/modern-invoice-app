# BRIEFING — 2026-09-19T09:35:30Z

## Mission
Orchestrate the development, verification, and end-to-end delivery of the modern offline-first Desktop Invoice Application (Electron + React + TypeScript + Firebase Firestore + Arabic RTL).

## 🔒 My Identity
- Archetype: Project Orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\orchestrator_2
- Original parent: parent
- Original parent conversation ID: e91dce37-11c3-4ff0-8530-334331e2ff0b

## 🔒 My Workflow
- **Pattern**: Project Pattern (Dual Track: Implementation Track + E2E Testing Track)
- **Scope document**: c:\Users\ayami\Documents\antigravity\focused-hypatia\PROJECT.md
1. **Decompose**: 5 discrete milestones mapped along module boundaries and financial data flow.
   - M1: Foundation, Electron App Shell, Theming & RTL Engine [DONE]
   - M2: Firebase Offline-First Persistence & Financial Calculation Engine [DONE]
   - M3: Customer Directory & Financial Dashboard Modules [IN_PROGRESS - Dispatching Explorers]
   - M4: Invoices, Payments & Statements Modules [PLANNED]
   - M5: Full E2E Acceptance Pass, Adversarial Coverage Hardening & Forensic Integrity Audit [PLANNED]
   - Parallel Track: Opaque-Box E2E Testing Track (Tiers 1-4) [TEST_INFRA.md published]
2. **Dispatch & Execute**:
   - For each milestone: Explorer (analyze & plan) -> Worker (implement & test) -> Reviewer (code & requirement review) -> Challenger (empirical verification) -> Forensic Auditor (integrity check) -> Gate.
3. **On failure**:
   - Retry: nudge stuck agent or re-send task
   - Replace: spawn fresh agent with partial progress
   - Skip: proceed without (only if non-critical; NEVER skip auditor)
   - Redistribute: split stuck agent's remaining work
   - Redesign: re-partition decomposition
4. **Succession**:
   - Subagent `self` not present in runtime environment, orchestrator continues execution directly.
- **Work items**:
  1. Initialize Orchestrator State & PROJECT.md [done]
  2. E2E Testing Suite Creation (Test Writer Track) [done - TEST_INFRA.md published]
  3. Milestone 1: App Shell & RTL [done - certified PASS at Gate 1 Iteration 2]
  4. Milestone 2: Offline Firebase & Financial Math [done - certified PASS at Gate 2 Iteration 1]
  5. Milestone 3: Customers & Dashboard [done - certified PASS at Gate 3 Iteration 2]
  6. Milestone 4: Invoices, Payments & Statements [in-progress - Dispatching Explorers]
  7. Milestone 5: E2E Pass, Hardening & Audit [pending]
- **Current phase**: 4 (Milestone 4 Exploration & Planning)
- **Current focus**: Dispatching Explorers for Invoices, Payments & Statements modules.

## 🔒 Key Constraints
- Never write, modify, or create source code files directly.
- Never run build/test commands directly — delegate to subagents.
- Never investigate or explore at the code level — dispatch Explorers.
- File editing permitted ONLY for metadata/state files (.md) in .agents/ folder and PROJECT.md at project root.
- MANDATORY INTEGRITY WARNING must be included in every Worker dispatch prompt.
- Forensic Auditor verdict is a BINARY VETO — violation means unconditional failure.
- Never reuse a subagent after it has delivered its handoff — always spawn fresh.
- Always adhere to User Global Directives: Mobile-first responsive design, compact card designs, performance optimization, zero unverified assumptions.

## Current Parent
- Conversation ID: e91dce37-11c3-4ff0-8530-334331e2ff0b
- Updated: 2026-09-19T14:48:00Z

## Key Decisions Made
- Node 22.15.0 and npm 10.9.2 standardized as runtime and package manager.
- Electron + React 18 + TypeScript + Vite + Tailwind CSS chosen for fast HMR and lightweight bundle.
- Preload script compiled as CommonJS (`preload.cjs`) to satisfy Electron sandboxed renderer requirements.
- Offline persistence configured using modern Firebase v10+ `persistentLocalCache({ tabManager: persistentMultipleTabManager() })` backed by Chromium IndexedDB.
- All multi-document mutations must use `writeBatch()` rather than `runTransaction()` to guarantee offline execution without network exceptions.
- Real-time invoice calculations enforce epsilon-safe 2-decimal financial rounding.
- Subagent model tier standardized on `flash_lite` to avoid quota exhaustion.

## Active Team Roster (Milestone 4)
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|
| explorer_m4_1_r2 | teamwork_preview_explorer | M4 Invoice Real-Time Calculation & Grid Navigation | completed | fafaf66c-55da-4cfe-b302-6e2c365aec75 |
| spec_miner_m4_2_r2 | teamwork_preview_spec_miner | M4 Payments, Status Auto-Transitions & Atomic Hooks | completed | 1b9e9270-9208-4e72-b597-3c33eb700ca6 |
| explorer_m4_3_r2 | teamwork_preview_explorer | M4 Statements, Print/Export & System Integration | completed | 8e6d7853-c60d-442f-9c2d-8dd7a6c5ca6a |
| worker_m4_1 | teamwork_preview_worker | M4 Invoices, Payments & Statements Implementer | in-progress | 92ed16ad-076d-48b7-97a0-f46a26c461ca |

## Active Timers
- Heartbeat cron: 36d05cd7-07e7-4853-8044-3cce65da5cdc/task-223
- Safety timer: none

## Artifact Index
- c:\Users\ayami\Documents\antigravity\focused-hypatia\PROJECT.md — Master project architecture, feature inventory, milestones, and contracts
- c:\Users\ayami\Documents\antigravity\focused-hypatia\TEST_INFRA.md — Master 4-tier E2E testing architecture
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\orchestrator_2\progress.md — Liveness heartbeat and milestone tracking
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\orchestrator_2\GATE_STATUS.md — Gate verdicts per milestone
