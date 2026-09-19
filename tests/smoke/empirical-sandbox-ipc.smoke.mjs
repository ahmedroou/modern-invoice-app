/**
 * Empirical Challenger Test Harness: Sandboxed Preload & IPC Verification
 * 
 * Verifies:
 * 1. dist-electron/preload.cjs syntax analysis (pure CJS, 0 import statements, require('electron')).
 * 2. Headless Chromium execution with sandbox: true, contextIsolation: true, nodeIntegration: false.
 * 3. Actual IPC invocations across contextBridge:
 *    - minimizeWindow()
 *    - maximizeWindow()
 *    - closeWindow()
 *    - isMaximized()
 *    - getAppVersion()
 *    - getSystemTheme()
 *    - printInvoicePDF() parameter validation & IPC dispatch
 *    - exportFile() parameter validation & IPC dispatch
 *    - onThemeChanged() event subscription & unsubscriber cleanup
 *    - onWindowStateChanged() event subscription & unsubscriber cleanup
 * 4. Sandbox security isolation:
 *    - window.require is undefined
 *    - window.process is undefined or lacks process.versions.node
 *    - window.ipcRenderer is undefined (not leaked)
 */

import electron from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

if (!process.versions.electron) {
  const electronBinary = typeof electron === 'string' ? electron : 'electron';
  const child = spawn(electronBinary, [__filename, ...process.argv.slice(2)], {
    stdio: 'inherit',
    windowsHide: true,
    env: { ...process.env }
  });

  child.on('error', (err) => {
    console.error('[Challenger] Failed to spawn Electron process:', err);
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    process.exit(code ?? (signal ? 1 : 0));
  });
} else {
  const { app, BrowserWindow, ipcMain } = electron;

  // Track IPC handler calls
  const ipcTracker = {
    minimizeCalled: 0,
    maximizeCalled: 0,
    closeCalled: 0,
    isMaximizedCalled: 0,
    appVersionCalled: 0,
    appThemeCalled: 0,
    printPdfPayload: null,
    exportFilePayload: null
  };

  // Register main IPC handlers for tests
  ipcMain.handle('window:minimize', () => {
    ipcTracker.minimizeCalled++;
    return undefined;
  });

  ipcMain.handle('window:maximize', () => {
    ipcTracker.maximizeCalled++;
    return undefined;
  });

  ipcMain.handle('window:close', () => {
    ipcTracker.closeCalled++;
    return undefined;
  });

  ipcMain.handle('window:isMaximized', () => {
    ipcTracker.isMaximizedCalled++;
    return true; // Return true to test value propagation
  });

  ipcMain.handle('app:version', () => {
    ipcTracker.appVersionCalled++;
    return '1.0.0-empirical-test';
  });

  ipcMain.handle('app:theme', () => {
    ipcTracker.appThemeCalled++;
    return 'dark';
  });

  ipcMain.handle('invoice:print-pdf', (_, options) => {
    ipcTracker.printPdfPayload = options;
    return { success: true, filePath: 'C:/mock/test-invoice.pdf' };
  });

  ipcMain.handle('file:export', (_, options) => {
    ipcTracker.exportFilePayload = options;
    return { success: true, filePath: 'C:/mock/test-export.csv' };
  });

  const TIMEOUT_MS = 15000;
  const timeoutTimer = setTimeout(() => {
    console.error(`\n❌ [Challenger] TIMEOUT after ${TIMEOUT_MS}ms`);
    app.exit(99);
  }, TIMEOUT_MS);

  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-software-rasterizer');

  app.whenReady().then(async () => {
    console.log('===========================================================');
    console.log('  CHALLENGER EMPIRICAL ELECTRON SANDBOX & IPC TEST HARNESS ');
    console.log('===========================================================');

    // 1. Static bundle inspection
    const preloadPath = path.resolve(projectRoot, 'dist-electron/preload.cjs');
    console.log(`[Challenger] Checking bundle path: ${preloadPath}`);

    if (!fs.existsSync(preloadPath)) {
      console.error(`❌ [Challenger] Bundle does not exist: ${preloadPath}`);
      clearTimeout(timeoutTimer);
      app.exit(1);
      return;
    }

    const bundleContent = fs.readFileSync(preloadPath, 'utf8');
    console.log(`[Challenger] Bundle size: ${bundleContent.length} bytes`);

    // Check for require('electron')
    const hasRequire = bundleContent.includes('require("electron")') || bundleContent.includes("require('electron')");
    // Check for any occurrence of 'import'
    const importCount = (bundleContent.match(/\bimport\b/g) || []).length;

    // Classic script parse test: vm.Script parses as standard script (non-module).
    // Any ES module import/export declarations will throw SyntaxError.
    let scriptParsePass = false;
    try {
      const vm = await import('vm');
      new vm.Script(bundleContent);
      scriptParsePass = true;
    } catch (parseErr) {
      console.error('[Challenger] vm.Script parse error:', parseErr);
    }

    console.log(`[Challenger] Static check: require("electron"): ${hasRequire}`);
    console.log(`[Challenger] Static check: import occurrences: ${importCount} (expected: 0)`);
    console.log(`[Challenger] Static check: vm.Script CommonJS syntax valid: ${scriptParsePass}`);

    if (!hasRequire || importCount > 0 || !scriptParsePass) {
      console.error('❌ [Challenger] Bundle failed static CommonJS compliance check!');
      clearTimeout(timeoutTimer);
      app.exit(2);
      return;
    }

    // 2. Launch sandboxed window
    const htmlPath = path.resolve(projectRoot, 'dist/index.html');
    const win = new BrowserWindow({
      show: false,
      width: 800,
      height: 600,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true
      }
    });

    let preloadErr = null;
    win.webContents.on('preload-error', (_e, _p, err) => {
      preloadErr = err;
      console.error('❌ [Challenger] PRELOAD ERROR IN RUNTIME:', err);
    });

    win.webContents.on('did-finish-load', async () => {
      clearTimeout(timeoutTimer);

      if (preloadErr) {
        console.error('❌ [Challenger] Preload threw an error during evaluation.');
        app.exit(3);
        return;
      }

      console.log('✅ [Challenger] Page loaded and preload evaluated cleanly.');

      // 3. Execute comprehensive in-renderer assertions
      try {
        const testResults = await win.webContents.executeJavaScript(`
          (async () => {
            const results = [];
            function assert(condition, message) {
              if (!condition) {
                throw new Error(message);
              }
              results.push('PASS: ' + message);
            }

            // Test 1: Security Isolation
            assert(typeof window.electronAPI === 'object' && window.electronAPI !== null, 'window.electronAPI exists');
            assert(typeof window.require === 'undefined', 'window.require is undefined (nodeIntegration disabled)');
            assert(typeof window.process === 'undefined' || !window.process.versions || !window.process.versions.node, 'Node.js process object not leaked');
            assert(typeof window.ipcRenderer === 'undefined', 'ipcRenderer is not leaked to global window');

            const api = window.electronAPI;

            // Test 2: Invocations - minimizeWindow
            const minRes = await api.minimizeWindow();
            assert(minRes === undefined, 'minimizeWindow() resolved without error');

            // Test 3: Invocations - maximizeWindow
            const maxRes = await api.maximizeWindow();
            assert(maxRes === undefined, 'maximizeWindow() resolved without error');

            // Test 4: Invocations - closeWindow
            const closeRes = await api.closeWindow();
            assert(closeRes === undefined, 'closeWindow() resolved without error');

            // Test 5: Invocations - isMaximized
            const isMax = await api.isMaximized();
            assert(isMax === true, 'isMaximized() returned boolean true from IPC handler');

            // Test 6: Invocations - getAppVersion
            const version = await api.getAppVersion();
            assert(version === '1.0.0-empirical-test', 'getAppVersion() returned version string: ' + version);

            // Test 7: Invocations - getSystemTheme
            const theme = await api.getSystemTheme();
            assert(theme === 'dark', 'getSystemTheme() returned theme string: ' + theme);

            // Test 8: printInvoicePDF validation & IPC
            let printErrCaught = false;
            try {
              await api.printInvoicePDF(null);
            } catch (e) {
              printErrCaught = true;
            }
            assert(printErrCaught, 'printInvoicePDF(null) correctly rejected invalid options');

            const printSuccess = await api.printInvoicePDF({ invoiceId: 'test-123', invoiceNumber: 'INV-001' });
            assert(printSuccess && printSuccess.success === true, 'printInvoicePDF(valid) succeeded: ' + JSON.stringify(printSuccess));

            // Test 9: exportFile validation & IPC
            let exportErrCaught = false;
            try {
              await api.exportFile({ format: 'csv' }); // missing data
            } catch (e) {
              exportErrCaught = true;
            }
            assert(exportErrCaught, 'exportFile(missing data) correctly rejected invalid options');

            const exportSuccess = await api.exportFile({ format: 'csv', data: 'a,b,c', suggestedFilename: 'test.csv' });
            assert(exportSuccess && exportSuccess.success === true, 'exportFile(valid) succeeded');

            // Test 10: Event listeners registration and cleanup
            const unsubscribeTheme = api.onThemeChanged(() => {});
            assert(typeof unsubscribeTheme === 'function', 'onThemeChanged returned unsubscribe function');
            unsubscribeTheme();

            const unsubscribeState = api.onWindowStateChanged(() => {});
            assert(typeof unsubscribeState === 'function', 'onWindowStateChanged returned unsubscribe function');
            unsubscribeState();

            // Test 11: Stress concurrency - invoke isMaximized and getAppVersion 20 times in parallel
            const parallelCalls = await Promise.all(
              Array.from({ length: 20 }, (_, i) => i % 2 === 0 ? api.isMaximized() : api.getAppVersion())
            );
            assert(parallelCalls.length === 20, '20 parallel IPC invocations completed successfully without race conditions');

            return { success: true, logs: results };
          })()
        `);

        testResults.logs.forEach(log => console.log('  ' + log));

        // 4. Verify main process IPC received each invocation
        console.log('\n[Challenger] Main process IPC receipt verification:');
        console.log(`  minimizeCalled: ${ipcTracker.minimizeCalled} (expected: 1)`);
        console.log(`  maximizeCalled: ${ipcTracker.maximizeCalled} (expected: 1)`);
        console.log(`  closeCalled: ${ipcTracker.closeCalled} (expected: 1)`);
        console.log(`  isMaximizedCalled: ${ipcTracker.isMaximizedCalled} (expected: >= 11)`);
        console.log(`  appVersionCalled: ${ipcTracker.appVersionCalled} (expected: >= 11)`);
        console.log(`  appThemeCalled: ${ipcTracker.appThemeCalled} (expected: 1)`);
        console.log(`  printPdfPayload: ${JSON.stringify(ipcTracker.printPdfPayload)}`);
        console.log(`  exportFilePayload: ${JSON.stringify(ipcTracker.exportFilePayload)}`);

        if (
          ipcTracker.minimizeCalled === 1 &&
          ipcTracker.maximizeCalled === 1 &&
          ipcTracker.closeCalled === 1 &&
          ipcTracker.isMaximizedCalled >= 11 &&
          ipcTracker.appVersionCalled >= 11 &&
          ipcTracker.appThemeCalled === 1 &&
          ipcTracker.printPdfPayload?.invoiceId === 'test-123' &&
          ipcTracker.exportFilePayload?.format === 'csv'
        ) {
          console.log('\n===========================================================');
          console.log('✅ ALL CHALLENGER EMPIRICAL IPC CHECKS PASSED PERFECTLY!');
          console.log('===========================================================');
          app.exit(0);
        } else {
          console.error('\n❌ Main process IPC call tracker verification failed!');
          app.exit(5);
        }
      } catch (err) {
        console.error('❌ [Challenger] In-renderer assertion failed:', err);
        app.exit(4);
      }
    });

    await win.loadFile(htmlPath);
  });
}
