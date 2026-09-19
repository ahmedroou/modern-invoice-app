# Investigation & Handoff Report: Vite Electron Preload CommonJS Bundling

**Agent Identity**: `teamwork_preview_explorer_m1_fix_1`  
**Role**: Vite Electron Preload Bundling Specialist  
**Working Directory**: `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m1_fix_1`  
**Recipient**: `parent` (`36d05cd7-07e7-4853-8044-3cce65da5cdc`)  
**Target Milestone**: Milestone 1 (Foundation, Shell, Theming & Arabic RTL) — Iteration 2  
**Date**: 2026-09-19  

---

## Executive Summary

Reviewer M1-2 failed Gate 1 with `REQUEST_CHANGES` because `dist-electron/preload.js` was bundled as an ES module (`import { contextBridge, ipcRenderer } from "electron"`), which crashes in Electron's Chromium sandbox (`sandbox: true`) with `SyntaxError: Cannot use import statement outside a module`.

Our investigation uncovered a critical pitfall: **The fix proposed in Reviewer M1-2's handoff still fails** because specifying `entry: 'electron/preload.ts'` at the top-level of `vite-plugin-electron`'s options causes `resolveViteConfig` to enforce `build.lib.formats: ['es']` when `package.json` has `"type": "module"`. When combined with Rollup's `output.format: 'cjs'`, it generates an invalid hybrid file that retains `import { contextBridge, ipcRenderer } from "electron"`.

The **definitive, empirical solution** is to omit `entry` from the outer plugin object and configure the preload entry via `vite.build.rollupOptions.input = 'electron/preload.ts'`, with `output.format = 'cjs'`, `output.entryFileNames = '[name].cjs'`, and `output.inlineDynamicImports = true`. This generates pure CommonJS (`const electron = require("electron")`), which was verified in the real Electron 34 runtime with `FULL_END_TO_END_SUCCESS` and all 10 `window.electronAPI` methods operational.

---

## 1. Observation

### 1.1 Current Codebase Observations

1. **`package.json:6-7`**:
   ```json
   "type": "module",
   "main": "dist-electron/main.js",
   ```
   The project is configured as an ES module package.

2. **`vite.config.ts:23-37` (Current Implementation)**:
   ```typescript
   {
     entry: 'electron/preload.ts',
     onstart(args) {
       args.reload();
     },
     vite: {
       build: {
         outDir: 'dist-electron',
         minify: process.env.NODE_ENV === 'production',
         rollupOptions: {
           external: ['electron']
         }
       }
     }
   }
   ```

3. **`dist-electron/preload.js:1` (Current Build Output)**:
   ```javascript
   import { contextBridge as t, ipcRenderer as n } from "electron";
   ```
   The bundled file uses top-level ES module `import`.

4. **`electron/main.ts:32-35`**:
   ```typescript
   const preloadPath = fs.existsSync(path.join(__dirname, 'preload.mjs'))
     ? path.join(__dirname, 'preload.mjs')
     : path.join(__dirname, 'preload.js');
   ```
   `main.ts` does not check for `preload.cjs`.

5. **`electron/main.ts:45-50`**:
   ```typescript
   webPreferences: {
     preload: preloadPath,
     contextIsolation: true,
     nodeIntegration: false,
     sandbox: true,
     webSecurity: true,
     spellcheck: false,
     devTools: isDev || !app.isPackaged
   }
   ```
   The browser window enforces context isolation, disables Node.js integration, and enables the Chromium sandbox.

---

### 1.2 Internal Mechanism of `vite-plugin-electron` v0.28.8

Inspection of `node_modules/vite-plugin-electron/dist/index.mjs:6-24` reveals how default configuration is constructed:
```javascript
function resolveViteConfig(options) {
  const packageJson = resolvePackageJson() ?? {};
  const esmodule = packageJson.type === "module";
  const defaultConfig = {
    configFile: false,
    publicDir: false,
    build: {
      lib: options.entry && {
        entry: options.entry,
        formats: esmodule ? ["es"] : ["cjs"],
        fileName: () => "[name].js"
      },
      outDir: "dist-electron",
      emptyOutDir: false
    },
    ...
  };
  return mergeConfig(defaultConfig, options?.vite || {});
}
```

