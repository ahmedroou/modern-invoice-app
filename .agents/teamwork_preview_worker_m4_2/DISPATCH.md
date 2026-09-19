## 2026-09-19T12:37:33Z

You are teamwork_preview_worker_m4_2, the Implementation Worker for Milestone 4 (Invoices, Payments, Statements).
Your working directory is: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_worker_m4_2

MANDATORY FIRST STEP: Read the authoritative user request at:
c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\ORIGINAL_REQUEST.md
Also read:
- c:\Users\ayami\Documents\antigravity\focused-hypatia\PROJECT.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\TEST_INFRA.md
- Explorer 2 Handoff & Patch:
  - c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m4_2\handoff.md
  - c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m4_2\proposed_InvoiceForm.patch
- Explorer 1 Handoff: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m4_1\handoff.md
- Explorer 3 Handoff: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m4_3\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

File Write Ownership:
You own exclusively:
- `src/components/modules/invoices/InvoiceForm.tsx`
- `src/lib/atomicMutations.ts` / `src/services/atomicMutations.ts`
- `src/App.tsx` (if route adjustments needed)
- `tests/unit/invoices.test.tsx`, `tests/integration/InvoiceForm.spec.tsx`, and any necessary M4 test suites

Tasks to complete:
1. Apply the critical fix to `src/components/modules/invoices/InvoiceForm.tsx` as detailed in `proposed_InvoiceForm.patch` (use `prevOpenRef` and `prevInvoiceIdRef` to guard `useEffect` so `customers` reference changes do not trigger infinite re-renders or wipe user inputs).
2. Check `src/lib/atomicMutations.ts` and `src/services/atomicMutations.ts`: ensure `updateInvoiceAtomic` and `cancelInvoiceAtomic` are implemented genuinely with pure `writeBatch(firestore)` (zero `runTransaction`), properly adjusting customer `outstandingAmount` and `totalInvoiced` by deltas, and logging activity entries.
3. Verify that `App.tsx` routes for `/invoices`, `/payments`, and `/statements` render the proper views and support query parameters (`?new=1`, `?customerId=`, etc.).
4. Run all verification commands:
   - `npx vitest run tests/integration/InvoiceForm.spec.tsx`
   - `npx vitest run tests/unit/invoices.test.tsx`
   - `npm test` (full suite — all tests must pass with 0 failures)
   - `npm run build` (must pass with 0 type errors)
   - `npm run test:smoke` (headless Electron IPC smoke test must exit with 0)
5. Document all commands, test results, and file changes in your handoff report at:
   `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_worker_m4_2\handoff.md`
   and notify me with a message when complete.

## 2026-09-19T12:38:03Z
From: parent (aa8c023f-c34b-42c5-842e-1e90f1137645)
**Context**: Milestone 4 Implementation & Build Health
**Content**: Explorer 1 has additionally confirmed:
1. `npm run build` had TS6133 strict unused imports in `InvoiceForm.spec.tsx` (unused `React`) and `invoices.test.tsx` (unused `Invoice`). Please ensure all unused imports are removed so `npm run build` compiles completely cleanly.
2. In `atomicMutations.ts`, ensure DRAFT invoices do not increment customer outstanding balances (only non-draft invoices or status transitions from DRAFT to UNPAID increment customer debt).
3. If needed, create `tests/unit/payments.test.tsx` to round out unit coverage.
**Action**: Please incorporate these items into your fixes and report back with passing build/test results.

