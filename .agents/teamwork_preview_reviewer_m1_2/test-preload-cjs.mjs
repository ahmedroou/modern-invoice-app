import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testCjsPreload = path.resolve(__dirname, 'test-preload.cjs');

// Write a simple CJS version of the preload script
fs.writeFileSync(testCjsPreload, `
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized')
});
`);

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

    win.webContents.on('did-finish-load', async () => {
      const hasElectronAPI = await win.webContents.executeJavaScript('typeof window.electronAPI !== "undefined"');
      console.log('window.electronAPI present:', hasElectronAPI);
      if (hasElectronAPI) {
        console.log('PRELOAD_CJS_SUCCESS');
        app.exit(0);
      } else {
        console.error('electronAPI missing');
        app.exit(2);
      }
    });

    await win.loadURL('data:text/html,<html><body><h1>Test</h1></body></html>');
  } catch (err) {
    console.error('MAIN ERROR:', err);
    app.exit(3);
  }
});
