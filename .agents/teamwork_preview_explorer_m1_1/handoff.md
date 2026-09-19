# Handoff Report — M1 Scaffolding, Tooling & Package Configuration Specification

**Agent**: `teamwork_preview_explorer_m1_1`  
**Role**: Scaffolding & Tooling Specialist  
**Working Directory**: `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m1_1`  
**Recipient**: `parent` (`36d05cd7-07e7-4853-8044-3cce65da5cdc`)  
**Target Milestone**: Milestone 1 (Foundation, Shell, Theming & RTL)  
**Date**: 2026-09-19  

---

## 1. Observation

### 1.1 Host Environment & Tooling Verification
Direct command executions in PowerShell 7 on Windows 11 confirmed:
- **Node.js**: `v22.15.0` (Active LTS supporting native ESM, top-level await, and `import.meta.dirname`).
- **npm**: `10.9.2` (located at `C:\Program Files\nodejs\npm.cmd`).
- **pnpm / yarn**: Not installed / not recognized in PATH (`The term 'pnpm' is not recognized...`).
- **Git**: `git version 2.49.0.windows.1` on branch `master`.
- **Firebase CLI**: `firebase-tools@15.8.0` globally installed and authenticated.
- **Java**: `java version "21.0.6" 2025-01-21 LTS` available for Firebase emulators.

### 1.2 Greenfield Repository State
- Direct inspection of `c:\Users\ayami\Documents\antigravity\focused-hypatia` via `list_dir` and `git ls-files` revealed 0 tracked files and no existing code:
  - Untracked: `.agents/` and `ORIGINAL_REQUEST.md`.
  - No `package.json`, `tsconfig.json`, `vite.config.ts`, `electron/`, or `src/` directory exists.

### 1.3 Package Ecosystem Compatibility Findings
Direct query and dry-run execution against the npm registry demonstrated:
- **`vite-plugin-electron` & `vite-plugin-electron-renderer`**:
  - `vite-plugin-electron@0.28.8` paired with `vite-plugin-electron-renderer@0.14.7` provides a rock-solid, production-proven integration for Vite 5.x (`vite@5.4.14+`).
  - Note: `vite-plugin-electron-renderer@1.0.0` introduced breaking changes requiring Vite >= 8. Sticking with `^0.14.7` avoids any upstream experimental bundler collisions.
- **Dry-run verification**:
  - An `npm install --dry-run` was executed against the exact dependency specification. Result: `added 754 packages` with exit code `0` and **0 peer dependency conflicts**.
- **Node 22 ESM Main Process**:
  - Command: `node --input-type=module -e "console.log(import.meta.dirname)"` exited with code `0`, outputting `C:\Users\ayami\Documents\antigravity\focused-hypatia`.
  - Native Node 22 `import.meta.dirname` replaces legacy CommonJS `__dirname` shims when `"type": "module"` is configured.

---

## 2. Logic Chain

1. **Greenfield Bootstrap**:
   - Because the repository has 0 code files, all core configuration (`package.json`, `tsconfig.json`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `index.html`) must be scaffolded before any React or Electron code can compile.
2. **Package Manager Selection**:
   - Because `npm 10.9.2` is installed and verified while `pnpm` and `yarn` are absent, all installations and worker commands must strictly use `npm`.
