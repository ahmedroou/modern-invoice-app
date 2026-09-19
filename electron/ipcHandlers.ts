import { ipcMain, BrowserWindow, dialog, app, nativeTheme } from 'electron';
import fs from 'fs/promises';
import type { PrintInvoiceOptions, ExportDataOptions } from '../src/types/electron';

export function registerIPCHandlers(mainWindow: BrowserWindow): void {
  // 1. Window Controls
  ipcMain.handle('window:minimize', () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.minimize();
    }
  });

  ipcMain.handle('window:maximize', () => {
    if (!mainWindow.isDestroyed()) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.handle('window:close', () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.close();
    }
  });

  ipcMain.handle('window:isMaximized', () => {
    if (!mainWindow.isDestroyed()) {
      return mainWindow.isMaximized();
    }
    return false;
  });

  // 2. Application Info & System State
  ipcMain.handle('app:version', () => {
    return app.getVersion();
  });

  ipcMain.handle('app:theme', () => {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  });

  // 3. Native PDF Printing
  ipcMain.handle('invoice:print-pdf', async (_, options: PrintInvoiceOptions) => {
    try {
      const sanitizedNumber = (options.invoiceNumber || options.invoiceId || 'document').replace(/[^a-zA-Z0-9-_]/g, '_');

      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Invoice PDF',
        defaultPath: `Invoice-${sanitizedNumber}.pdf`,
        filters: [{ name: 'PDF Documents', extensions: ['pdf'] }]
      });

      if (canceled || !filePath) {
        return { success: false, error: 'User cancelled save dialog' };
      }

      let pdfBuffer: Buffer;

      if (options.htmlContent) {
        // Offscreen hidden window rendering for dedicated invoice templates
        const printWindow = new BrowserWindow({
          show: false,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true
          }
        });

        await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(options.htmlContent)}`);

        const uint8Array = await printWindow.webContents.printToPDF({
          printBackground: true,
          margins: {
            top: 0.4,
            bottom: 0.4,
            left: 0.4,
            right: 0.4
          },
          pageSize: 'A4',
          landscape: false,
          preferCSSPageSize: true
        });

        pdfBuffer = Buffer.from(uint8Array);
        printWindow.destroy();
      } else {
        // Direct print of current window contents
        const uint8Array = await mainWindow.webContents.printToPDF({
          printBackground: true,
          margins: {
            top: 0.4,
            bottom: 0.4,
            left: 0.4,
            right: 0.4
          },
          pageSize: 'A4'
        });
        pdfBuffer = Buffer.from(uint8Array);
      }

      await fs.writeFile(filePath, pdfBuffer);
      return { success: true, filePath };
    } catch (err: any) {
      console.error('Failed to generate invoice PDF:', err);
      return { success: false, error: err?.message || 'Unknown PDF generation error' };
    }
  });

  // 4. Native File Export (CSV / JSON)
  ipcMain.handle('file:export', async (_, options: ExportDataOptions) => {
    try {
      const ext = options.format === 'csv' ? 'csv' : 'json';
      const filterName = options.format === 'csv' ? 'CSV (Comma delimited)' : 'JSON Document';
      const defaultFilename = options.suggestedFilename || `export.${ext}`;

      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: `Export ${options.format.toUpperCase()} Data`,
        defaultPath: defaultFilename,
        filters: [{ name: filterName, extensions: [ext] }]
      });

      if (canceled || !filePath) {
        return { success: false, error: 'User cancelled export' };
      }

      await fs.writeFile(filePath, options.data, 'utf-8');
      return { success: true, filePath };
    } catch (err: any) {
      console.error('Failed to export file:', err);
      return { success: false, error: err?.message || 'Unknown export error' };
    }
  });
}
