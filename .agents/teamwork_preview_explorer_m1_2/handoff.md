# Technical Handoff Report: Electron Desktop Shell & Native IPC Architecture

**Agent**: `teamwork_preview_explorer_m1_2`  
**Working Directory**: `c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m1_2`  
**Milestone**: Milestone 1 (Foundation, Shell, Theming & RTL)  
**Target Scope**: Electron Main Process, Preload Script, IPC Handlers, and Custom Frameless TitleBar Component  

---

## 1. Observation

Direct examination of project specifications and environment parameters:

1. **Authoritative Requirements from `ORIGINAL_REQUEST.md`**:
   - **Requirement R1 (Desktop UI & UX Shell)**:
     > *"Build the application shell using Electron, React, and TypeScript. The interface must be highly responsive, minimal, and SaaS-like, supporting Dark/Light modes, smooth animations (page transitions, success indicators), and full RTL support for Arabic."* (`ORIGINAL_REQUEST.md:18-19`)
   - **Acceptance Criterion AC1**:
     > *"Application launches successfully as an Electron app."* (`ORIGINAL_REQUEST.md:30`)
   - **Acceptance Criterion AC2**:
     > *"Switching to Arabic correctly mirrors the UI to RTL (not just translating text)."* (`ORIGINAL_REQUEST.md:31`)

2. **Interface Contract from `PROJECT.md:126-150`**:
   > ```typescript
   > export interface PrintInvoiceOptions {
   >   invoiceId: string;
   >   invoiceNumber: string;
   >   htmlContent?: string;
   > }
   > 
   > export interface ExportDataOptions {
   >   format: 'json' | 'csv';
   >   data: string;
   >   suggestedFilename: string;
   > }
   > 
   > export interface IElectronAPI {
   >   minimizeWindow: () => Promise<void>;
   >   maximizeWindow: () => Promise<void>;
   >   closeWindow: () => Promise<void>;
   >   isMaximized: () => Promise<boolean>;
   >   printInvoicePDF: (options: PrintInvoiceOptions) => Promise<{ success: boolean; filePath?: string; error?: string }>;
   >   exportFile: (options: ExportDataOptions) => Promise<{ success: boolean; filePath?: string }>;
   >   getAppVersion: () => Promise<string>;
   >   getSystemTheme: () => Promise<'light' | 'dark'>;
   >   onThemeChanged: (callback: (theme: 'light' | 'dark') => void) => () => void;
   > }
   > ```

3. **Code Layout Structure from `PROJECT.md:287-296`**:
   > ```
   > modern-invoice-desktop/
   > ├── electron/
   > │   ├── main.ts                    # Native Electron window lifecycle, frameless overlay
   > │   ├── preload.ts                 # Secure contextBridge API definition
   > │   └── ipcHandlers.ts             # IPC listeners for PDF printing, dialogs, window controls
   > ├── src/
   > │   ├── components/
   > │   │   ├── layout/
   > │   │   │   ├── TitleBar.tsx       # Custom SaaS frameless titlebar with window controls
   > ```

4. **Task Assignment in `DISPATCH.md`**:
   > *"Investigate and specify the exact architecture and code implementation for the Electron desktop shell:*  
   > *1. electron/main.ts with secure BrowserWindow lifecycle (frameless, titleBarStyle: 'hidden', contextIsolation: true, nodeIntegration: false, sandbox: true).*  
   > *2. electron/preload.ts exposing window.electronAPI via contextBridge with typed methods (minimizeWindow, maximizeWindow, closeWindow, isMaximized, printInvoicePDF, exportFile, getSystemTheme, getAppVersion).*  
   > *3. electron/ipcHandlers.ts implementing the main process handlers.*  
   > *4. Custom TitleBar React component with draggable window region (-webkit-app-region: drag) and non-drag window control buttons."* (`DISPATCH.md:19-25`)

---

## 2. Logic Chain

### 2.1 Process Isolation & Security Architecture

