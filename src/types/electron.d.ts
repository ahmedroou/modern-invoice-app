export interface PrintInvoiceOptions {
  invoiceId: string;
  invoiceNumber: string;
  htmlContent?: string;
}

export interface ExportDataOptions {
  format: 'json' | 'csv';
  data: string;
  suggestedFilename: string;
}

export interface UpdateInfo {
  version: string;
  releaseNotes?: string;
}

export interface UpdateProgressInfo {
  percent: number;
  transferred: number;
  total: number;
}

export interface UpdateStateEvent {
  state: string;
  info?: UpdateInfo;
  error?: string;
}

export interface IElectronAPI {
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  printInvoicePDF: (options: PrintInvoiceOptions) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  exportFile: (options: ExportDataOptions) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  getAppVersion: () => Promise<string>;
  getSystemTheme: () => Promise<'light' | 'dark'>;
  onThemeChanged: (callback: (theme: 'light' | 'dark') => void) => () => void;
  onWindowStateChanged?: (callback: (state: { isMaximized: boolean }) => void) => () => void;
  // Auto-updater
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  onUpdateState: (callback: (event: UpdateStateEvent) => void) => () => void;
  onUpdateProgress: (callback: (progress: UpdateProgressInfo) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: IElectronAPI;
  }
}
