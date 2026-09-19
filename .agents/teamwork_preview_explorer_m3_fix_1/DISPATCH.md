# Dispatch: Explorer M3 Fix 1 (Customer Search Whitespace Normalization Remediation)

**Agent Identity**: teamwork_preview_explorer_m3_fix_1
**Working Directory**: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m3_fix_1
**Role**: Search & Filter Remediation Explorer
**Milestone**: Milestone 3 (Customer Directory & Financial Dashboard Modules) — Iteration 2

## Task Description
Investigate and formulate the fix strategy for the defect reported by Challenger M3-1:
1. Review Challenger M3-1's finding in `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_challenger_m3_1\handoff.md`:
   - In `src/hooks/useCustomers.ts:194-203`, `c.phone` and `c.taxNumber` strip whitespace with `.replace(/\s+/g, '')`, but `normalizedQuery` does not compact spaces.
   - When searching for formatted phone numbers (e.g. `+966 50 123 4567`) or formatted ZATCA tax numbers (e.g. `3001 2345 6700 003`), the match fails.
2. Inspect `src/hooks/useCustomers.ts` and `tests/unit/useCustomers.test.ts`.
3. Design the exact code change in `src/hooks/useCustomers.ts` so:
   - `queryCompact = normalizedQuery.replace(/\s+/g, '')`
   - Phone and tax number comparisons check `queryCompact` (or `normalizedQuery`): `(phone && queryCompact && phone.includes(queryCompact))` and `(taxNumber && queryCompact && taxNumber.includes(queryCompact))`.
4. Ensure all existing tests and stress tests (`tests/unit/customerLedger.stress.test.ts`) pass cleanly.

Read:
- `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\ORIGINAL_REQUEST.md`
- `c:\Users\ayami\Documents\antigravity\focused-hypatia\PROJECT.md`
- `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_challenger_m3_1\handoff.md`
- `c:\Users\ayami\Documents\antigravity\focused-hypatia\src\hooks\useCustomers.ts`

Document the exact remediation strategy in `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m3_fix_1\handoff.md` and report back via send_message.

## 2026-09-19T11:31:46Z
You are teamwork_preview_explorer_m3_fix_1.
Your working directory is: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m3_fix_1
Your task assignment is in: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m3_fix_1\DISPATCH.md
Read:
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\ORIGINAL_REQUEST.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\PROJECT.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_challenger_m3_1\handoff.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\src\hooks\useCustomers.ts

Investigate the defect identified by Challenger M3-1 regarding whitespace asymmetry in useCustomers.ts search logic.
Formulate the exact fix strategy and specify the code changes in c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m3_fix_1\handoff.md and report back via send_message.
