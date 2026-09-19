import { app, BrowserWindow } from 'electron';
import path from 'path';

const distDir = path.resolve('.agents/teamwork_preview_explorer_m1_fix_1/test-full-dist/strategy_1_rollup_input');
const preloadPath = path.join(distDir, 'dist-electron/preload.cjs');
const htmlPath = path.join(distDir, 'dist/index.html');

console.log('Testing preloadPath:', preloadPath);
console.log('Testing htmlPath:', htmlPath);

app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      }
    });

    win.webContents.on('preload-error', (event, p, error) => {
      console.error('PRELOAD ERROR:', error);
      app.exit(1);
    });

    win.webContents.on('did-finish-load', async () => {
      const hasElectronAPI = await win.webContents.executeJavaScript('typeof window.electronAPI !== "undefined"');
      const keys = await win.webContents.executeJavaScript('window.electronAPI ? Object.keys(window.electronAPI) : []');
      console.log('window.electronAPI present:', hasElectronAPI);
      console.log('window.electronAPI keys:', keys);

      if (hasElectronAPI && keys.length > 0) {
        console.log('FULL_END_TO_END_SUCCESS');
        app.exit(0);
      } else {
        console.error('FAILED: electronAPI missing or empty');
        app.exit(2);
      }
    });

    await win.loadFile(htmlPath);
  } catch (err) {
    console.error('MAIN ERROR:', err);
    app.exit(3);
  }
});
