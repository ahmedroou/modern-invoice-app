# Dispatch: Explorer M1 Fix-1 (Vite Preload CJS Bundling Specialist)

**Agent Identity**: teamwork_preview_explorer_m1_fix_1
**Working Directory**: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m1_fix_1
**Role**: Vite Electron Preload Bundling Specialist
**Milestone**: Milestone 1 (Foundation, Shell, Theming & Arabic RTL) — Iteration 2

## Task Description
Reviewer M1-2 failed Gate 1 with REQUEST_CHANGES due to a runtime bug:
`dist-electron/preload.js` was bundled as an ES module (`import ... from "electron"`), which crashes in Electron's Chromium sandbox (`sandbox: true`) with `SyntaxError: Cannot use import statement outside a module`. As a result, `window.electronAPI` is undefined in the Electron renderer, caption buttons in TitleBar are hidden, and native desktop features fail.

Investigate the exact `vite.config.ts` rollup output configuration so that `electron/preload.ts` compiles to CommonJS (`preload.cjs` or `format: 'cjs'`) while `electron/main.ts` compiles cleanly and loads the CJS preload script.

Read:
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\ORIGINAL_REQUEST.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\PROJECT.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_reviewer_m1_2\handoff.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\vite.config.ts
- c:\Users\ayami\Documents\antigravity\focused-hypatia\electron\main.ts

Recommend the exact fix strategy in `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m1_fix_1\handoff.md` and report back via send_message.
