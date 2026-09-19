# Dispatch: Worker M3 Fix 1 (Search Whitespace Remediation Implementation)

**Agent Identity**: teamwork_preview_worker_m3_fix_1
**Working Directory**: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_worker_m3_fix_1
**Role**: Search Whitespace Remediation Implementer
**Milestone**: Milestone 3 (Customer Directory & Financial Dashboard Modules) — Iteration 2

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Task Description
Apply the search whitespace normalization fix in `src/hooks/useCustomers.ts` and add verifying unit tests:
1. In `src/hooks/useCustomers.ts`:
   - In `filteredCustomers`, precompute `const queryCompact = normalizedQuery.replace(/\s+/g, '');` outside the array filter loop.
   - Update the customer match predicate:
     ```typescript
     const nameMatch = normalizedName.includes(normalizedQuery);
     const phoneMatch = Boolean(phone && queryCompact && phone.includes(queryCompact));
     const emailMatch = Boolean(email && email.includes(normalizedQuery));
     const taxMatch = Boolean(taxNumber && queryCompact && taxNumber.includes(queryCompact));

     return nameMatch || phoneMatch || emailMatch || taxMatch;
     ```
2. In `tests/unit/useCustomers.test.ts`:
   - Add unit tests verifying formatted phone searches (e.g. `'+966 50 123 4567'`, `'+966 50'`, `'50 123'`) and formatted tax ID searches (e.g. `'3001 2345 6700 003'`, `'3001 2345'`) match successfully.
3. Run verification commands:
   - `npm run build`
   - `npm test`
   - `npm run test:smoke`
   - Verify that all test suites pass including `tests/unit/customerLedger.stress.test.ts`.

Read:
- `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\ORIGINAL_REQUEST.md`
- `c:\Users\ayami\Documents\antigravity\focused-hypatia\PROJECT.md`
- `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m3_fix_1\handoff.md`
- `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_challenger_m3_1\handoff.md`

Document your changes and empirical test results in `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_worker_m3_fix_1\handoff.md` and report back via send_message.

## 2026-09-19T11:34:36Z
You are teamwork_preview_worker_m3_fix_1.
Your working directory is: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_worker_m3_fix_1
Your task assignment is in: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_worker_m3_fix_1\DISPATCH.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Read:
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\ORIGINAL_REQUEST.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\PROJECT.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m3_fix_1\handoff.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_challenger_m3_1\handoff.md

Apply the whitespace normalization fix in src/hooks/useCustomers.ts and add verifying tests in tests/unit/useCustomers.test.ts.
Run npm run build, npm test, and npm run test:smoke.
State your findings and test execution results in c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_worker_m3_fix_1\handoff.md and report back via send_message.

