# Architectural & Testing Infrastructure Survey Report

## Executive Summary
This report provides a comprehensive technical blueprint for the modern, offline-first Desktop Invoice Application built with **Electron**, **React**, **TypeScript**, **Tailwind CSS**, and **Firebase Firestore**. It addresses process separation, secure IPC communication, modern Firestore v10+ offline persistence with IndexedDB in Chromium, Arabic RTL direction mirroring with local font packaging, compact responsive card design, and a multi-tiered test harness combining **Vitest** for fast unit/integration testing and **Playwright** for Electron end-to-end (E2E) verification.

---

## 1. Observation

### 1.1 Host Environment & Tooling
Direct inspection of the Windows host environment reveals:
- **Node.js**: `v22.15.0` (Modern Node 22 LTS, supporting native ESM, modern crypto, and Web Streams).
- **Package Manager**: `npm 10.9.2` and `npx` available directly in system PATH (`C:\Program Files\nodejs\`).
- **Version Control**: `git version 2.49.0.windows.1` on branch `master`.
- **Global Tools**: `firebase-tools@15.8.0` is already installed globally (`C:\Users\ayami\AppData\Roaming\npm`), enabling immediate access to the Firebase CLI and the Firebase Local Emulator Suite (`npx firebase emulators:start --only firestore`).
- **Workspace State**: `c:\Users\ayami\Documents\antigravity\focused-hypatia` is a clean repository containing only `ORIGINAL_REQUEST.md` and `.agents/` metadata. No application source code or build configuration has been generated yet.

### 1.2 Core Requirements from ORIGINAL_REQUEST.md
- **R1 (Desktop UI & UX Shell)**: Electron + React + TypeScript, SaaS-like UI, Light/Dark theme switching, smooth animations, and full RTL support for Arabic.
- **R2 (Financial Management Features)**: Dashboard (metrics & activity log), Accounts/Customers, Invoices (automatic real-time calculation, keyboard navigation), Payments (partial & full), Statements.
- **R3 (Offline-First Cloud Sync)**: Firebase Firestore offline persistence, immediate local save, background cloud sync when online.
- **Acceptance Criteria**:
  1. Electron app launches successfully.
  2. Switching to Arabic correctly mirrors the UI to RTL (layout mirroring, not just translated text).
  3. Invoice creation updates "Grand Total" automatically in real-time without a calculate button.
  4. Creating an invoice updates customer "Outstanding Amount" instantly.
  5. Recording a full payment changes invoice status to "Paid" and logs in Activity Log.
  6. Data can be written and read when network connection is disabled (Firebase offline persistence).
- **User Global Directives**:
  - Prioritize mobile-first responsive design.
  - Compact card designs by default: occupy less vertical space, efficient width, strict containment within boundaries.
  - Performance optimization: minimal load times, smooth interactions.

---

## 2. Logic Chain

### 2.1 Electron + React + TypeScript Architecture

#### 2.1.1 Process Boundaries & Security Model
Electron applications must strictly enforce separation of concerns to maintain desktop security:

1. **Main Process (`electron/main.ts`)**:
   - **Runtime**: Node.js runtime.
   - **Responsibilities**: Manages the application lifecycle (`app.whenReady()`, `app.on('window-all-closed')`), creates and configures the native `BrowserWindow`, sets up application menus, handles native window controls (minimize, maximize, close for custom title bars), coordinates native PDF generation / printing for invoices, and handles file dialogs for invoice exports (PDF/CSV).
   - **Security Flags**:
     ```ts
     const mainWindow = new BrowserWindow({
       width: 1280,
       height: 800,
       minWidth: 768,
       minHeight: 600,
       frame: false, // Custom sleek SaaS frameless titlebar
       titleBarStyle: 'hidden',
       titleBarOverlay: {
         color: '#0f172a',
         symbolColor: '#94a3b8',
         height: 36
       },
       webPreferences: {
         preload: path.join(__dirname, 'preload.js'),
         contextIsolation: true,  // Enforce separate JavaScript contexts
         nodeIntegration: false,   // Prevent renderer from accessing Node.js runtime
         sandbox: true,           // Enforce Chromium sandbox
         webSecurity: true
       }
     });
     ```

2. **Preload Script (`electron/preload.ts`)**:
   - **Runtime**: Runs in a privileged bridge context with access to a restricted subset of Electron APIs and DOM.
   - **Mechanism**: Employs `contextBridge.exposeInMainWorld` to publish a strictly typed, immutable API contract on `window.electronAPI`.
   - **Security Rule**: Never expose raw `ipcRenderer.send` or `ipcRenderer.on` directly to `window`. Every exposed function must map to a specific whitelisted channel with typed arguments and validated returns.

3. **Renderer Process (`src/`)**:
   - **Runtime**: Standard Chromium web engine.
   - **Responsibilities**: Runs the React 18/19 SPA, TypeScript components, Tailwind CSS styling, client-side routing, and the Firebase Web SDK.
   - **Routing Strategy**: Use `createHashRouter` or `createMemoryRouter` from `react-router-dom` rather than `createBrowserRouter`. In packaged Electron apps loaded via `file://` protocol (`file:///.../dist/index.html`), standard browser history path routing triggers file lookup errors on page refresh, whereas hash routing (`/#/invoices`) works reliably.

#### 2.1.2 Build System: Vite (`vite-plugin-electron`) vs Webpack
- **Evaluation**:
  - *Webpack* (e.g. Electron Forge default or CRA): High configuration overhead, slow cold start (5-15s), heavy configuration files (`webpack.main.config.js`, `webpack.renderer.config.js`), and sluggish HMR.
  - *Vite + `vite-plugin-electron`*: Instant cold starts (<300ms), native ESM development, sub-second HMR for React components, and unified build scripts using esbuild and Rollup.
- **Recommended Setup**: `vite` with `vite-plugin-electron` and `vite-plugin-electron-renderer`:
  ```ts
  // vite.config.ts
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
    }
  });
  ```

#### 2.1.3 Secure Typed IPC Communication Channels
Define a dedicated type contract shared between `electron/` and `src/`:
```ts
// src/types/electron.d.ts
export interface PrintInvoiceOptions {
  invoiceId: string;
  invoiceNumber: string;
  htmlContent?: string;
}

export interface ExportDataOptions {
  format: 'json' | 'csv';
  data: string;
  suggestedFilename: string;
}

export interface IElectronAPI {
  // Window controls
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  isMaximized: () => Promise<boolean>;

  // Native features
  printInvoicePDF: (options: PrintInvoiceOptions) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  exportFile: (options: ExportDataOptions) => Promise<{ success: boolean; filePath?: string }>;
  getAppVersion: () => Promise<string>;
  getSystemTheme: () => Promise<'light' | 'dark'>;
  onThemeChanged: (callback: (theme: 'light' | 'dark') => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
```

Preload implementation:
```ts
// electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron';
import type { IElectronAPI, PrintInvoiceOptions, ExportDataOptions } from '../src/types/electron';

const electronAPI: IElectronAPI = {
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  printInvoicePDF: (options: PrintInvoiceOptions) => ipcRenderer.invoke('invoice:print-pdf', options),
  exportFile: (options: ExportDataOptions) => ipcRenderer.invoke('file:export', options),
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  getSystemTheme: () => ipcRenderer.invoke('app:theme'),
  onThemeChanged: (callback) => {
    const handler = (_: any, theme: 'light' | 'dark') => callback(theme);
    ipcRenderer.on('theme:changed', handler);
    return () => {
      ipcRenderer.removeListener('theme:changed', handler);
    };
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
```

Main process IPC handler registration:
```ts
// electron/ipcHandlers.ts
import { ipcMain, BrowserWindow, dialog } from 'electron';
import fs from 'fs/promises';
import path from 'path';

export function registerIPCHandlers(mainWindow: BrowserWindow) {
  ipcMain.handle('window:minimize', () => mainWindow.minimize());
  ipcMain.handle('window:maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.handle('window:close', () => mainWindow.close());
  ipcMain.handle('window:isMaximized', () => mainWindow.isMaximized());

  ipcMain.handle('invoice:print-pdf', async (_, { invoiceNumber }) => {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Invoice PDF',
      defaultPath: `Invoice-${invoiceNumber}.pdf`,
      filters: [{ name: 'PDF Documents', extensions: ['pdf'] }]
    });
    if (!filePath) return { success: false, error: 'Cancelled' };

    const data = await mainWindow.webContents.printToPDF({
      printBackground: true,
      margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 }
    });
    await fs.writeFile(filePath, data);
    return { success: true, filePath };
  });

  ipcMain.handle('file:export', async (_, { format, data, suggestedFilename }) => {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Data',
      defaultPath: suggestedFilename,
      filters: [{ name: format.toUpperCase(), extensions: [format] }]
    });
    if (!filePath) return { success: false };
    await fs.writeFile(filePath, data, 'utf-8');
    return { success: true, filePath };
  });
}
```

---

### 2.2 Firebase Firestore Offline Persistence

#### 2.2.1 Web SDK v10+ Architecture in Chromium Renderer
Electron's renderer process is a standard Chromium environment providing full HTML5 Web APIs:
- **IndexedDB**: Fully persistent, local disk-backed key-value database located in the Electron user profile directory (`%APPDATA%/<app-name>/IndexedDB` on Windows).
- **Web Workers & BroadcastChannel**: Fully supported, allowing synchronization across multiple windows or tabs.

In modern Firebase JS SDK (v9/v10+ modular API), the legacy `enableIndexedDbPersistence()` call has been replaced by `initializeFirestore()` with `persistentLocalCache` and `persistentMultipleTabManager`:
```ts
// src/lib/firebase.ts
import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  CACHE_SIZE_UNLIMITED,
  Firestore
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-invoice-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'invoice-app.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-invoice-app',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'demo-invoice-app.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1234567890:web:abcdef123456'
};

export const app = initializeApp(firebaseConfig);

export const db: Firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
    cacheSizeBytes: CACHE_SIZE_UNLIMITED
  })
});
```

#### 2.2.2 Why `persistentMultipleTabManager()` is Critical for Electron
1. **Window Reloads & DevTools**: When Electron hot-reloads during development or when the renderer reloads, the previous tab session may not instantly release its IndexedDB lock. `persistentSingleTabManager()` would throw an uncaught error: `FirebaseError: [code=failed-precondition]: Persistence can only be enabled in one tab at a time.`
2. **Multi-Window Architectures**: If the application opens a secondary preview/print window, `persistentMultipleTabManager` uses `BroadcastChannel` to elect a master tab and share IndexedDB synchronization seamlessly without errors.

#### 2.2.3 Offline Operation Dynamics & Mutation Queue
1. **Immediate Local Writes**:
   - Calling `addDoc()`, `setDoc()`, `updateDoc()`, or `deleteDoc()` writes immediately to the local IndexedDB mutation queue.
   - The write promise resolves immediately in local cache mode, enabling instantaneous UI updates.
2. **Real-Time Subscription Behavior**:
   - `onSnapshot()` listeners trigger immediately with data from IndexedDB.
   - Document metadata reveals synchronization state:
     - `snapshot.metadata.hasPendingWrites`: `true` if local modifications have not yet been acknowledged by the Firestore cloud backend.
     - `snapshot.metadata.fromCache`: `true` if data was read from the local IndexedDB cache rather than directly from the server.
3. **Critical Offline Constraint — Batched Writes vs Transactions**:
   - **Rule**: Firestore `runTransaction()` requires active network communication to ensure remote read-write isolation. If attempted while offline, it fails or stalls until reconnected.
   - **Solution**: Multi-document atomic operations (such as creating an invoice AND immediately incrementing the customer's `outstandingBalance`, plus logging an activity record) **MUST use `writeBatch()`**.
   - `writeBatch()` operations are saved atomically into IndexedDB offline, optimistic calculations apply to local queries immediately, and the batch is dispatched atomically to the server once online.

#### 2.2.4 Programmatic Offline Test Harness & Network Control
To verify acceptance criterion #6 ("Data can be written and read when the network connection is disabled"):
1. **Firestore Network Control Functions**:
   ```ts
   import { disableNetwork, enableNetwork } from 'firebase/firestore';

   // Force offline state without disconnecting the host OS internet
   export async function simulateOffline(db: Firestore): Promise<void> {
     await disableNetwork(db);
   }

   // Restore online cloud synchronization
   export async function simulateOnline(db: Firestore): Promise<void> {
     await enableNetwork(db);
   }
   ```
2. **Reactive Connection State Hook**:
   ```ts
   // src/hooks/useSyncStatus.ts
   import { useState, useEffect } from 'react';
   import { onSnapshot, doc } from 'firebase/firestore';
   import { db } from '@/lib/firebase';

   export function useSyncStatus() {
     const [isOnline, setIsOnline] = useState(navigator.onLine);
     const [pendingSyncCount, setPendingSyncCount] = useState(0);

     useEffect(() => {
       const handleOnline = () => setIsOnline(true);
       const handleOffline = () => setIsOnline(false);

       window.addEventListener('online', handleOnline);
       window.addEventListener('offline', handleOffline);

       return () => {
         window.removeEventListener('online', handleOnline);
         window.removeEventListener('offline', handleOffline);
       };
     }, []);

     return { isOnline, pendingSyncCount };
   }
   ```
3. **Local Firebase Emulator Support**:
   During tests or completely disconnected environments, the app connects to the Firestore emulator:
   ```ts
   import { connectFirestoreEmulator } from 'firebase/firestore';
   if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
     connectFirestoreEmulator(db, '127.0.0.1', 8080);
   }
   ```

---

### 2.3 UI Stack, Design System & Arabic RTL

#### 2.3.1 Tailwind CSS & CSS Logical Properties for Automatic RTL
- **Architecture**:
  - Use Tailwind CSS with native CSS Logical Properties (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `rounded-s-`, `rounded-e-`, `text-start`, `text-end`).
  - By avoiding physical directional classes (`ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left`, `text-right`), switching `document.documentElement.dir = 'rtl'` automatically and perfectly mirrors every layout, flexbox order, padding, margin, and positioning across the entire application without writing duplicate CSS or maintaining parallel component trees.
- **Tailwind Configuration**:
  ```js
  // tailwind.config.js
  /** @type {import('tailwindcss').Config} */
  export default {
    darkMode: 'class',
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
      extend: {
        fontFamily: {
          sans: ['Cairo', 'Tajawal', 'system-ui', '-apple-system', 'sans-serif'],
          mono: ['JetBrains Mono', 'Courier New', 'monospace']
        },
        colors: {
          brand: {
            50: '#f0fdf4',
            100: '#dcfce7',
            500: '#22c55e',
            600: '#16a34a',
            700: '#15803d'
          }
        }
      }
    },
    plugins: []
  };
  ```

#### 2.3.2 Local Arabic Font Packaging (Zero Network Dependency)
To ensure the application operates 100% offline from the moment of installation, fonts must not be loaded from Google Fonts CDN over the internet.
- **Font Assets**: Package **Cairo** (primary) and **Tajawal** (secondary) directly inside `src/assets/fonts/` as `.woff2` files.
- **Global CSS (@font-face)**:
  ```css
  /* src/index.css */
  @tailwind base;
  @tailwind components;
  @tailwind utilities;

  @font-face {
    font-family: 'Cairo';
    src: url('./assets/fonts/Cairo-Regular.woff2') format('woff2');
    font-weight: 400;
    font-style: normal;
    font-display: swap;
  }

  @font-face {
    font-family: 'Cairo';
    src: url('./assets/fonts/Cairo-SemiBold.woff2') format('woff2');
    font-weight: 600;
    font-style: normal;
    font-display: swap;
  }

  @font-face {
    font-family: 'Cairo';
    src: url('./assets/fonts/Cairo-Bold.woff2') format('woff2');
    font-weight: 700;
    font-style: normal;
    font-display: swap;
  }
  ```

#### 2.3.3 Direction & Language Provider
```tsx
// src/context/DirectionContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';

type Direction = 'ltr' | 'rtl';
type Language = 'en' | 'ar';

interface DirectionContextValue {
  direction: Direction;
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
}

const DirectionContext = createContext<DirectionContextValue | undefined>(undefined);

export const DirectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('app_language') as Language) || 'en';
  });

  const direction: Direction = language === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.dir = direction;
    document.documentElement.lang = language;
    localStorage.setItem('app_language', language);
  }, [direction, language]);

  const setLanguage = (lang: Language) => setLanguageState(lang);
  const toggleLanguage = () => setLanguageState(prev => (prev === 'en' ? 'ar' : 'en'));

  return (
    <DirectionContext.Provider value={{ direction, language, setLanguage, toggleLanguage }}>
      {children}
    </DirectionContext.Provider>
  );
};

export const useDirection = () => {
  const context = useContext(DirectionContext);
  if (!context) throw new Error('useDirection must be used within a DirectionProvider');
  return context;
};
```

#### 2.3.4 Theme Provider (Light / Dark Mode)
```tsx
// src/context/ThemeContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem('app_theme') as Theme) || 'system';
  });

  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const resolvedTheme = theme === 'system' ? systemTheme : theme;

  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('app_theme', theme);
  }, [theme, resolvedTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme: setThemeState }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
```

#### 2.3.5 Compact Card Design Guidelines
To satisfy user constraints regarding mobile-first responsiveness and compact cards:
1. **Vertical Space Optimization**:
   - Base padding: Use `p-3` (12px) or `p-3.5` (14px) instead of bloated `p-6` or `p-8`.
   - Header height: Limit card headers to `py-2` with `text-sm font-semibold`.
   - Tight line-height: `leading-tight` or `leading-snug`.
2. **Width & Responsive Containment**:
   - Use `w-full max-w-full overflow-hidden` with `truncate` or `break-words` on all user-supplied text.
   - Grid layout: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3` for dashboard metric cards.
3. **Compact Metric Card Pattern**:
   ```tsx
   interface MetricCardProps {
     title: string;
     value: string;
     subtitle?: string;
     icon: React.ComponentType<{ className?: string }>;
     trend?: { value: string; isPositive: boolean };
   }

   export const CompactMetricCard: React.FC<MetricCardProps> = ({
     title,
     value,
     subtitle,
     icon: Icon,
     trend
   }) => {
     return (
       <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 shadow-xs flex items-center justify-between gap-3 min-w-0">
         <div className="min-w-0 flex-1">
           <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
             {title}
           </p>
           <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate tracking-tight mt-0.5">
             {value}
           </h3>
           {subtitle && (
             <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
               {subtitle}
             </p>
           )}
         </div>
         <div className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
           <Icon className="w-4 h-4" />
         </div>
       </div>
     );
   };
   ```

---

### 2.4 Testing Architecture & Verification Strategy

#### 2.4.1 Test Hierarchy Overview
| Level | Technology | Target | Execution Speed |
|---|---|---|---|
| **Unit Testing** | Vitest + TypeScript | Financial math formulas, currency formatting, rounding, validation logic | <1 second |
| **Integration Testing** | Vitest + React Testing Library + `fake-indexeddb` | Form recalculations, customer balance hooks, RTL provider, state transitions | 1 - 3 seconds |
| **End-to-End (E2E)** | Playwright (`_electron.launch()`) | Native Electron launch, window controls, full RTL layout mirroring, offline write/read, multi-step invoice creation & payment workflow | 5 - 15 seconds |

#### 2.4.2 Vitest Configuration
```ts
// vitest.config.ts
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

Test setup file:
```ts
// src/test/setup.ts
import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';

// Mock matchMedia for jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
});

// Mock window.electronAPI
window.electronAPI = {
  minimizeWindow: vi.fn().mockResolvedValue(undefined),
  maximizeWindow: vi.fn().mockResolvedValue(undefined),
  closeWindow: vi.fn().mockResolvedValue(undefined),
  isMaximized: vi.fn().mockResolvedValue(false),
  printInvoicePDF: vi.fn().mockResolvedValue({ success: true, filePath: 'mock.pdf' }),
  exportFile: vi.fn().mockResolvedValue({ success: true, filePath: 'mock.csv' }),
  getAppVersion: vi.fn().mockResolvedValue('1.0.0'),
  getSystemTheme: vi.fn().mockResolvedValue('light'),
  onThemeChanged: vi.fn().mockReturnValue(() => {})
};
```

#### 2.4.3 Real-Time Financial Math Unit Test Suite
```ts
// src/lib/calculations.test.ts
import { describe, it, expect } from 'vitest';
import { calculateInvoiceTotals, formatCurrency } from './calculations';

describe('Financial Calculations Engine', () => {
  it('calculates line items, tax, discounts and grand total with zero rounding errors', () => {
    const items = [
      { quantity: 3, unitPrice: 150.0, discountPercent: 10 }, // 450 - 45 = 405.00
      { quantity: 2, unitPrice: 47.5, discountPercent: 0 }    // 95.00
    ];
    const taxRate = 15; // 15% VAT

    const totals = calculateInvoiceTotals(items, taxRate);

    expect(totals.subtotal).toBe(500.00);
    expect(totals.taxAmount).toBe(75.00);
    expect(totals.grandTotal).toBe(575.00);
  });

  it('updates Grand Total instantly when quantity is changed', () => {
    const initialItems = [{ quantity: 1, unitPrice: 100.0, discountPercent: 0 }];
    const initial = calculateInvoiceTotals(initialItems, 0);
    expect(initial.grandTotal).toBe(100.00);

    const updatedItems = [{ quantity: 5, unitPrice: 100.0, discountPercent: 0 }];
    const updated = calculateInvoiceTotals(updatedItems, 0);
    expect(updated.grandTotal).toBe(500.00);
  });
});
```

#### 2.4.4 Real-Time Invoice Form Component Test (Integration)
```tsx
// src/components/InvoiceForm.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InvoiceForm } from './InvoiceForm';
import { DirectionProvider } from '@/context/DirectionContext';

describe('InvoiceForm Real-Time Calculations', () => {
  it('updates the Grand Total automatically as user types without clicking any calculate button', async () => {
    const user = userEvent.setup();
    render(
      <DirectionProvider>
        <InvoiceForm onSave={vi.fn()} />
      </DirectionProvider>
    );

    const qtyInput = screen.getByLabelText(/quantity/i);
    const priceInput = screen.getByLabelText(/unit price/i);
    const grandTotalDisplay = screen.getByTestId('grand-total-display');

    // Initially 0.00
    expect(grandTotalDisplay).toHaveTextContent('$0.00');

    // Type quantity = 4
    await user.clear(qtyInput);
    await user.type(qtyInput, '4');

    // Type unit price = 25
    await user.clear(priceInput);
    await user.type(priceInput, '25');

    // Grand total must immediately update to $100.00
    expect(grandTotalDisplay).toHaveTextContent('$100.00');
  });
});
```

#### 2.4.5 Playwright Electron End-to-End (E2E) Test Suite
Playwright provides first-class native Electron testing using the `_electron` runner:
```ts
// tests/e2e/electron.spec.ts
import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

test.describe('Modern Invoice Desktop App E2E', () => {
  let app: any;
  let window: any;

  test.beforeEach(async () => {
    // Launch Electron pointing to packaged or dev main build
    app = await electron.launch({
      args: [path.join(__dirname, '../../dist-electron/main.js')]
    });
    window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');
  });

  test.afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  test('AC1: Application launches successfully as an Electron app', async () => {
    const title = await window.title();
    expect(title).toContain('Modern Invoice App');
    const isVisible = await window.isVisible('#app-root');
    expect(isVisible).toBe(true);
  });

  test('AC2: Switching to Arabic correctly mirrors the UI to RTL', async () => {
    // Check initial LTR state
    const htmlDirBefore = await window.getAttribute('html', 'dir');
    expect(htmlDirBefore).toBe('ltr');

    // Click language switch button
    await window.click('[data-testid="lang-switch-btn"]');

    // Verify root dir attribute changed to rtl
    const htmlDirAfter = await window.getAttribute('html', 'dir');
    expect(htmlDirAfter).toBe('rtl');

    // Verify physical layout mirroring: sidebar should be on right side
    const sidebar = window.locator('[data-testid="app-sidebar"]');
    const box = await sidebar.boundingBox();
    const windowSize = await window.viewportSize();
    // In RTL, sidebar left offset (x) should be near the right edge
    expect(box.x).toBeGreaterThan(windowSize.width / 2);
  });

  test('AC3: Invoice creation updates Grand Total automatically in real-time', async () => {
    await window.click('nav >> text=Invoices');
    await window.click('button >> text=New Invoice');

    // Add item line
    await window.fill('[data-testid="item-qty-0"]', '5');
    await window.fill('[data-testid="item-price-0"]', '200');

    // Verify real-time Grand Total calculation without clicking calculate
    const grandTotal = window.locator('[data-testid="grand-total-display"]');
    await expect(grandTotal).toContainText('1,000.00');
  });

  test('AC4 & AC5: Customer Outstanding Balance & Payment update instantly', async () => {
    // 1. Select Customer
    await window.click('nav >> text=Customers');
    const customerBalanceBefore = await window.textContent('[data-testid="customer-balance-cust-1"]');

    // 2. Create invoice for $500
    await window.click('nav >> text=Invoices');
    await window.click('button >> text=New Invoice');
    await window.selectOption('[data-testid="customer-select"]', 'cust-1');
    await window.fill('[data-testid="item-qty-0"]', '1');
    await window.fill('[data-testid="item-price-0"]', '500');
    await window.click('button >> text=Save Invoice');

    // 3. Verify Customer Outstanding Amount increased by 500
    await window.click('nav >> text=Customers');
    const customerBalanceAfter = window.locator('[data-testid="customer-balance-cust-1"]');
    await expect(customerBalanceAfter).toContainText('500.00');

    // 4. Record payment of $500
    await window.click('nav >> text=Payments');
    await window.click('button >> text=Record Payment');
    await window.selectOption('[data-testid="payment-customer-select"]', 'cust-1');
    await window.fill('[data-testid="payment-amount"]', '500');
    await window.click('button >> text=Submit Payment');

    // 5. Verify Invoice status changes to "Paid"
    await window.click('nav >> text=Invoices');
    const statusBadge = window.locator('[data-testid="invoice-status-0"]');
    await expect(statusBadge).toHaveText(/Paid|مدفوع/);
  });

  test('AC6: Data can be written and read when network connection is disabled (Firestore Offline)', async () => {
    // Simulate offline via app bridge or disableNetwork
    await window.evaluate(async () => {
      // @ts-ignore
      await window.__TEST_SIMULATE_OFFLINE__();
    });

    // Verify offline badge is visible
    const offlineIndicator = window.locator('[data-testid="offline-indicator"]');
    await expect(offlineIndicator).toBeVisible();

    // Create an invoice while completely offline
    await window.click('nav >> text=Invoices');
    await window.click('button >> text=New Invoice');
    await window.fill('[data-testid="item-desc-0"]', 'Offline Consulting Service');
    await window.fill('[data-testid="item-qty-0"]', '2');
    await window.fill('[data-testid="item-price-0"]', '300');
    await window.click('button >> text=Save Invoice');

    // Verify invoice is displayed in the list from local IndexedDB
    const invoiceItem = window.locator('text=Offline Consulting Service');
    await expect(invoiceItem).toBeVisible();

    // Reload the Electron window to simulate app restart while offline
    await window.reload();
    await window.waitForLoadState('domcontentloaded');

    // Data must still be present from persistent IndexedDB
    await window.click('nav >> text=Invoices');
    const persistentInvoice = window.locator('text=Offline Consulting Service');
    await expect(persistentInvoice).toBeVisible();

    // Restore online connection
    await window.evaluate(async () => {
      // @ts-ignore
      await window.__TEST_SIMULATE_ONLINE__();
    });
    await expect(offlineIndicator).not.toBeVisible();
  });
});
```

---

## 3. Caveats

1. **Firestore `runTransaction` Network Dependency**:
   - As documented in Section 2.2.3, Firebase Firestore transactions cannot execute offline because they require active server-side concurrency checking. All multi-document mutations (e.g. creating an invoice while adjusting a customer balance) **must strictly use `writeBatch()`**, which is fully supported offline by IndexedDB.
2. **Local Font Inclusion**:
   - Google Fonts CDN cannot be reached when offline. The Cairo and Tajawal `.woff2` font files must be explicitly committed and bundled in the static build assets directory (`src/assets/fonts/`).
3. **Electron Windows Frame & Titlebar**:
   - On Windows, frameless windows (`frame: false`) require either Electron's `titleBarOverlay` or custom drag regions (`-webkit-app-region: drag` and `-webkit-app-region: no-drag` on interactive buttons) to allow window moving and resizing.
4. **IndexedDB Storage Quotas**:
   - Chromium allows significant IndexedDB storage (typically up to 60% of available disk space on desktop). Using `cacheSizeBytes: CACHE_SIZE_UNLIMITED` ensures invoices, line items, and audit logs are never prematurely evicted by garbage collection.

---

## 4. Conclusion

### 4.1 Recommended Package Dependencies
```json
{
  "name": "modern-invoice-desktop",
  "version": "1.0.0",
  "private": true,
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "package": "npm run build && electron-builder"
  },
  "dependencies": {
    "firebase": "^10.12.0",
    "lucide-react": "^0.395.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.23.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.3.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.44.1",
    "@testing-library/jest-dom": "^6.4.5",
    "@testing-library/react": "^15.0.7",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.19",
    "electron": "^30.0.9",
    "electron-builder": "^24.13.3",
    "fake-indexeddb": "^6.0.0",
    "jsdom": "^24.1.0",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.3",
    "typescript": "^5.4.5",
    "vite": "^5.2.11",
    "vite-plugin-electron": "^0.28.6",
    "vite-plugin-electron-renderer": "^0.14.5",
    "vitest": "^1.6.0"
  }
}
```

### 4.2 Target Project Structure
```
modern-invoice-desktop/
├── electron/
│   ├── main.ts               # Electron Main Process (Lifecycle, Window, Security)
│   ├── preload.ts            # Preload contextBridge API exposure
│   └── ipcHandlers.ts        # Privileged IPC handlers (PDF, Dialogs, Window controls)
├── src/
│   ├── assets/
│   │   └── fonts/            # Cairo & Tajawal WOFF2 offline fonts
│   ├── components/
│   │   ├── layout/           # Frameless TitleBar, Sidebar, AppLayout
│   │   ├── common/           # Compact Card, Button, Input, Modal, Table
│   │   └── modules/          # Invoices, Customers, Payments, Dashboard, Statements
│   ├── context/
│   │   ├── DirectionContext.tsx  # RTL/LTR direction & Arabic toggle
│   │   └── ThemeContext.tsx      # Light/Dark mode provider
│   ├── hooks/
│   │   ├── useInvoices.ts    # Firestore offline-first invoice CRUD
│   │   ├── useCustomers.ts   # Firestore offline-first customer CRUD
│   │   └── useSyncStatus.ts  # Network & sync state tracker
│   ├── lib/
│   │   ├── firebase.ts       # Firestore init with persistentMultipleTabManager
│   │   └── calculations.ts   # Financial math, real-time totals, formatting
│   ├── types/
│   │   ├── domain.ts         # Invoice, Customer, Payment, Statement interfaces
│   │   └── electron.d.ts     # Window.electronAPI typed interfaces
│   ├── App.tsx
│   ├── index.css             # Tailwind imports & local @font-face declarations
│   └── main.tsx              # React DOM entry point
├── tests/
│   ├── unit/                 # Vitest calculation and domain logic tests
│   └── e2e/                  # Playwright Electron E2E test specs
├── index.html                # App entry HTML with CSP
├── tailwind.config.js        # Logical properties & theme config
├── vite.config.ts            # Vite + vite-plugin-electron dual build
└── vitest.config.ts          # Vitest + jsdom + fake-indexeddb setup
```

---

## 5. Verification Method

To independently verify the technical architecture and testing infrastructure:

1. **Verify Unit & Integration Tests (Fast Feedback)**:
   ```bash
   npx vitest run
   ```
   *Expected outcome*: All financial calculation tests (subtotal, taxes, discounts, grand totals) pass in <2s with zero floating point errors; RTL context toggling tests pass.

2. **Verify Electron Build & Package**:
   ```bash
   npx vite build
   ```
   *Expected outcome*: Generates `dist/` containing the bundled React renderer and `dist-electron/` containing `main.js` and `preload.js`.

3. **Verify Playwright Electron E2E Tests**:
   ```bash
   npx playwright test
   ```
   *Expected outcome*: Launches the Electron binary headlessly, validates window creation, executes language toggle to verify `dir="rtl"`, verifies real-time recalculations on user input without page refresh, validates customer outstanding balance modifications upon invoice creation, and proves offline read/write capability across simulated network disconnections and window reloads.

4. **Invalidation Conditions**:
   - If `runTransaction()` is used instead of `writeBatch()`, multi-document writes will throw exceptions when offline.
   - If Google Fonts are referenced via external `<link>` rather than bundled locally, fonts will fail to load when offline.
   - If `nodeIntegration: true` or `contextIsolation: false` are configured, security sandbox violations will be raised.
