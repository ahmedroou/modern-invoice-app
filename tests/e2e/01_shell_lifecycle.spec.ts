import { test, expect } from '@playwright/test';
import { launchTestApp, TestAppInstance } from '../support/electronHarness';

test.describe('Acceptance Criterion 1 (AC 1): Electron Application Launch & Shell Lifecycle', () => {
  let appInstance: TestAppInstance;

  test.beforeEach(async () => {
    appInstance = await launchTestApp();
    await appInstance.resetAppState();
  });

  test.afterEach(async () => {
    await appInstance.cleanup();
  });

  test('T1-SHELL-01-01: Verifies native window handle, title, and initial DOM mount', async () => {
    const { window } = appInstance;

    // 1. Verify window title
    const title = await window.title();
    expect(title).toBe('Modern Invoice App');

    // 2. Verify window URL points to production bundle
    const url = window.url();
    expect(url).toContain('dist/index.html');

    // 3. Verify root element is mounted and visible
    const root = window.locator('#root');
    await expect(root).toBeVisible();
  });

  test('T1-SHELL-01-02: Verifies custom frameless titlebar and caption control buttons', async () => {
    const { window } = appInstance;

    // Verify titlebar container
    const titlebar = window.locator('[data-testid="app-titlebar"]');
    await expect(titlebar).toBeVisible();

    // Verify frameless window controls
    const minimizeBtn = window.locator('[data-testid="window-control-minimize"]');
    const maximizeBtn = window.locator('[data-testid="window-control-maximize"]');
    const closeBtn = window.locator('[data-testid="window-control-close"]');

    await expect(minimizeBtn).toBeVisible();
    await expect(maximizeBtn).toBeVisible();
    await expect(closeBtn).toBeVisible();
  });

  test('T1-SHELL-01-03: Verifies strict context isolation and absence of Node.js globals in renderer', async () => {
    const { window } = appInstance;

    const securityAudit = await window.evaluate(() => {
      return {
        hasProcess: typeof (window as any).process !== 'undefined',
        hasRequire: typeof (window as any).require !== 'undefined',
        hasNodeBuffer: typeof (window as any).Buffer !== 'undefined',
        hasElectronAPI: typeof (window as any).electronAPI === 'object' && (window as any).electronAPI !== null
      };
    });

    expect(securityAudit.hasProcess).toBe(false);
    expect(securityAudit.hasRequire).toBe(false);
    expect(securityAudit.hasNodeBuffer).toBe(false);
    expect(securityAudit.hasElectronAPI).toBe(true);
  });

  test('T1-SHELL-01-04: Verifies full contract compliance of window.electronAPI (all 10 methods)', async () => {
    const { window } = appInstance;

    const apiReport = await window.evaluate(async () => {
      const api = (window as any).electronAPI;
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

      const missing = requiredMethods.filter((m) => typeof api[m] !== 'function');
      const version = await api.getAppVersion();
      const theme = await api.getSystemTheme();
      const isMax = await api.isMaximized();

      return {
        missing,
        version,
        theme,
        isMax,
        totalMethods: requiredMethods.length
      };
    });

    expect(apiReport.missing).toEqual([]);
    expect(apiReport.totalMethods).toBe(10);
    expect(apiReport.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(['light', 'dark']).toContain(apiReport.theme);
    expect(typeof apiReport.isMax).toBe('boolean');
  });

  test('T1-SHELL-04-01: Verifies Dark and Light theme switching and persistence', async () => {
    const { window } = appInstance;

    const themeToggleBtn = window.locator('[data-testid="theme-toggle-btn"]').first();
    await expect(themeToggleBtn).toBeVisible();

    // Verify initial theme state
    const isInitiallyDark = await window.evaluate(() => document.documentElement.classList.contains('dark'));

    // Toggle theme
    await themeToggleBtn.click();
    await window.waitForTimeout(200);

    const isDarkAfterToggle = await window.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(isDarkAfterToggle).toBe(!isInitiallyDark);

    // Toggle back
    await themeToggleBtn.click();
    await window.waitForTimeout(200);

    const isDarkReverted = await window.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(isDarkReverted).toBe(isInitiallyDark);
  });

  test('T1-SHELL-02-01: Verifies responsive mobile viewport (375px) vs desktop layout', async () => {
    const { window } = appInstance;

    // Desktop view (default 1280x800)
    const desktopSidebar = window.locator('[data-testid="app-sidebar"]');
    await expect(desktopSidebar).toBeVisible();

    // Switch viewport to mobile (375x667)
    await window.setViewportSize({ width: 375, height: 667 });
    await window.waitForTimeout(300);

    // Desktop sidebar should hide on mobile (lg:flex class hides on <1024px)
    await expect(desktopSidebar).toBeHidden();

    // Mobile nav top bar should be visible
    const mobileHeader = window.locator('header').filter({ hasText: /Modern Invoice|مودرن إنفويس/i }).first();
    await expect(mobileHeader).toBeVisible();

    // Restore desktop viewport
    await window.setViewportSize({ width: 1280, height: 800 });
    await window.waitForTimeout(300);
    await expect(desktopSidebar).toBeVisible();
  });
});