Key observations:
1. When `options.entry` is present, `defaultConfig.build.lib` is created with `formats: ["es"]` (since `packageJson.type === "module"`).
2. When `options.entry` is `undefined` (omitted from outer object), `options.entry && ...` is `undefined`, so `defaultConfig.build.lib` is NOT created.
3. In `node_modules/vite-plugin-electron/dist/simple.mjs:20-66`, the plugin authors document:
   ```javascript
   // rollupOptions.input has higher priority than build.lib.
   // Preload scripts may contain Web assets, so use the build.rollupOptions.input instead build.lib.entry.
   // In most cases, use `cjs` format
   // Note, however, that preload.ts should not be split.
   // inlineDynamicImports: true
   ```

---

### 1.3 Empirical Test Matrix Results

We constructed an automated test matrix executing actual Vite builds and running the output in the real Electron 34 desktop runtime:

| Option | Configuration Approach | Output File | Bundled Code Header | Electron Sandbox Execution Result |
|---|---|---|---|---|
| **Option A** (Reviewer M1-2 Suggestion) | Outer `entry: 'electron/preload.ts'`, with `rollupOptions.output: { format: 'cjs', entryFileNames: '[name].cjs' }` | `dist-electron/preload.cjs` | `import { contextBridge, ipcRenderer } from "electron";` | **FAILED (Exit 1)**: `PRELOAD ERROR: SyntaxError: Cannot use import statement outside a module` |
| **Option B** (Recommended: `rollupOptions.input`) | Outer `entry` omitted; `rollupOptions.input: 'electron/preload.ts'`, `output: { format: 'cjs', entryFileNames: '[name].cjs', inlineDynamicImports: true }` | `dist-electron/preload.cjs` | `"use strict"; const electron = require("electron");` | **PASSED (Exit 0)**: `window.electronAPI present: true` |
| **Option C** (`build.lib.formats: ['cjs']`) | Outer `entry` omitted; `build.lib: { entry: 'electron/preload.ts', formats: ['cjs'], fileName: () => '[name].cjs' }` | `dist-electron/preload.cjs` | `"use strict"; const electron = require("electron");` | **PASSED (Exit 0)**: `window.electronAPI present: true` |

Verbatim output from running Option A in Electron:
```
PRELOAD ERROR: SyntaxError: Cannot use import statement outside a module
    at runPreloadScript (node:electron/js2c/sandbox_bundle:2:151981)
    at node:electron/js2c/sandbox_bundle:2:152300
    at node:electron/js2c/sandbox_bundle:2:152455
    at ___electron_webpack_init__ (node:electron/js2c/sandbox_bundle:2:152459)
    at node:electron/js2c/sandbox_bundle:2:152582
```

Verbatim output from running Option B (Recommended) in Electron with built React HTML:
```
window.electronAPI present: true
window.electronAPI keys: [
  'minimizeWindow',
  'maximizeWindow',
  'closeWindow',
  'isMaximized',
  'printInvoicePDF',
  'exportFile',
  'getAppVersion',
  'getSystemTheme',
  'onThemeChanged',
  'onWindowStateChanged'
]
FULL_END_TO_END_SUCCESS
```

---

## 2. Logic Chain

1. **Failure of ESM in Preload**:
   - `BrowserWindow` in `electron/main.ts` is configured with `sandbox: true`.
   - In Chromium's sandbox bundle, preload scripts are evaluated via `runPreloadScript` in a classic script context.
   - Classic script evaluation throws `SyntaxError: Cannot use import statement outside a module` whenever `import ... from ...` is present.
   - Therefore, the preload bundle must NOT contain top-level `import` or `export` statements; it must use `require('electron')`.