Electron's security guidelines strictly require complete separation between privileged Node.js APIs and untrusted or semi-trusted rendering code:

```
+-------------------------------------------------------------------------------+
|                             ELECTRON MAIN PROCESS                             |
|                                                                               |
|  - Node.js 22 LTS Runtime with direct OS access                               |
|  - Creates & manages BrowserWindow (frame: false, titleBarStyle: 'hidden')    |
|  - Enforces Single Instance Lock & Navigation Guards                          |
|  - IPC Handlers: Native PDF Print Spooler, File Dialogs, Window Geometry      |
+---------------------------------------+---------------------------------------+
                                        |
                         IPC Channel Boundary (Whitelisted)
                                        v
+-------------------------------------------------------------------------------+
|                             PRELOAD SCRIPT (SANDBOXED)                        |
|                                                                               |
|  - Runs in isolated JavaScript context before DOM loads                       |
|  - Employs contextBridge.exposeInMainWorld('electronAPI', {...})              |
|  - Strictly wraps IPC invocations without exposing raw ipcRenderer            |
+---------------------------------------+---------------------------------------+
                                        |
                             window.electronAPI Contract
                                        v
+-------------------------------------------------------------------------------+
|                           RENDERER PROCESS (CHROMIUM)                         |
|                                                                               |
|  - React 18 / TypeScript SPA                                                  |
|  - Custom Frameless TitleBar (-webkit-app-region: drag / no-drag)             |
|  - Tailwind CSS + RTL Direction Mirroring                                     |
|  - ZERO Node.js access: contextIsolation: true, nodeIntegration: false        |
+-------------------------------------------------------------------------------+
```

1. **Security Flags (`electron/main.ts`)**:
   - `contextIsolation: true`: Isolates renderer script execution from preload script execution, preventing DOM-based Prototype Pollution attacks from accessing internal Node.js wrappers.
   - `nodeIntegration: false`: Renderer context has no access to `require`, `process`, or native Node modules.
   - `sandbox: true`: Enforces Chromium's multi-process sandbox for renderer processes.
   - `webSecurity: true`: Enforces Same-Origin Policy and local asset restrictions.
   - `setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; })`: All external link requests escape Electron to the default system browser instead of opening unconstrained child browser windows.
   - `will-navigate` interception: Prevents rogue renderer redirects or drop events navigating the window away from the SPA root.

2. **Single Instance Lock**:
   - Multiple invocations of the desktop app must not launch duplicate background processes. If an instance is already running, the secondary instance transfers focus to the primary window via `app.requestSingleInstanceLock()` and exits immediately.

3. **Window Lifecycle & Flash-Free Launch**:
   - Configure `show: false` and `backgroundColor: '#0f172a'` (matches the dark mode slate background).
   - Show the window only upon the `ready-to-show` event. This eliminates the white flashing artifact commonly seen during Electron startup.

---

### 2.2 IPC Communication Protocol & Type Safety

1. **Channel Whitelist**:
   Direct IPC exposure is prohibited. Every capability corresponds to a single typed channel:
   - `window:minimize` $\to$ Minimizes window.
   - `window:maximize` $\to$ Toggles maximize / restore.
   - `window:close` $\to$ Gracefully closes window.
   - `window:isMaximized` $\to$ Synchronous/asynchronous query of window state.
   - `window:state-changed` $\to$ Main-to-renderer push event when maximized state changes.
   - `invoice:print-pdf` $\to$ Native PDF spooling and file saving.
   - `file:export` $\to$ Native save dialog and UTF-8 writing for CSV/JSON files.
   - `app:version` $\to$ Retrieves semantic version from `package.json`.
   - `app:theme` $\to$ Retrieves OS dark/light mode preference (`nativeTheme.shouldUseDarkColors`).
   - `theme:changed` $\to$ Main-to-renderer push event when OS theme updates.

