import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testCjsPreload = path.resolve(__dirname, 'test-preload.cjs');
const htmlPath = path.resolve(__dirname, '../../dist/index.html');

app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: testCjsPreload,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      }
    });

    win.webContents.on('preload-error', (event, preloadPath, error) => {
      console.error('PRELOAD ERROR:', error);
      app.exit(1);
    });

    win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('FAIL LOAD:', errorCode, errorDescription, validatedURL);
      app.exit(2);
    });

    win.webContents.on('did-finish-load', async () => {
      console.log('INDEX_HTML_LOAD_SUCCESS');
      app.exit(0);
    });

    await win.loadFile(htmlPath);
  } catch (err) {
    console.error('MAIN ERROR:', err);
    app.exit(3);
  }
});