2. **Why the Reviewer's Proposed Snippet Failed**:
   - Reviewer M1-2 suggested adding `rollupOptions.output: { format: 'cjs', entryFileNames: '[name].cjs' }` while keeping `entry: 'electron/preload.ts'` at the root of the options object.
   - When `entry` is at the root, `vite-plugin-electron` automatically initializes `build.lib = { entry: 'electron/preload.ts', formats: ['es'], fileName: () => '[name].js' }` because `package.json` has `"type": "module"`.
   - Vite's config merger merges this with the user's `rollupOptions`.
   - Because `build.lib` has `formats: ['es']`, Vite processes the code through esbuild in ES library mode first, leaving `import { contextBridge, ipcRenderer } from "electron"` at line 4 of the output, wrapped inside a CommonJS wrapper `export default require_preload()`.
   - When Electron executes this `.cjs` file, the top-level `import` triggers the exact same `SyntaxError`.

3. **Why Option B (Recommended) Works Flawlessly**:
   - By omitting `entry` from the outer plugin object, `options.entry && ...` evaluates to `undefined`, so `vite-plugin-electron` does NOT create `defaultConfig.build.lib`.
   - `build.rollupOptions.input = 'electron/preload.ts'` instructs Rollup directly to bundle the file.
   - `build.rollupOptions.output.format = 'cjs'` directs Rollup to compile external imports to CommonJS `require('electron')`.
   - `build.rollupOptions.output.entryFileNames = '[name].cjs'` outputs `preload.cjs`, which is universally treated as CommonJS by Node.js and Electron regardless of package `"type": "module"`.
   - `build.rollupOptions.output.inlineDynamicImports = true` ensures Rollup never splits the preload into asynchronous chunks, which is mandatory for Electron sandboxed preloads where Node.js dynamic imports are disabled.
   - When executed by Electron 34, `require('electron')` is fulfilled by the sandbox bundle, `contextBridge.exposeInMainWorld('electronAPI', ...)` succeeds, and `window.electronAPI` is fully populated.

4. **Integration with `electron/main.ts`**:
   - `main.ts` currently checks for `preload.mjs` then `preload.js`.
   - Updating `preloadPath` to check `preload.cjs` first guarantees that the compiled CommonJS preload script is loaded in both development and production packaged builds.

---

## 3. Recommended Code Changes

### 3.1 Changes to `vite.config.ts`

**Target File**: `c:\Users\ayami\Documents\antigravity\focused-hypatia\vite.config.ts`  
**Target Lines**: 23–37

#### Before:
```typescript
      {
        entry: 'electron/preload.ts',
        onstart(args) {
          args.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            minify: process.env.NODE_ENV === 'production',
            rollupOptions: {
              external: ['electron']
            }
          }
        }
      }
```

#### After:
```typescript
      {
        onstart(args) {
          args.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            minify: process.env.NODE_ENV === 'production',
            rollupOptions: {
              input: 'electron/preload.ts',
              external: ['electron'],
              output: {
                format: 'cjs',
                entryFileNames: '[name].cjs',
                inlineDynamicImports: true
              }
            }
          }
        }
      }
```

#### Complete `vite.config.ts` Replacement Content:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            minify: process.env.NODE_ENV === 'production',
            rollupOptions: {
              external: ['electron']
            }
          }
        }
      },
      {
        onstart(args) {
          args.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            minify: process.env.NODE_ENV === 'production',
            rollupOptions: {
              input: 'electron/preload.ts',
              external: ['electron'],
              output: {
                format: 'cjs',
                entryFileNames: '[name].cjs',
                inlineDynamicImports: true
              }
            }
          }
        }
      }
    ]),
    renderer()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  server: {
    port: 5173
  }
});
```

---

### 3.2 Changes to `electron/main.ts`

**Target File**: `c:\Users\ayami\Documents\antigravity\focused-hypatia\electron\main.ts`  
**Target Lines**: 32–35

#### Before:
```typescript
    const preloadPath = fs.existsSync(path.join(__dirname, 'preload.mjs'))
      ? path.join(__dirname, 'preload.mjs')
      : path.join(__dirname, 'preload.js');
```

#### After:
```typescript
    const preloadPath = fs.existsSync(path.join(__dirname, 'preload.cjs'))
      ? path.join(__dirname, 'preload.cjs')
      : fs.existsSync(path.join(__dirname, 'preload.mjs'))
      ? path.join(__dirname, 'preload.mjs')
      : path.join(__dirname, 'preload.js');
