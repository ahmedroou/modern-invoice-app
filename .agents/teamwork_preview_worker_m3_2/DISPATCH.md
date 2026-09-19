## 2026-09-19T11:33:20Z

You are teamwork_preview_worker_m3_2, resolving the review findings for Milestone 3 (Customer Directory & Financial Dashboard).

Your working directory is:
c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_worker_m3_2

Read and study:
- c:\Users\ayami\Documents\antigravity\focused-hypatia\ORIGINAL_REQUEST.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\PROJECT.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_reviewer_m3_3\handoff.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_reviewer_m3_4\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Remediation Tasks:
1. [Build Fix] Fix TypeScript compilation errors in test files that fail `npm run build` (`tsc && vite build`) under strict `noUnusedLocals` / `noUnusedParameters`:
   - `tests/unit/customerLedger.stress.test.ts:770:37`: remove unused parameter `idx` or rename to `_idx`.
   - `tests/unit/EmpiricalChallengerM3_2.test.tsx`: remove unused `React`, `screen`, `PaymentMethod`, and `currency` symbols.
2. [Referential Integrity] In `src/lib/atomicMutations.ts` within `deleteCustomerAtomic`:
   Update the guard check so that customers with credit balances (`outstandingAmount < 0`) or recorded payments (`totalPaid > 0`) cannot be deleted:
   `if (totalInvoiced > 0 || totalPaid > 0 || Math.abs(outstandingAmount) > 0.001)`
3. [Arabic Normalization] In `src/hooks/useCustomers.ts` within `normalizeSearchText`:
   Add `.replace(/\u0640/g, '')` to strip Arabic Tatweel / Kashida (`ـ`) so stylized company names match search queries reliably.
4. Run verification commands:
   - `npx tsc --noEmit`
   - `npm run build`
   - `npm test`
5. Deliver structured handoff report to `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_worker_m3_2\handoff.md` and report back via `send_message`.