3. **Electron Security & Architecture**:
   - Because the app requires offline persistence and native file exports, a strict two-process architecture is required:
     - **Main Process** (`electron/main.ts`): Node 22 ESM, frameless window with custom controls, IPC handlers for PDF print and file dialogs.
     - **Preload Script** (`electron/preload.ts`): `contextBridge.exposeInMainWorld('electronAPI', ...)` with `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.
     - **Renderer Process** (`src/`): React 18 SPA with Vite HMR, Tailwind CSS with logical properties for zero-effort RTL flipping, and Firebase Web SDK v11.
4. **Offline Font Strategy**:
   - Because Arabic typography (Cairo and Tajawal) must render offline without internet access, local `.woff2` font files and `@font-face` definitions in `src/index.css` must be packaged locally rather than relying on Google Fonts CDN links.
5. **Mobile-First & Compact UI Directives**:
   - In accordance with user rules, Tailwind configuration must support responsive layouts (`sm:`, `md:`, `lg:`) and compact card components with low vertical footprints (<90px height) and strict width containment.

---

## 3. Caveats

1. **Vite 6 / 8 Plugin Ecosystem**:
   - While Vite 8 / Rolldown is in alpha/beta, Vite `^5.4.14` with `@vitejs/plugin-react@^4.3.4`, `vite-plugin-electron@^0.28.8`, and `vite-plugin-electron-renderer@^0.14.7` is the most stable and proven toolchain for Electron 34 desktop applications.
2. **Path Resolution in Windows**:
   - PowerShell scripts and Node path manipulations must use `path.join()` or `path.resolve()` with POSIX/Windows normalizing to prevent backslash escaping bugs.
3. **Frameless Windows on Windows 11**:
   - Window dragging on frameless titlebars requires CSS `-webkit-app-region: drag` on the title bar container and `-webkit-app-region: no-drag` on all interactive buttons, menus, and controls to prevent click events from being swallowed by the OS window manager.

---

## 4. Conclusion & Actionable Specifications

### 4.1 Exact `package.json` Specification

Create `package.json` in the project root:

```json
{
  "name": "modern-invoice-desktop",
  "version": "1.0.0",
  "description": "Modern Offline-First Desktop Invoice Application",
  "private": true,
  "type": "module",
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "package": "npm run build && electron-builder",
    "package:win": "npm run build && electron-builder --win"
  },
  "dependencies": {
    "clsx": "^2.1.1",
    "firebase": "^11.4.0",
    "lucide-react": "^0.475.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.2",
    "tailwind-merge": "^2.6.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.50.1",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.2.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/node": "^22.13.4",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "cross-env": "^7.0.3",
    "electron": "^34.2.0",
    "electron-builder": "^25.1.8",
    "fake-indexeddb": "^6.0.0",
    "jsdom": "^26.0.0",
    "postcss": "^8.5.2",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.3",
    "vite": "^5.4.14",
    "vite-plugin-electron": "^0.28.8",
    "vite-plugin-electron-renderer": "^0.14.6",
    "vitest": "^3.0.5"
  },
  "build": {
    "appId": "com.moderninvoice.app",
    "productName": "Modern Invoice App",
    "directories": {
      "output": "release"
    },
    "files": [
      "dist/**/*",
      "dist-electron/**/*"
    ],
    "win": {
      "target": [
        "nsis",
        "portable"
      ]
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true
    }
  }
}
```

---

### 4.2 Exact Configuration Files

#### 1. `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    /* Strict Type-Checking */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,

    /* Path Aliasing */
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },
    "types": ["node", "vite/client"]
  },
  "include": [
    "src",
    "electron",
    "tests",
    "vite.config.ts"
  ]
}
```

#### 2. `vite.config.ts`
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

#### 3. `tailwind.config.js`
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Cairo', 'Tajawal', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Cascadia Code', 'Courier New', 'monospace']
      },
      colors: {
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16'
        }
      },
      boxShadow: {
        'xs': '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
      }
    }
  },
  plugins: []
};
```

#### 4. `postcss.config.js`
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};
```

#### 5. `index.html`
```html
<!DOCTYPE html>
<html lang="en" dir="ltr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com http://127.0.0.1:* ws://127.0.0.1:*; img-src 'self' data: https:;" />
    <title>Modern Invoice App</title>
  </head>
  <body class="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased overflow-hidden select-none">
    <div id="root" class="h-screen w-screen flex flex-col"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

#### 6. `vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    alias: {
      '@': path.resolve(__dirname, './src')
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html']
    }
  }
});
```

---

### 4.3 Precise Installation Commands

Run in the project root directory (`c:\Users\ayami\Documents\antigravity\focused-hypatia`):

```powershell
# 1. Install all dependencies using npm
npm install

