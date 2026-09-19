var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
import { contextBridge, ipcRenderer } from "electron";
var require_preload = __commonJS({
  "preload.cjs"() {
    const electronAPI = {
      // Window controls
      minimizeWindow: () => {
        return ipcRenderer.invoke("window:minimize");
      },
      maximizeWindow: () => {
        return ipcRenderer.invoke("window:maximize");
      },
      closeWindow: () => {
        return ipcRenderer.invoke("window:close");
      },
      isMaximized: () => {
        return ipcRenderer.invoke("window:isMaximized");
      },
      // Native desktop capabilities
      printInvoicePDF: (options) => {
        if (!options || typeof options !== "object") {
          return Promise.reject(new Error("Invalid print options"));
        }
        return ipcRenderer.invoke("invoice:print-pdf", options);
      },
      exportFile: (options) => {
        if (!options || typeof options !== "object" || !options.format || !options.data) {
          return Promise.reject(new Error("Invalid export options"));
        }
        return ipcRenderer.invoke("file:export", options);
      },
      getAppVersion: () => {
        return ipcRenderer.invoke("app:version");
      },
      getSystemTheme: () => {
        return ipcRenderer.invoke("app:theme");
      },
      // Event subscriptions
      onThemeChanged: (callback) => {
        const subscription = (_, theme) => callback(theme);
        ipcRenderer.on("theme:changed", subscription);
        return () => {
          ipcRenderer.removeListener("theme:changed", subscription);
        };
      },
      onWindowStateChanged: (callback) => {
        const subscription = (_, state) => callback(state);
        ipcRenderer.on("window:state-changed", subscription);
        return () => {
          ipcRenderer.removeListener("window:state-changed", subscription);
        };
      }
    };
    contextBridge.exposeInMainWorld("electronAPI", electronAPI);
  }
});
export default require_preload();
