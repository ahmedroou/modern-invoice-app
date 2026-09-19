# Dispatch: Worker M1-1 (Implementation of Milestone 1)

**Agent Identity**: teamwork_preview_worker_m1_1
**Working Directory**: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_worker_m1_1
**Role**: Foundation & Desktop Shell Implementation Specialist
**Milestone**: Milestone 1 (Foundation, Shell, Theming & Arabic RTL)

## Task Description
Implement the complete Foundation, Electron Desktop Shell, Theming, and Arabic RTL Bidirectional Layout according to the synthesized blueprints from Explorers M1-1, M1-2, and M1-3.

### Mandatory Inputs to Read:
1. `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\ORIGINAL_REQUEST.md` (MANDATORY)
2. `c:\Users\ayami\Documents\antigravity\focused-hypatia\PROJECT.md`
3. Explorer M1-1 Blueprint (Scaffolding & Tooling): `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m1_1\handoff.md`
4. Explorer M1-2 Blueprint (Electron IPC & Native Shell): `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m1_2\handoff.md`
5. Explorer M1-3 Blueprint (RTL, Theming, Local Fonts & Responsive Layout): `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m1_3\handoff.md`

### Write Ownership
You have exclusive write access to:
- `package.json`, `package-lock.json`
- `tsconfig.json`, `tsconfig.node.json`
- `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `vitest.config.ts`, `index.html`
- `electron/**` (`electron/main.ts`, `electron/preload.ts`, `electron/ipcHandlers.ts`)
- `src/**` (`src/assets/**`, `src/types/**`, `src/context/**`, `src/components/**`, `src/App.tsx`, `src/main.tsx`, `src/index.css`)
- `tests/unit/**`

### Implementation Checklist:
1. **Scaffolding & Tooling**:
   - Write `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `vitest.config.ts`, `index.html`.
   - Run `npm install` via terminal command.
2. **Local Offline Fonts & CSS**:
   - Provide local Cairo & Tajawal fonts in `src/assets/fonts/` (or generate/embed clean local offline font definitions) and `@font-face` declarations in `src/index.css` so the app has ZERO internet dependency for fonts.
3. **Type Definitions**:
   - `src/types/electron.d.ts` (matching PROJECT.md interface contract).
   - `src/types/domain.ts` (Customer, Invoice, Payment, ActivityLog interfaces).
4. **Electron Native IPC & Main Process**:
   - `electron/main.ts` with `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `frame: false`, `titleBarStyle: 'hidden'`, single instance lock.
   - `electron/preload.ts` using `contextBridge.exposeInMainWorld('electronAPI', ...)`.
   - `electron/ipcHandlers.ts` with window controls, PDF print dialog/spooler, and file export.
5. **Context Providers**:
   - `src/context/DirectionContext.tsx` with `dir="rtl"` / `dir="ltr"`, `localStorage` persistence, and Arabic/English dictionary.
   - `src/context/ThemeContext.tsx` with light/dark/system mode and `localStorage` persistence.
6. **Responsive Layout & Compact Card Components**:
   - `src/components/layout/TitleBar.tsx` (frameless titlebar, drag region, window controls, RTL support, browser fallback).
   - `src/components/layout/Sidebar.tsx` (collapsible, flips to right in RTL).
   - `src/components/layout/MobileNav.tsx` (mobile top bar & bottom tab bar).
   - `src/components/layout/AppLayout.tsx`.
   - `src/components/common/CompactCard.tsx` and `CompactMetricCard.tsx` (strictly adhering to mobile-first and compact card <90px height rules).
   - `src/App.tsx` and `src/main.tsx`.
7. **Verification & Tests**:
   - Write unit tests for TitleBar, DirectionContext, and ThemeContext.
   - Run `npm run build` and `npm test` to verify build succeeds and all tests pass.

### MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Output full details and command outputs in `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_worker_m1_1\handoff.md` and notify via `send_message`.

## 2026-09-19T04:36:34Z
You are teamwork_preview_worker_m1_1.
Your working directory is: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_worker_m1_1
Your detailed task assignment is in: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_worker_m1_1\DISPATCH.md
Implement Milestone 1 (Foundation, Electron Shell, Theming & Arabic RTL) completely and authentically:
1. Scaffold package.json, tsconfig.json, vite.config.ts, tailwind.config.js, postcss.config.js, vitest.config.ts, index.html.
2. Run npm install to install dependencies cleanly.
3. Provide local offline fonts in src/assets/fonts/ and @font-face rules in src/index.css (Cairo/Tajawal).
4. Implement src/types/electron.d.ts and src/types/domain.ts.
5. Implement electron/main.ts, electron/preload.ts, electron/ipcHandlers.ts.
6. Implement DirectionContext.tsx (RTL/LTR & Arabic dictionary) and ThemeContext.tsx (light/dark/system).
7. Implement TitleBar.tsx, Sidebar.tsx, MobileNav.tsx, AppLayout.tsx, CompactCard.tsx, CompactMetricCard.tsx, App.tsx, main.tsx.
8. Write unit tests in tests/unit/ for TitleBar, DirectionContext, and ThemeContext.
9. Run build and test commands (npm run build, npm test) and confirm 100% passing.