# 2. Verify all packages resolved without audit vulnerabilities
npm audit
```

*(No pnpm or yarn commands are permitted or needed).*

---

### 4.4 Exact Implementation Steps for the Worker (M1 Execution Blueprint)

The Worker executing Milestone 1 must follow these exact, ordered phases:

#### Phase 1: File Scaffolding & Configuration Bootstrap
1. Write `package.json` with the exact dependencies and scripts specified in §4.1.
2. Write `tsconfig.json`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, and `vitest.config.ts` using the exact configurations in §4.2.
3. Write `index.html` at the project root with the custom Content Security Policy.
4. Run `npm install` to install all dependencies.

#### Phase 2: Electron IPC & Process Infrastructure
1. Create `src/types/electron.d.ts` defining `IElectronAPI`, `PrintInvoiceOptions`, and `ExportDataOptions`.
2. Create `electron/ipcHandlers.ts`:
   - Implement `window:minimize`, `window:maximize`, `window:close`, `window:isMaximized`.
   - Implement `invoice:print-pdf` (calling `webContents.printToPDF` and `dialog.showSaveDialog`).
   - Implement `file:export` (saving JSON/CSV via `fs/promises`).
   - Implement `nativeTheme.on('updated')` sending `'theme:changed'` events to renderer.
3. Create `electron/preload.ts`:
   - Expose `window.electronAPI` safely using `contextBridge.exposeInMainWorld`.
4. Create `electron/main.ts`:
   - Create frameless `BrowserWindow` (`frame: false`, `minWidth: 768`, `minHeight: 600`).
   - Register IPC handlers via `registerIPCHandlers(mainWindow)`.
   - Load dev URL if `process.env.VITE_DEV_SERVER_URL` is set, else `dist/index.html`.

#### Phase 3: Offline Fonts & Global CSS
1. Download / place Cairo `.woff2` font files in `src/assets/fonts/` (or generate lightweight embedded base64/SVG fallback).
2. Create `src/index.css`:
   - Include `@tailwind base;`, `@tailwind components;`, `@tailwind utilities;`.
   - Register `@font-face` rules for `Cairo` (Regular 400, SemiBold 600, Bold 700).
   - Configure title bar drag rules (`.titlebar-drag-region { -webkit-app-region: drag; }` and `.no-drag { -webkit-app-region: no-drag; }`).

#### Phase 4: Context Providers (Theming & RTL Mirroring)
1. Create `src/context/DirectionContext.tsx`:
   - State: `language` (`'en' | 'ar'`), `direction` (`'ltr' | 'rtl'`).
   - Effect: Update `document.documentElement.dir = direction` and `lang = language`.
   - Persist preference to `localStorage`.
2. Create `src/context/ThemeContext.tsx`:
   - State: `theme` (`'light' | 'dark' | 'system'`), `resolvedTheme`.
   - Effect: Toggle class `'dark'` on `document.documentElement`.
   - Synchronize with Electron `window.electronAPI.onThemeChanged` if available.

#### Phase 5: Responsive Shell & Compact Components
1. Create `src/components/layout/TitleBar.tsx`:
   - Frameless custom title bar with app title, window drag region, and minimize/maximize/close buttons.
   - Embed language switcher (EN / AR) and Dark/Light mode toggle.
2. Create `src/components/layout/Sidebar.tsx`:
   - Responsive navigation menu (Dashboard, Customers, Invoices, Payments, Statements).
   - Fully mirrors when `dir="rtl"` (sidebar moves to right, start/end margins flip).
3. Create `src/components/layout/MobileNav.tsx`:
   - Bottom navigation drawer for viewport widths < 640px.
4. Create `src/components/layout/AppLayout.tsx`:
   - Flex container combining TitleBar, Sidebar (desktop), MobileNav (mobile), and main view container.
5. Create `src/components/common/CompactCard.tsx`:
   - Compact card satisfying user global rules: low vertical footprint (<90px), responsive width, high contrast, clean truncation.

#### Phase 6: Application Entry Points & Smoke Test Suite
1. Create `src/App.tsx`:
   - Wrap with `DirectionProvider`, `ThemeProvider`, and `HashRouter`.
   - Render `AppLayout` with placeholder dashboard metrics using `CompactCard`.
2. Create `src/main.tsx`:
   - Mount React 18 `createRoot(document.getElementById('root')!).render(<App />)`.
3. Create `src/test/setup.ts`:
   - Configure `@testing-library/jest-dom`, mock `window.matchMedia`, mock `fake-indexeddb`, and mock `window.electronAPI`.
4. Create `tests/unit/shell.test.tsx`:
   - Test RTL language toggling: verify `document.documentElement.dir` changes between `ltr` and `rtl`.
   - Test Theme toggling: verify `dark` class toggle.
   - Test `CompactCard` rendering.

#### Phase 7: Verification & Build
1. Execute `npm run build` (`tsc && vite build`). Verify both `dist/` and `dist-electron/` are generated.
2. Execute `npm test` (`vitest run`). Verify 100% test pass.

---

## 5. Verification Method

To independently verify the scaffolding, configurations, and build readiness:

1. **Verify Configuration & Dependency Installation**:
   ```powershell
   # In workspace root:
   npm install
   ```
   *Expected outcome*: `added 754 packages in ...s`, exit code `0`, no peer dependency conflicts.

2. **Verify TypeScript & Vite Build Pipeline**:
   ```powershell
   npm run build
   ```
   *Expected outcome*:
   - `tsc` exits with `0` (no type errors in `src/` or `electron/`).
   - `vite build` builds the React frontend to `dist/` and the Electron main/preload to `dist-electron/`.

3. **Verify Automated Unit / Shell Tests**:
   ```powershell
   npm test
   ```
   *Expected outcome*: Vitest launches with `jsdom`, executes unit and component tests, and reports 100% passing tests.

4. **Invalidation Conditions**:
   - Upgrading `vite-plugin-electron-renderer` to `1.x` without upgrading Vite to 8+ will break the build.
   - Omitting `-webkit-app-region: no-drag` on titlebar buttons will disable window control clicks on Windows.
   - Using `createBrowserRouter` instead of `createHashRouter` in Electron will cause blank pages on reload in production packaged builds.