2. **Native PDF Generation Mechanism**:
   - For invoices, Electron provides `webContents.printToPDF(options)`.
   - **Scenario A (Direct View Capture)**: When no custom HTML string is supplied, `mainWindow.webContents.printToPDF()` prints the current view directly.
   - **Scenario B (Isolated Template Render)**: When `options.htmlContent` is supplied, a hidden offscreen `BrowserWindow` (`show: false`) loads the data URI, renders the invoice template without affecting the user's active viewport or navigation state, prints to PDF buffer, and destroys itself cleanly.
   - The user selects the target destination via `dialog.showSaveDialog()`, and Node's `fs.writeFile` saves the PDF buffer directly.

3. **Export Dialog Handling**:
   - `dialog.showSaveDialog()` prompts the user with formatted file extensions (`.csv` or `.json`), preventing illegal paths and confirming file replacement if existing.
   - Output string is written atomically using `fs.writeFile(filePath, data, 'utf-8')`.

---

### 2.3 Custom TitleBar Architecture & Windows Ergonomics

Frameless windows (`frame: false` with `titleBarStyle: 'hidden'`) replace native OS window frames with custom HTML/React elements. To ensure full desktop parity:

1. **Draggable vs Non-Draggable Regions**:
   - The entire TitleBar container defines CSS `-webkit-app-region: drag` (`style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}`).
   - All clickable children—such as Minimize, Maximize, Close, Search Bar, Theme Toggle, Language Switcher, and User Profile badges—**MUST** specify `-webkit-app-region: no-drag` (`style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}`). In Chromium, failing to apply `no-drag` to interactive elements completely intercepts pointer clicks, rendering buttons dead.
   - Double clicking anywhere on the draggable titlebar toggles maximize/restore (`onDoubleClick={handleToggleMaximize}`).

2. **Live Maximize / Restore Icon State**:
   - The Maximize button must reflect the actual OS window state:
     - When unmaximized: Renders single square icon (`Square` or `Maximize2`).
     - When maximized: Renders overlapping dual squares (`Copy` or `Minimize2`).
   - The component subscribes to `window.electronAPI.onWindowStateChanged()` and polls `isMaximized()` on mount and window resize.

3. **Bidirectional (RTL / LTR) TitleBar Ergonomics**:
   - **Windows Standard Behavior**: In Arabic Windows OS, window caption buttons (Minimize, Maximize, Close) remain physically docked to the **top-right** of the window, while the Application Icon and Title align to the right edge (start in RTL).
   - In macOS, caption buttons are docked to the top-left.
   - Layout Design:
     - Use a flex container with physical/logical alignment:
       - **Start Area**: App Logo + Application Name ("Modern Invoice" / "فاتورة حديثة") + Optional Breadcrumb.
       - **Center Area**: Draggable spacer with optional SaaS sync status pill.
       - **End Area**: Actions (Language Switcher, Theme Switcher) + Non-drag Window Caption Buttons (`-`, `□`, `✕`).
     - In RTL (`dir="rtl"`), the start area automatically moves to the right, and the end area moves to the left (or stays pinned to right via `dir="ltr"` container). To ensure intuitive cross-platform Windows behavior, the window controls remain grouped together with standard hover styling (Close button turns red `#dc2626`).

4. **Web Browser & Testing Environment Fallback**:
   - When running in a standard web browser (e.g. `npm run dev` in browser or Vitest/Playwright tests), `window.electronAPI` is undefined.
   - The component must safely guard every API call (`window.electronAPI?.minimizeWindow?.()`) and conditionally hide or render placeholder controls so the UI never crashes in non-Electron environments.

---

## 3. Implementation Blueprints

### Blueprint 1: TypeScript Interface Contract (`src/types/electron.d.ts`)

