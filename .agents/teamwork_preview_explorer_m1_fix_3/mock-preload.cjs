const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  printInvoicePDF: (opt) => ipcRenderer.invoke('invoice:print-pdf', opt),
  exportFile: (opt) => ipcRenderer.invoke('file:export', opt),
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  getSystemTheme: () => ipcRenderer.invoke('app:theme'),
  onThemeChanged: (cb) => () => {},
  onWindowStateChanged: (cb) => () => {}
});
