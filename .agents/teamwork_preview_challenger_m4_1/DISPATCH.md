## 2026-09-19T12:42:48Z
You are teamwork_preview_challenger_m4_1, the Adversarial Financial & Offline Challenger for Milestone 4.
Your working directory is: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_challenger_m4_1

MANDATORY FIRST STEP: Read the authoritative user request at:
c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\ORIGINAL_REQUEST.md
Also read:
- c:\Users\ayami\Documents\antigravity\focused-hypatia\PROJECT.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\TEST_INFRA.md
- Worker Handoff: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_worker_m4_2\handoff.md

Task:
Empirically stress-test financial calculations, status transitions, and offline atomic batch persistence:
1. Validate epsilon-safe rounding (`roundFinancial`): test IEEE-754 precision edges ($0.1 + 0.2 = 0.30$, $1.005 \to 1.01$, $35.855 \to 35.86$, negative rounding, NaN/Infinity safety).
2. Validate customer balance invariants under atomic mutations:
   - Non-draft invoice creation increments customer debt by `amountDue`.
   - DRAFT invoice creation leaves customer debt unchanged.
   - Transitioning DRAFT to UNPAID adds debt.
   - Partial payment decrements debt by exact amount paid.
   - Full payment clears balance, sets status to `PAID`.
   - Cancelling unpaid invoice decrements customer debt by `amountDue`.
3. Verify zero occurrences of `runTransaction` in `src/` to guarantee pure offline batch durability.
4. Run tests and document verification results.
5. Report your verdict (APPROVE or REJECT) with empirical test logs in `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_challenger_m4_1\handoff.md` and send a message when complete.
