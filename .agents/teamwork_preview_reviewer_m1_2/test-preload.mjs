import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const preloadPath = path.resolve(__dirname, '../../dist-electron/preload.js');

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

    win.webContents.on('preload-error', (event, preloadPath, error) => {
      console.error('PRELOAD ERROR:', error);
      app.exit(1);
    });

    win.webContents.on('did-finish-load', async () => {
      const hasElectronAPI = await win.webContents.executeJavaScript('typeof window.electronAPI !== "undefined"');
      console.log('window.electronAPI present:', hasElectronAPI);
      if (hasElectronAPI) {
        console.log('PRELOAD_SUCCESS');
        app.exit(0);
      } else {
        console.error('electronAPI missing');
        app.exit(2);
      }
    });

    const htmlPath = path.resolve(__dirname, '../../dist/index.html');
    await win.loadFile(htmlPath);
  } catch (err) {
    console.error('MAIN ERROR:', err);
    app.exit(3);
  }
});
