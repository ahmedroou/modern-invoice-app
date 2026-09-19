import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

test.describe('Electron Shell & Preload Integration Smoke Test', () => {
  let electronApp: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    electronApp = await electron.launch({
      args: [path.join(projectRoot, 'dist-electron/main.js')],
      env: {
        ...process.env,
        NODE_ENV: 'production'
      }
    });

    page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('F-SHELL-01: Main window boots and loads production HTML', async () => {
    const title = await page.title();
    expect(title).toBe('Modern Invoice App');
  });

  test('F-SHELL-01: window.electronAPI is attached with full IElectronAPI contract', async () => {
    const apiCheck = await page.evaluate(() => {
      const api = (window as any).electronAPI;
      if (!api || typeof api !== 'object') {
        return { exists: false, methods: [] };
      }
      return {
        exists: true,
        methods: Object.keys(api).filter(k => typeof api[k] === 'function')
      };
    });

    expect(apiCheck.exists).toBe(true);

    const requiredMethods = [
      'minimizeWindow',
      'maximizeWindow',
      'closeWindow',
      'isMaximized',
      'printInvoicePDF',
      'exportFile',
      'getAppVersion',
      'getSystemTheme',
      'onThemeChanged',
      'onWindowStateChanged'
    ];

    expect(apiCheck.methods).toEqual(expect.arrayContaining(requiredMethods));
  });

  test('F-SHELL-01: Frameless TitleBar renders caption controls when electronAPI is active', async () => {
    // Under TitleBar.tsx: showControls && isElectron reveals caption controls
    const minimizeBtn = page.locator('[data-testid="window-control-minimize"]');
    const maximizeBtn = page.locator('[data-testid="window-control-maximize"]');
    const closeBtn = page.locator('[data-testid="window-control-close"]');

    await expect(minimizeBtn).toBeVisible();
    await expect(maximizeBtn).toBeVisible();
    await expect(closeBtn).toBeVisible();
  });
});
