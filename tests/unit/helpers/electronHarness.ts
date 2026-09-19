import { vi } from 'vitest';
import type { IElectronAPI, PrintInvoiceOptions, ExportDataOptions } from '@/types/electron';

/**
 * Harness mimicking the logic inside electron/preload.ts
 */
export function registerPreloadHarness(ipcRenderer: any): IElectronAPI {
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
      const subscription = (_: any, theme: 'light' | 'dark') => callback(theme);
      ipcRenderer.on('theme:changed', subscription);
      return () => {
        ipcRenderer.removeListener('theme:changed', subscription);
      };
    },

    onWindowStateChanged: (callback: (state: { isMaximized: boolean }) => void): (() => void) => {
      const subscription = (_: any, state: { isMaximized: boolean }) => callback(state);
      ipcRenderer.on('window:state-changed', subscription);
      return () => {
        ipcRenderer.removeListener('window:state-changed', subscription);
      };
    },

    // Auto-updater stubs (no-ops in unit test environment)
    checkForUpdates: (): Promise<void> => Promise.resolve(),
    downloadUpdate: (): Promise<void> => Promise.resolve(),
    installUpdate: (): Promise<void> => Promise.resolve(),
    getUpdateState: (): Promise<any> => Promise.resolve({ state: 'idle' }),
    onUpdateState: (_callback: any): (() => void) => () => {},
    onUpdateProgress: (_callback: any): (() => void) => () => {},
  };

  return electronAPI;
}

/**
 * Harness mimicking the handlers registration inside electron/ipcHandlers.ts
 */
export function registerIPCHandlersHarness() {
  const handlers: Record<string, Function> = {};
  const mockIpcMain = {
    handle: (channel: string, listener: Function) => {
      handlers[channel] = listener;
    }
  };

  const mockWindow = {
    isDestroyed: vi.fn().mockReturnValue(false),
    minimize: vi.fn(),
    maximize: vi.fn(),
    unmaximize: vi.fn(),
    close: vi.fn(),
    isMaximized: vi.fn().mockReturnValue(false)
  };

  // Replicate registration logic from electron/ipcHandlers.ts
  mockIpcMain.handle('window:minimize', () => {
    if (!mockWindow.isDestroyed()) {
      mockWindow.minimize();
    }
  });

  mockIpcMain.handle('window:maximize', () => {
    if (!mockWindow.isDestroyed()) {
      if (mockWindow.isMaximized()) {
        mockWindow.unmaximize();
      } else {
        mockWindow.maximize();
      }
    }
  });

  mockIpcMain.handle('window:close', () => {
    if (!mockWindow.isDestroyed()) {
      mockWindow.close();
    }
  });

  mockIpcMain.handle('window:isMaximized', () => {
    if (!mockWindow.isDestroyed()) {
      return mockWindow.isMaximized();
    }
    return false;
  });

  mockIpcMain.handle('app:version', () => {
    return '1.0.0';
  });

  mockIpcMain.handle('app:theme', () => {
    return 'dark';
  });

  mockIpcMain.handle('invoice:print-pdf', async (_: any, _options: PrintInvoiceOptions) => {
    return { success: true, filePath: 'C:/test.pdf' };
  });

  mockIpcMain.handle('file:export', async (_: any, _options: ExportDataOptions) => {
    return { success: true, filePath: 'C:/export.csv' };
  });

  return { handlers, mockWindow };
}