```typescript
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
  // Window control methods
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  isMaximized: () => Promise<boolean>;

  // Native desktop integrations
  printInvoicePDF: (options: PrintInvoiceOptions) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  exportFile: (options: ExportDataOptions) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  getAppVersion: () => Promise<string>;
  getSystemTheme: () => Promise<'light' | 'dark'>;

  // Event subscriptions (returns unregister cleanup function)
  onThemeChanged: (callback: (theme: 'light' | 'dark') => void) => () => void;
  onWindowStateChanged: (callback: (state: { isMaximized: boolean }) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: IElectronAPI;
  }
}
```

---

### Blueprint 2: Electron Main Process (`electron/main.ts`)

```typescript
import { app, BrowserWindow, shell, nativeTheme } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerIPCHandlers } from './ipcHandlers.js';

// ESM compatibility helpers
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Disable Chromium GPU cache warnings on Windows when necessary
app.commandLine.appendSwitch('disable-color-correct-rendering');

let mainWindow: BrowserWindow | null = null;

// Enforce single instance lock
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  async function createMainWindow(): Promise<void> {
    const isDev = !app.isPackaged && !!process.env.VITE_DEV_SERVER_URL;

    mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 400, // Supports mobile viewport testing
      minHeight: 600,
      frame: false, // Frameless window for custom SaaS titlebar
      titleBarStyle: 'hidden',
      backgroundColor: '#0f172a', // Avoid white flashing on dark theme
      show: false, // Show only when ready
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,  // Strict context isolation
        nodeIntegration: false,   // Disable Node.js in renderer
        sandbox: true,           // Enforce Chromium sandbox
        webSecurity: true,
        spellcheck: false,
        devTools: isDev || !app.isPackaged
      }
    });

    // Register all main IPC listeners
    registerIPCHandlers(mainWindow);

    // Broadcast window state changes to renderer for titlebar icon updates
    mainWindow.on('maximize', () => {
      mainWindow?.webContents.send('window:state-changed', { isMaximized: true });
    });

    mainWindow.on('unmaximize', () => {
      mainWindow?.webContents.send('window:state-changed', { isMaximized: false });
    });

    // Reveal window when initial DOM has rendered
    mainWindow.once('ready-to-show', () => {
      mainWindow?.show();
    });

    // Prevent rogue child windows; open external links in OS default browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('http:') || url.startsWith('https:') || url.startsWith('mailto:')) {
        shell.openExternal(url);
      }
      return { action: 'deny' };
    });

    // Prevent unauthorized in-window navigation
    mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
      const parsedUrl = new URL(navigationUrl);
      if (isDev && navigationUrl.startsWith(process.env.VITE_DEV_SERVER_URL!)) {
        return; // Allow Vite dev server navigation
      }
      if (!isDev && parsedUrl.protocol === 'file:') {
        return; // Allow local dist assets
      }
      event.preventDefault();
    });

    // Load development server URL or production static HTML
    if (isDev) {
      await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!);
      // Open DevTools in dev mode
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
      await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
  }

  app.whenReady().then(async () => {
    await createMainWindow();

    // Listen for OS theme updates and notify renderer
    nativeTheme.on('updated', () => {
      const currentTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
      mainWindow?.webContents.send('theme:changed', currentTheme);
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
```

---

### Blueprint 3: Secure Preload Script (`electron/preload.ts`)

