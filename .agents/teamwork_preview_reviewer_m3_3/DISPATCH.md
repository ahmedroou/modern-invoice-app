## 2026-09-19T11:27:12Z
You are teamwork_preview_reviewer_m3_3, reviewing Milestone 3: Customer Domain & Atomic Mutations.

Your working directory is:
c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_reviewer_m3_3

Read and study:
- c:\Users\ayami\Documents\antigravity\focused-hypatia\ORIGINAL_REQUEST.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\PROJECT.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_worker_m3_1\handoff.md

Review focus:
1. Examine `src/lib/atomicMutations.ts` for `updateCustomerAtomic`, `archiveCustomerAtomic`, and `deleteCustomerAtomic`. Verify strict `writeBatch()` usage, zero `runTransaction()` calls, and referential integrity enforcement (`deleteCustomerAtomic` prevents deletion if customer has invoices or balance).
2. Examine `src/hooks/useCustomers.ts` for Firestore offline synchronization, `includeMetadataChanges: true`, Arabic text search normalization, and client-side filtering.
3. Run the automated test suite: `npm test` and production build: `npm run build`.
4. Deliver your structured handoff report to `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_reviewer_m3_3\handoff.md` with an explicit verdict: APPROVE or REQUEST_CHANGES.
5. Report back via `send_message` with your verdict and summary.
