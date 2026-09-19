"use strict";
const electron = require("electron");
const electronAPI = {
  // Window controls
  minimizeWindow: () => {
    return electron.ipcRenderer.invoke("window:minimize");
  },
  maximizeWindow: () => {
    return electron.ipcRenderer.invoke("window:maximize");
  },
  closeWindow: () => {
    return electron.ipcRenderer.invoke("window:close");
  },
  isMaximized: () => {
    return electron.ipcRenderer.invoke("window:isMaximized");
  },
  // Native desktop capabilities
  printInvoicePDF: (options) => {
    if (!options || typeof options !== "object") {
      return Promise.reject(new Error("Invalid print options"));
    }
    return electron.ipcRenderer.invoke("invoice:print-pdf", options);
  },
  exportFile: (options) => {
    if (!options || typeof options !== "object" || !options.format || !options.data) {
      return Promise.reject(new Error("Invalid export options"));
    }
    return electron.ipcRenderer.invoke("file:export", options);
  },
  getAppVersion: () => {
    return electron.ipcRenderer.invoke("app:version");
  },
  getSystemTheme: () => {
    return electron.ipcRenderer.invoke("app:theme");
  },
  // Event subscriptions
  onThemeChanged: (callback) => {
    const subscription = (_, theme) => callback(theme);
    electron.ipcRenderer.on("theme:changed", subscription);
    return () => {
      electron.ipcRenderer.removeListener("theme:changed", subscription);
    };
  },
  onWindowStateChanged: (callback) => {
    const subscription = (_, state) => callback(state);
    electron.ipcRenderer.on("window:state-changed", subscription);
    return () => {
      electron.ipcRenderer.removeListener("window:state-changed", subscription);
    };
  }
};
electron.contextBridge.exposeInMainWorld("electronAPI", electronAPI);
