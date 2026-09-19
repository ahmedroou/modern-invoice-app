# Dispatch: Worker M1-2 (Remediation of Preload CJS & Electron Launch)

**Agent Identity**: teamwork_preview_worker_m1_2
**Working Directory**: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_worker_m1_2
**Role**: Preload CJS & Electron Desktop Shell Remediation Specialist
**Milestone**: Milestone 1 (Foundation, Shell, Theming & Arabic RTL) — Iteration 2

## Task Description
Apply the verified CommonJS preload bundling configuration, preload path resolution in `electron/main.ts`, and automated headless smoke test to resolve the sandboxed Electron preload syntax error and certify Acceptance Criterion AC1.

### Mandatory Inputs to Read:
1. `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\ORIGINAL_REQUEST.md` (MANDATORY)
2. `c:\Users\ayami\Documents\antigravity\focused-hypatia\PROJECT.md`
3. Explorer Fix-1 Blueprint (`vite.config.ts` Rollup CJS): `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m1_fix_1\handoff.md`
4. Explorer Fix-2 Blueprint (`electron/main.ts` Preload Path Resolution): `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m1_fix_2\handoff.md`
5. Explorer Fix-3 Blueprint (Automated Smoke Test): `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m1_fix_3\handoff.md`

### Write Ownership
You have exclusive write access to:
- `vite.config.ts`
- `electron/main.ts`
- `package.json`
- `tests/smoke/electron-launch.smoke.mjs`

### Implementation Steps:
1. **Update `vite.config.ts`**:
   Configure the preload build entry so that it does NOT use Vite library mode (omit outer `entry` or set `lib: false`), specifying `rollupOptions.input = 'electron/preload.ts'`, `output.format = 'cjs'`, `output.entryFileNames = '[name].cjs'`, and `output.inlineDynamicImports = true`.
2. **Update `electron/main.ts`**:
   Implement `resolvePreloadPath()` to find `preload.cjs` (with fallbacks) in `dist-electron/` and add the `preload-error` diagnostic handler.
3. **Add Automated Smoke Test**:
   Create `tests/smoke/electron-launch.smoke.mjs` and add `"test:smoke": "node tests/smoke/electron-launch.smoke.mjs"` to `package.json` scripts.
4. **Run Verification Commands**:
   - `npm run build` (confirm `preload.cjs` is generated and contains `require("electron")` without `import` statements).
   - `npm test` (confirm all Vitest unit tests pass).
   - `npm run test:smoke` (confirm headless Electron launches, loads `preload.cjs`, exposes `window.electronAPI` with all 10 methods, and exits with code 0).

### MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Document all findings and command outputs in `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_worker_m1_2\handoff.md` and report back via `send_message`.
