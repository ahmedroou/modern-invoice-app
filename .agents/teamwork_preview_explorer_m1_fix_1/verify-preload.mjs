import { app, BrowserWindow } from 'electron';
import path from 'path';

const preloadArg = process.argv[2];
if (!preloadArg) {
  console.error('No preload arg provided');
  app.exit(1);
}

const resolvedPreload = path.resolve(preloadArg);
console.log('Testing preload:', resolvedPreload);

app.whenReady().then(() => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: resolvedPreload,
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
    try {
      const hasAPI = await win.webContents.executeJavaScript('typeof window.electronAPI !== "undefined"');
      console.log('window.electronAPI present:', hasAPI);
      if (hasAPI) {
        console.log('TEST PASSED');
        app.exit(0);
      } else {
        console.error('TEST FAILED: electronAPI undefined');
        app.exit(2);
      }
    } catch (e) {
      console.error('EXECUTE JS ERROR:', e);
      app.exit(3);
    }
  });

  win.loadURL('data:text/html,<html><body><h1>Test</h1></body></html>');
});
