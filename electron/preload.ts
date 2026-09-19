import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type { IElectronAPI, PrintInvoiceOptions, ExportDataOptions } from '../src/types/electron';

const electronAPI: IElectronAPI = {
  // Window controls
  minimizeWindow: (): Promise<void> => {
    return ipcRenderer.invoke('window:minimize');
  },

  maximizeWindow: (): Promise<void> => {
    return ipcRenderer.invoke('window:maximize');
  },

  closeWindow: (): Promise<void> => {
    return ipcRenderer.invoke('window:close');
  },

  isMaximized: (): Promise<boolean> => {
    return ipcRenderer.invoke('window:isMaximized');
  },

  // Native desktop capabilities
  printInvoicePDF: (options: PrintInvoiceOptions) => {
    if (!options || typeof options !== 'object') {
      return Promise.reject(new Error('Invalid print options'));
    }
    return ipcRenderer.invoke('invoice:print-pdf', options);
  },

  exportFile: (options: ExportDataOptions) => {
    if (!options || typeof options !== 'object' || !options.format || !options.data) {
      return Promise.reject(new Error('Invalid export options'));
    }
    return ipcRenderer.invoke('file:export', options);
  },

  getAppVersion: (): Promise<string> => {
    return ipcRenderer.invoke('app:version');
  },

  getSystemTheme: (): Promise<'light' | 'dark'> => {
    return ipcRenderer.invoke('app:theme');
  },

  // Event subscriptions
  onThemeChanged: (callback: (theme: 'light' | 'dark') => void): (() => void) => {
    const subscription = (_: IpcRendererEvent, theme: 'light' | 'dark') => callback(theme);
    ipcRenderer.on('theme:changed', subscription);
    return () => {
      ipcRenderer.removeListener('theme:changed', subscription);
    };
  },

  onWindowStateChanged: (callback: (state: { isMaximized: boolean }) => void): (() => void) => {
    const subscription = (_: IpcRendererEvent, state: { isMaximized: boolean }) => callback(state);
    ipcRenderer.on('window:state-changed', subscription);
    return () => {
      ipcRenderer.removeListener('window:state-changed', subscription);
    };
  },

  // ── Auto-Update API ──────────────────────────────────────────────────────────

  checkForUpdates: (): Promise<void> => {
    return ipcRenderer.invoke('update:check');
  },

  downloadUpdate: (): Promise<void> => {
    return ipcRenderer.invoke('update:download');
  },

  installUpdate: (): Promise<void> => {
    return ipcRenderer.invoke('update:install');
  },

  onUpdateState: (callback: (event: { state: string; info?: { version: string; releaseNotes?: string }; error?: string }) => void): (() => void) => {
    const subscription = (_: IpcRendererEvent, event: any) => callback(event);
    ipcRenderer.on('update:state', subscription);
    return () => {
      ipcRenderer.removeListener('update:state', subscription);
    };
  },

  onUpdateProgress: (callback: (progress: { percent: number; transferred: number; total: number }) => void): (() => void) => {
    const subscription = (_: IpcRendererEvent, progress: any) => callback(progress);
    ipcRenderer.on('update:progress', subscription);
    return () => {
      ipcRenderer.removeListener('update:progress', subscription);
    };
  }
};

// Safely expose in main world with context isolation
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
