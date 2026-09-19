## 2026-09-19T11:25:19Z
You are teamwork_preview_auditor_m3_2.
Your working directory is: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_auditor_m3_2
Your task assignment is in: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_auditor_m3_1\DISPATCH.md
Read:
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\ORIGINAL_REQUEST.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\PROJECT.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_worker_m3_1\handoff.md

Perform forensic integrity verification on all code, tests, and artifacts produced in Milestone 3:
1. Static Integrity Analysis:
   - Check src/lib/atomicMutations.ts: Confirm genuine writeBatch() calls for updateCustomerAtomic, archiveCustomerAtomic, and deleteCustomerAtomic. Confirm customer balance protection and referential deletion checks.
   - Check src/hooks/useCustomers.ts: Confirm genuine onSnapshot listener and client-side normalization logic. Verify zero hardcoded search result lookup tables.
   - Check src/hooks/useCustomerLedger.ts: Confirm genuine chronological sorting and running balance formulas using roundFinancial. Verify zero hardcoded ledger tables.
   - Check src/hooks/useDashboardMetrics.ts: Confirm genuine metric aggregation formulas. Verify zero hardcoded KPI values.
   - Check tests in tests/unit/: Verify genuine assertions, zero it.skip, and zero tautologies.
2. Runtime Verification:
   - Independently execute npm run build, npm test, and npm run test:smoke. Confirm actual exit codes and stdout.
3. Binary Verdict:
   - Issue binary verdict: CLEAN or INTEGRITY VIOLATION.
   - Any violation triggers an immediate, non-negotiable failure.
Document all findings and forensic evidence in c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_auditor_m3_2\handoff.md and report back via send_message.
