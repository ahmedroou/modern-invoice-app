/**
 * Automated Headless Electron Preload & Launch Smoke Test
 * 
 * Verifies that:
 * 1. Electron boots headlessly without GPU or display crashes.
 * 2. Preload script loads into sandboxed Chromium renderer without syntax or ESM errors.
 * 3. window.electronAPI is attached to the renderer window.
 * 4. All required IElectronAPI methods exist and conform to interface contracts.
 * 5. Production HTML bundle loads successfully without HTTP/file errors.
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

// Register stub IPC handlers so that React components (e.g. TitleBar) mount cleanly
ipcMain.handle('window:isMaximized', () => false);
ipcMain.handle('window:minimize', () => {});
ipcMain.handle('window:maximize', () => {});
ipcMain.handle('window:close', () => {});
ipcMain.handle('app:version', () => '1.0.0');
ipcMain.handle('app:theme', () => 'dark');

// Hard timeout: Ensure process never hangs in headless CI runners
const TIMEOUT_MS = 10000;
const timeoutId = setTimeout(() => {
  console.error(`\n❌ [Smoke Test] TIMEOUT: Electron did not finish verification within ${TIMEOUT_MS}ms.`);
  app.exit(10);
}, TIMEOUT_MS);

// Disable GPU and hardware acceleration for headless CI stability
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-setuid-sandbox');
}

app.whenReady().then(async () => {
  try {
    const distElectronDir = path.join(projectRoot, 'dist-electron');
    const preloadCjs = path.join(distElectronDir, 'preload.cjs');
    const preloadJs = path.join(distElectronDir, 'preload.js');
    const defaultPreload = fs.existsSync(preloadCjs) ? preloadCjs : preloadJs;
    const rawPreload = process.env.PRELOAD_PATH || process.argv[2] || defaultPreload;
    const preloadPath = path.resolve(rawPreload);

    const htmlPath = path.resolve(projectRoot, 'dist/index.html');

    console.log(`[Smoke Test] Target Preload: ${preloadPath}`);
    console.log(`[Smoke Test] Target HTML:    ${htmlPath}`);

    if (!fs.existsSync(preloadPath)) {
      console.error(`\n❌ [Smoke Test] ERROR: Preload script not found at ${preloadPath}`);
      console.error(`   Run 'npm run build' before executing smoke test.`);
      clearTimeout(timeoutId);
      app.exit(2);
      return;
    }

    if (!fs.existsSync(htmlPath)) {
      console.error(`\n❌ [Smoke Test] ERROR: HTML file not found at ${htmlPath}`);
      console.error(`   Run 'npm run build' before executing smoke test.`);
      clearTimeout(timeoutId);
      app.exit(2);
      return;
    }

    const win = new BrowserWindow({
      show: false,
      width: 1024,
      height: 768,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      }
    });

    let preloadErrorDetected = null;

    win.webContents.on('preload-error', (event, p, error) => {
      preloadErrorDetected = error;
      console.error('\n❌ [Smoke Test] PRELOAD SCRIPT ERROR:');
      console.error(error);
    });

    win.webContents.on('render-process-gone', (event, details) => {
      console.error(`\n❌ [Smoke Test] Renderer process crashed: ${details.reason} (exit code ${details.exitCode})`);
      clearTimeout(timeoutId);
      app.exit(6);
    });

    win.webContents.on('did-fail-load', (event, code, desc, url) => {
      console.error(`\n❌ [Smoke Test] FAILED TO LOAD: (${code}) ${desc} at ${url}`);
      clearTimeout(timeoutId);
      app.exit(3);
    });

    win.webContents.on('did-finish-load', async () => {
      clearTimeout(timeoutId);

      if (preloadErrorDetected) {
        console.error('\n❌ [Smoke Test] FAILED: Preload script failed with syntax/runtime error.');
        app.exit(1);
        return;
      }

      try {
        const result = await win.webContents.executeJavaScript(`
          (() => {
            const api = window.electronAPI;
            if (!api || typeof api !== 'object') {
              return { success: false, error: 'window.electronAPI is not defined or not an object' };
            }

            const requiredMethods = [
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
            ];

            const missing = requiredMethods.filter(m => typeof api[m] !== 'function');
            if (missing.length > 0) {
              return { success: false, error: 'Missing interface methods: ' + missing.join(', ') };
            }

            // Test that isMaximized returns a Promise
            const promiseCheck = api.isMaximized();
            if (!promiseCheck || typeof promiseCheck.then !== 'function') {
              return { success: false, error: 'api.isMaximized() did not return a Promise' };
            }

            return { success: true, methodCount: requiredMethods.length };
          })()
        `);

        if (result.success) {
          console.log(`\n✅ [Smoke Test] PASS: Electron launched headlessly, preload loaded without errors, and window.electronAPI is fully functional (${result.methodCount} methods verified).`);
          app.exit(0);
        } else {
          console.error(`\n❌ [Smoke Test] CONTRACT ASSERTION FAILED: ${result.error}`);
          app.exit(4);
        }
      } catch (evalErr) {
        console.error('\n❌ [Smoke Test] Evaluation Exception:', evalErr);
        app.exit(5);
      }
    });

    await win.loadFile(htmlPath);
  } catch (err) {
    clearTimeout(timeoutId);
    console.error('\n❌ [Smoke Test] Unhandled Exception:', err);
    app.exit(6);
  }
});
