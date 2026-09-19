import { app, BrowserWindow, shell, nativeTheme, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { registerIPCHandlers } from './ipcHandlers';
import { autoUpdater } from 'electron-updater';

// ESM compatibility helpers
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

// ─── Auto-Updater Setup (In-App Cloud Updates Without App Stores) ────────────
/**
 * Any future agent / developer note:
 * - This handles downloading and installing updates completely inside the app.
 * - The cloud feed is defined in package.json -> build.publish (e.g. GitHub Releases).
 * - `autoDownload = false` gives full control to the user via the UI <UpdateBadge />.
 * - Progress & state are pushed to React via IPC ('update:state', 'update:progress').
 * - `update:install` executes `autoUpdater.quitAndInstall(false, true)`.
 */
function sendUpdateState(state: string, payload?: object) {
  mainWindow?.webContents.send('update:state', { state, ...payload });
}

function setupAutoUpdater(): void {
  // In dev mode, skip auto-update (only works in packaged production builds)
  if (!app.isPackaged) {
    autoUpdater.forceDevUpdateConfig = false;
    return;
  }

  autoUpdater.autoDownload = false;        // Manual download — user decides
  autoUpdater.autoInstallOnAppQuit = true; // Install silently on next quit

  autoUpdater.on('checking-for-update', () => {
    sendUpdateState('checking');
  });

  autoUpdater.on('update-available', (info) => {
    sendUpdateState('available', {
      info: { version: info.version, releaseNotes: info.releaseNotes }
    });
  });

  autoUpdater.on('update-not-available', () => {
    sendUpdateState('idle');
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update:progress', {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendUpdateState('downloaded', {
      info: { version: info.version, releaseNotes: info.releaseNotes }
    });
  });

  autoUpdater.on('error', (err) => {
    sendUpdateState('error', { error: err?.message ?? String(err) });
  });

  // IPC: Renderer asks to check for updates
  ipcMain.handle('update:check', async () => {
    try {
      await autoUpdater.checkForUpdates();
    } catch (err: any) {
      sendUpdateState('error', { error: err?.message ?? String(err) });
    }
  });

  // IPC: Renderer asks to start download
  ipcMain.handle('update:download', async () => {
    try {
      await autoUpdater.downloadUpdate();
    } catch (err: any) {
      sendUpdateState('error', { error: err?.message ?? String(err) });
    }
  });

  // IPC: Renderer asks to quit and install
  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall(false, true);
  });

  // Auto-check ~5 seconds after launch (non-blocking)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {/* silent fail in packaged app */});
  }, 5000);
}

if (process.env.ELECTRON_USER_DATA_DIR) {
  app.setPath('userData', process.env.ELECTRON_USER_DATA_DIR);
}

// Disable Chromium GPU cache warnings on Windows when necessary
app.commandLine.appendSwitch('disable-color-correct-rendering');

// Enforce single instance lock (bypassed in test environment)
const isTestEnv = process.env.NODE_ENV === 'test';
const gotSingleInstanceLock = isTestEnv ? true : app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  /**
   * Resolves the absolute path to the CommonJS preload bundle.
   * Prioritizes preload.cjs (required for sandboxed Chromium in ESM projects),
   * with robust fallback candidates for packaged ASAR and legacy build targets.
   */
  function resolvePreloadPath(): string {
    const candidates = [
      // 1. Primary: co-located with main.js in dist-electron (dev & unpackaged)
      path.resolve(__dirname, 'preload.cjs'),
      // 2. Packaged ASAR root fallback: app.asar/dist-electron/preload.cjs
      path.resolve(app.getAppPath(), 'dist-electron', 'preload.cjs'),
      // 3. Fallback candidates for compatibility with legacy builds
      path.resolve(__dirname, 'preload.js'),
      path.resolve(app.getAppPath(), 'dist-electron', 'preload.js'),
      path.resolve(__dirname, 'preload.mjs'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    console.warn('[Preload] Warning: Preload script not found among candidates. Defaulting to preload.cjs:', candidates);
    return path.resolve(__dirname, 'preload.cjs');
  }

  async function createMainWindow(): Promise<void> {
    const isDev = !app.isPackaged && !!process.env.VITE_DEV_SERVER_URL;

    // Resolve robust CommonJS preload path
    const preloadPath = resolvePreloadPath();

    if (!fs.existsSync(preloadPath)) {
      console.error(`[Preload Error] Resolved preload script does not exist on disk: ${preloadPath}`);
    }

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
        preload: preloadPath,
        contextIsolation: true,  // Strict context isolation
        nodeIntegration: false,   // Disable Node.js in renderer
        sandbox: true,           // Enforce Chromium sandbox
        webSecurity: true,
        spellcheck: false,
        devTools: isDev || !app.isPackaged
      }
    });

    // Diagnostic listener: capture and log any preload runtime script errors
    mainWindow.webContents.on('preload-error', (_event, scriptPath, error) => {
      console.error(`[Preload Error] Failed to execute preload script at ${scriptPath}:`, error);
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
      if (isDev && navigationUrl.startsWith(process.env.VITE_DEV_SERVER_URL!)) {
        return; // Allow Vite dev server navigation
      }
      try {
        const parsedUrl = new URL(navigationUrl);
        if (!isDev && parsedUrl.protocol === 'file:') {
          return; // Allow local dist assets
        }
      } catch {
        // Invalid URL
      }
      event.preventDefault();
    });

    // Load development server URL or production static HTML
    if (isDev) {
      await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!);
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
      await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
  }

  app.whenReady().then(async () => {
    await createMainWindow();

    // Initialize auto-updater (only active in packaged builds)
    setupAutoUpdater();

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