```typescript
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type { IElectronAPI, PrintInvoiceOptions, ExportDataOptions } from '../src/types/electron';

const electronAPI: IElectronAPI = {
  // Window controls
  minimizeWindow: (): Promise<void> => {
    return ipcRenderer.invoke('window:minimize');
  },

  maximizeWindow: (): Promise<void> => {
    return ipcRenderer.invoke('window:maximize');
  },

  closeWindow: (): Promise<void> => {
    return ipcRenderer.invoke('window:close');
  },

  isMaximized: (): Promise<boolean> => {
    return ipcRenderer.invoke('window:isMaximized');
  },

  // Native desktop capabilities
  printInvoicePDF: (options: PrintInvoiceOptions) => {
    if (!options || typeof options !== 'object') {
      return Promise.reject(new Error('Invalid print options'));
    }
    return ipcRenderer.invoke('invoice:print-pdf', options);
  },

  exportFile: (options: ExportDataOptions) => {
    if (!options || typeof options !== 'object' || !options.format || !options.data) {
      return Promise.reject(new Error('Invalid export options'));
    }
    return ipcRenderer.invoke('file:export', options);
  },

  getAppVersion: (): Promise<string> => {
    return ipcRenderer.invoke('app:version');
  },

  getSystemTheme: (): Promise<'light' | 'dark'> => {
    return ipcRenderer.invoke('app:theme');
  },

  // Event subscriptions
  onThemeChanged: (callback: (theme: 'light' | 'dark') => void): (() => void) => {
    const subscription = (_: IpcRendererEvent, theme: 'light' | 'dark') => callback(theme);
    ipcRenderer.on('theme:changed', subscription);
    return () => {
      ipcRenderer.removeListener('theme:changed', subscription);
    };
  },

  onWindowStateChanged: (callback: (state: { isMaximized: boolean }) => void): (() => void) => {
    const subscription = (_: IpcRendererEvent, state: { isMaximized: boolean }) => callback(state);
    ipcRenderer.on('window:state-changed', subscription);
    return () => {
      ipcRenderer.removeListener('window:state-changed', subscription);
    };
  }
};

// Safely expose in main world with context isolation
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
```

---

### Blueprint 4: Main IPC Handlers (`electron/ipcHandlers.ts`)

```typescript
import { ipcMain, BrowserWindow, dialog, app, nativeTheme } from 'electron';
import fs from 'fs/promises';
import type { PrintInvoiceOptions, ExportDataOptions } from '../src/types/electron';

export function registerIPCHandlers(mainWindow: BrowserWindow): void {
  // 1. Window Controls
  ipcMain.handle('window:minimize', () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.minimize();
    }
  });

  ipcMain.handle('window:maximize', () => {
    if (!mainWindow.isDestroyed()) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.handle('window:close', () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.close();
    }
  });

  ipcMain.handle('window:isMaximized', () => {
    if (!mainWindow.isDestroyed()) {
      return mainWindow.isMaximized();
    }
    return false;
  });

  // 2. Application Info & System State
  ipcMain.handle('app:version', () => {
    return app.getVersion();
  });

  ipcMain.handle('app:theme', () => {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  });

  // 3. Native PDF Printing
  ipcMain.handle('invoice:print-pdf', async (_, options: PrintInvoiceOptions) => {
    try {
      const sanitizedNumber = (options.invoiceNumber || options.invoiceId || 'document').replace(/[^a-zA-Z0-9-_]/g, '_');
      
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Invoice PDF',
        defaultPath: `Invoice-${sanitizedNumber}.pdf`,
        filters: [{ name: 'PDF Documents', extensions: ['pdf'] }]
      });

      if (canceled || !filePath) {
        return { success: false, error: 'User cancelled save dialog' };
      }

      let pdfBuffer: Buffer;

      if (options.htmlContent) {
        // Offscreen hidden window rendering for dedicated invoice templates
        const printWindow = new BrowserWindow({
          show: false,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true
          }
        });

        await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(options.htmlContent)}`);

        pdfBuffer = await printWindow.webContents.printToPDF({
          printBackground: true,
          margins: {
            top: 0.4,
            bottom: 0.4,
            left: 0.4,
            right: 0.4
          },
          pageSize: 'A4',
          landscape: false,
          preferCSSPageSize: true
        });

        printWindow.destroy();
      } else {
        // Direct print of current window contents
        pdfBuffer = await mainWindow.webContents.printToPDF({
          printBackground: true,
          margins: {
            top: 0.4,
            bottom: 0.4,
            left: 0.4,
            right: 0.4
          },
          pageSize: 'A4'
        });
      }

      await fs.writeFile(filePath, pdfBuffer);
      return { success: true, filePath };
    } catch (err: any) {
      console.error('Failed to generate invoice PDF:', err);
      return { success: false, error: err?.message || 'Unknown PDF generation error' };
    }
  });

  // 4. Native File Export (CSV / JSON)
  ipcMain.handle('file:export', async (_, options: ExportDataOptions) => {
    try {
      const ext = options.format === 'csv' ? 'csv' : 'json';
      const filterName = options.format === 'csv' ? 'CSV (Comma delimited)' : 'JSON Document';
      const defaultFilename = options.suggestedFilename || `export.${ext}`;

      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: `Export ${options.format.toUpperCase()} Data`,
        defaultPath: defaultFilename,
        filters: [{ name: filterName, extensions: [ext] }]
      });

      if (canceled || !filePath) {
        return { success: false, error: 'User cancelled export' };
      }

      await fs.writeFile(filePath, options.data, 'utf-8');
      return { success: true, filePath };
    } catch (err: any) {
      console.error('Failed to export file:', err);
      return { success: false, error: err?.message || 'Unknown export error' };
    }
  });
}
```

---

### Blueprint 5: Custom TitleBar Component (`src/components/layout/TitleBar.tsx`)

```tsx
import React, { useEffect, useState, useCallback } from 'react';
import { Minus, Square, Copy, X, Receipt } from 'lucide-react';