```

---

### 3.3 Minor Quality Recommendations from Reviewer M1-2

During our investigation, we also cross-checked the reviewer's two minor findings:
1. **`src/App.tsx:109`**:
   The currency display `{formatCurrency(inv.amount)}` in the Recent Invoices table should be wrapped in `<BidiIsolate>`:
   ```tsx
   <BidiIsolate>{formatCurrency(inv.amount)}</BidiIsolate>
   ```
   This prevents RTL numeral scrambling in Arabic mode.

2. **`vitest.config.ts`**:
   Currently, running `npm test` without path arguments scans all `**/*.spec.ts` in the workspace, causing Vitest to pick up Playwright test files in metadata directories (e.g., `.agents/teamwork_preview_explorer_m1_fix_3/smoke.spec.ts`).
   Adding an explicit `include` pattern in `vitest.config.ts` prevents this collision:
   ```typescript
   test: {
     include: ['tests/**/*.test.{ts,tsx}'],
     globals: true,
     ...
   }
   ```

---

## 4. Caveats

1. **`dist-electron` Cleaning**:
   Because `vite-plugin-electron` runs two builds into `dist-electron` with `emptyOutDir: false`, any previously built `dist-electron/preload.js` will remain in the directory unless manually removed or cleaned via a pre-build script. Updating `electron/main.ts` to check `preload.cjs` first guarantees that the CommonJS preload is selected even if stale `.js` files exist.
2. **Playwright E2E Tests**:
   E2E tests executing against the production build should launch the packaged app or run Electron with `dist-electron/main.js`. Since `main.js` is an ES module and `preload.cjs` is CommonJS, this matches standard modern Electron architecture.

---

## 5. Conclusion

The root cause of Gate 1 rejection has been fully diagnosed, empirically reproduced, and solved:
1. `vite-plugin-electron` automatically injects `build.lib.formats: ['es']` when `entry` is specified at the outer object level in a `"type": "module"` package.
2. The solution is to remove `entry` from the outer preload object and specify `rollupOptions.input: 'electron/preload.ts'` with `format: 'cjs'`, `entryFileNames: '[name].cjs'`, and `inlineDynamicImports: true`.
3. Updating `electron/main.ts` to prioritize `preload.cjs` completes the fix.
4. With these two targeted changes, `electron/main.ts` compiles cleanly to ES module `dist-electron/main.js`, `electron/preload.ts` compiles cleanly to CommonJS `dist-electron/preload.cjs`, and `window.electronAPI` is 100% operational in Electron's sandboxed Chromium renderer.

---

## 6. Verification Method

To independently verify the fix:

1. **Verify TypeScript Compilation**:
   ```powershell
   npx tsc --noEmit
   ```
   *Expected Output*: Exit code `0`, no type errors.

2. **Verify Full Production Build**:
   ```powershell
   npm run build
   ```
   *Expected Output*: Generates `dist-electron/main.js` and `dist-electron/preload.cjs`.

3. **Verify Preload Output File Contents**:
   ```powershell
   node -e "const content = require('fs').readFileSync('dist-electron/preload.cjs', 'utf-8'); if (content.includes('import ') || !content.includes('require(')) { console.error('FAILED: Not pure CJS'); process.exit(1); } else { console.log('PASSED: Pure CJS'); }"
   ```
   *Expected Output*: `PASSED: Pure CJS`.

4. **Verify Real Electron Sandboxed Runtime Execution**:
   Run the test script located at `.agents/teamwork_preview_explorer_m1_fix_1/verify-e2e.mjs`:
   ```powershell
   npx electron .agents/teamwork_preview_explorer_m1_fix_1/verify-e2e.mjs
   ```
   *Expected Output*:
   ```
   window.electronAPI present: true
   FULL_END_TO_END_SUCCESS
   ```
   Exit code `0`.

5. **Verify Unit Test Suite**:
   ```powershell
   npx vitest run tests/unit
   ```
   *Expected Output*: 6 test files passed, 49 tests passed, exit code `0`.