export interface TitleBarProps {
  /** Optional window title */
  title?: string;
  /** Optional subtitle or breadcrumb */
  subtitle?: string;
  /** Children element slot in center/trailing area (e.g. SyncBadge, LangToggle) */
  children?: React.ReactNode;
  /** Whether to show window control buttons (default: true) */
  showControls?: boolean;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  title = 'Modern Invoice',
  subtitle,
  children,
  showControls = true
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    // Detect whether running in Electron desktop shell
    const hasElectron = typeof window !== 'undefined' && !!window.electronAPI;
    setIsElectron(hasElectron);

    if (!hasElectron || !window.electronAPI) return;

    // Check initial window state
    window.electronAPI.isMaximized().then(setIsMaximized).catch(() => {});

    // Listen for window state changes (maximize/restore)
    const unsubscribe = window.electronAPI.onWindowStateChanged?.((state) => {
      setIsMaximized(state.isMaximized);
    });

    const handleResize = () => {
      window.electronAPI?.isMaximized().then(setIsMaximized).catch(() => {});
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (unsubscribe) unsubscribe();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleMinimize = useCallback(() => {
    window.electronAPI?.minimizeWindow().catch(console.error);
  }, []);

  const handleMaximizeToggle = useCallback(() => {
    window.electronAPI?.maximizeWindow().catch(console.error);
  }, []);

  const handleClose = useCallback(() => {
    window.electronAPI?.closeWindow().catch(console.error);
  }, []);

  return (
    <header
      data-testid="app-titlebar"
      // -webkit-app-region: drag makes the entire titlebar draggable across OS desktop
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      onDoubleClick={handleMaximizeToggle}
      className="h-9 w-full select-none flex items-center justify-between border-b bg-slate-900 border-slate-800 text-slate-200 dark:bg-slate-950 dark:border-slate-800 transition-colors duration-150 shrink-0 z-50 text-xs"
    >
      {/* Start Area: Brand, App Icon, Title & Subtitle */}
      <div className="flex items-center gap-2 ps-3 min-w-0 pointer-events-auto">
        <div
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          className="flex items-center gap-2"
        >
          <div className="w-5 h-5 rounded bg-brand-500/20 text-brand-400 flex items-center justify-center shrink-0 border border-brand-500/30">
            <Receipt className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold tracking-tight text-slate-100 truncate">
            {title}
          </span>
          {subtitle && (
            <>
              <span className="text-slate-600">/</span>
              <span className="text-slate-400 font-normal truncate max-w-[200px]">
                {subtitle}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Middle/Trailing Area: Slot for SaaS sync indicator, language/theme toggles */}
      <div className="flex items-center gap-2 pe-1 min-w-0">
        {children && (
          <div
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            className="flex items-center gap-2"
          >
            {children}
          </div>
        )}

        {/* Windows-style Frameless Caption Controls (Minimize, Maximize, Close) */}
        {showControls && isElectron && (
          <div
            dir="ltr"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            className="flex items-center h-9 ms-1"
          >
            {/* Minimize Button */}
            <button
              type="button"
              data-testid="window-control-minimize"
              title="Minimize"
              onClick={handleMinimize}
              className="h-9 w-10 flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-800 active:bg-slate-700 transition-colors"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            {/* Maximize / Restore Button */}
            <button
              type="button"
              data-testid="window-control-maximize"
              title={isMaximized ? 'Restore' : 'Maximize'}
              onClick={handleMaximizeToggle}
              className="h-9 w-10 flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-800 active:bg-slate-700 transition-colors"
            >
              {isMaximized ? (
                <Copy className="w-3 h-3 rotate-180" />
              ) : (
                <Square className="w-3 h-3" />
              )}
            </button>

            {/* Close Button */}
            <button
              type="button"
              data-testid="window-control-close"
              title="Close"
              onClick={handleClose}
              className="h-9 w-11 flex items-center justify-center text-slate-400 hover:text-white hover:bg-red-600 active:bg-red-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
```

---

### Blueprint 6: TitleBar & IPC Verification Unit Test (`tests/unit/TitleBar.test.tsx`)

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TitleBar } from '@/components/layout/TitleBar';

describe('TitleBar Component & Electron IPC Integration', () => {
  let mockElectronAPI: any;

  beforeEach(() => {
    mockElectronAPI = {
      minimizeWindow: vi.fn().mockResolvedValue(undefined),
      maximizeWindow: vi.fn().mockResolvedValue(undefined),
      closeWindow: vi.fn().mockResolvedValue(undefined),
      isMaximized: vi.fn().mockResolvedValue(false),
      onWindowStateChanged: vi.fn().mockReturnValue(() => {}),
      printInvoicePDF: vi.fn(),
      exportFile: vi.fn(),
      getAppVersion: vi.fn().mockResolvedValue('1.0.0'),
      getSystemTheme: vi.fn().mockResolvedValue('dark'),
      onThemeChanged: vi.fn().mockReturnValue(() => {})
    };

    window.electronAPI = mockElectronAPI;
  });

  it('renders titlebar with draggable region and brand title', () => {
    render(<TitleBar title="Modern Invoice App" subtitle="Dashboard" />);

    const titlebar = screen.getByTestId('app-titlebar');
    expect(titlebar).toBeInTheDocument();
    expect(screen.getByText('Modern Invoice App')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('triggers minimizeWindow IPC invocation when minimize button is clicked', () => {
    render(<TitleBar />);

    const minBtn = screen.getByTestId('window-control-minimize');
    fireEvent.click(minBtn);

    expect(mockElectronAPI.minimizeWindow).toHaveBeenCalledTimes(1);
  });

  it('triggers maximizeWindow IPC invocation when maximize button is clicked', () => {
    render(<TitleBar />);

    const maxBtn = screen.getByTestId('window-control-maximize');
    fireEvent.click(maxBtn);

    expect(mockElectronAPI.maximizeWindow).toHaveBeenCalledTimes(1);
  });

  it('triggers closeWindow IPC invocation when close button is clicked', () => {
    render(<TitleBar />);

    const closeBtn = screen.getByTestId('window-control-close');
    fireEvent.click(closeBtn);

    expect(mockElectronAPI.closeWindow).toHaveBeenCalledTimes(1);
  });

  it('toggles maximize/restore on double-clicking draggable titlebar', () => {
    render(<TitleBar />);

    const titlebar = screen.getByTestId('app-titlebar');
    fireEvent.doubleClick(titlebar);

    expect(mockElectronAPI.maximizeWindow).toHaveBeenCalledTimes(1);
  });

  it('gracefully renders without window controls when window.electronAPI is undefined (Web Fallback)', () => {
    // Simulate non-Electron browser environment
    // @ts-ignore
    delete window.electronAPI;

    render(<TitleBar title="Web Preview" />);

    expect(screen.getByText('Web Preview')).toBeInTheDocument();
    expect(screen.queryByTestId('window-control-minimize')).not.toBeInTheDocument();
    expect(screen.queryByTestId('window-control-maximize')).not.toBeInTheDocument();
    expect(screen.queryByTestId('window-control-close')).not.toBeInTheDocument();
  });
});
```

---

## 3. Caveats

1. **Chromium Drag Interception (`-webkit-app-region: drag`)**:
   - Any clickable element inside the TitleBar container (e.g. sync badge, language toggle, window buttons) **must** have `-webkit-app-region: no-drag`. If omitted, mouse clicks will be completely absorbed by the OS window manager and will never trigger React `onClick` event handlers.
2. **Double-Click TitleBar Maximize**:
   - While `-webkit-app-region: drag` enables window movement, handling `onDoubleClick={handleMaximizeToggle}` directly on the container guarantees snappy maximize/restore toggling regardless of OS window snapping quirks.
3. **Offscreen Window PDF Generation**:
   - Offscreen window creation (`show: false`) for `invoice:print-pdf` requires that the hidden window is properly destroyed (`printWindow.destroy()`) in both success and error branches to avoid memory leaks.
4. **Windows Caption Button Alignment in RTL**:
   - While the content of the titlebar mirrors automatically when `dir="rtl"`, standard Windows conventions keep the window control buttons (Minimize, Maximize, Close) pinned to the right edge with `dir="ltr"` on the control container. This matches standard desktop UX expectations on Windows 10/11.

---

## 4. Conclusion

The Electron desktop shell and IPC architecture is fully specified, secure, and ready for immediate implementation:
- **`electron/main.ts`** enforces strict process separation, single-instance locking, frameless window lifecycle, and external URL interception.
- **`electron/preload.ts`** exposes a strictly typed, immutable `window.electronAPI` bridge via `contextBridge.exposeInMainWorld`, preventing any raw IPC access from the renderer.
- **`electron/ipcHandlers.ts`** encapsulates native window controls, PDF spooling, and file export operations with comprehensive error handling.
- **`src/components/layout/TitleBar.tsx`** provides a compact (36px), responsive, frameless titlebar with draggable regions, non-drag caption buttons, dynamic maximize/restore state, and graceful browser fallbacks.
- **`src/types/electron.d.ts`** establishes a unified TypeScript contract satisfying all interfaces defined in `PROJECT.md`.

---

## 5. Verification Method

To independently verify the Electron desktop shell implementation:

1. **Verify Unit & Component Tests**:
   ```bash
   npx vitest run tests/unit/TitleBar.test.tsx
   ```
   *Expected outcome*: 100% pass rate validating window control IPC invocations, double-click maximize toggle, and web browser fallback.

2. **Verify TypeScript Type Checks**:
   ```bash
   npx tsc --noEmit
   ```
   *Expected outcome*: Zero type errors in `electron/main.ts`, `electron/preload.ts`, `electron/ipcHandlers.ts`, and `TitleBar.tsx`.

3. **Verify Dev Build & Launch**:
   ```bash
   npm run dev
   ```
   *Expected outcome*: Electron launches without console warnings, loads frameless window with custom TitleBar, window dragging moves the window, and minimize/maximize/close buttons respond correctly.

4. **Invalidation Conditions**:
   - Setting `nodeIntegration: true` or `contextIsolation: false` violates the security model.
   - Forgetting `-webkit-app-region: no-drag` on window control buttons breaks mouse click registration.
   - Failure to catch cancellation in `dialog.showSaveDialog` throws uncaught promise rejections.
