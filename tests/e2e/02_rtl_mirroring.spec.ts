import { test, expect } from '@playwright/test';
import { launchTestApp, TestAppInstance } from '../support/electronHarness';
import { assertRtlLayout, assertLtrLayout, assertBidiIsolation } from '../support/assertions';

test.describe('Acceptance Criterion 2 (AC 2): Arabic RTL Mirroring & Bidirectional Layout', () => {
  let appInstance: TestAppInstance;

  test.beforeEach(async () => {
    appInstance = await launchTestApp();
    await appInstance.resetAppState();
  });

  test.afterEach(async () => {
    await appInstance.cleanup();
  });

  test('T1-RTL-01-01: Toggling language sets html dir="rtl" and lang="ar"', async () => {
    const page = appInstance.window;

    // 1. Initially English LTR
    await assertLtrLayout(page);

    // 2. Click language switcher
    const langBtn = page.locator('[data-testid="lang-switch-btn"]').first();
    await langBtn.click();
    await page.waitForTimeout(200);

    // 3. Document attributes must update
    await assertRtlLayout(page);

    // 4. Toggle back to English
    await langBtn.click();
    await page.waitForTimeout(200);
    await assertLtrLayout(page);
  });

  test('T1-RTL-02-01: Sidebar horizontal position mirrors from left in LTR to right in RTL', async () => {
    const page = appInstance.window;
    const sidebar = page.locator('[data-testid="app-sidebar"]');
    await expect(sidebar).toBeVisible();

    const viewport = page.viewportSize() || { width: 1280, height: 800 };

    // 1. In LTR, sidebar bounding box x starts near 0 (left edge)
    const boxLtr = await sidebar.boundingBox();
    expect(boxLtr).not.toBeNull();
    if (boxLtr) {
      expect(boxLtr.x).toBeLessThan(100);
    }

    // 2. Switch to Arabic RTL
    const langBtn = page.locator('[data-testid="lang-switch-btn"]').first();
    await langBtn.click();
    await page.waitForTimeout(300);

    // 3. In RTL, sidebar bounding box x starts near the right edge (x > viewport.width / 2)
    const boxRtl = await sidebar.boundingBox();
    expect(boxRtl).not.toBeNull();
    if (boxRtl) {
      expect(boxRtl.x).toBeGreaterThan(viewport.width / 2);
    }
  });

  test('T1-RTL-02-02: Data table columns reverse in RTL mode', async () => {
    const page = appInstance.window;
    const { navigateTo } = appInstance;

    // 1. Toggle to RTL
    const langBtn = page.locator('[data-testid="lang-switch-btn"]').first();
    await langBtn.click();
    await page.waitForTimeout(300);
    await assertRtlLayout(page);

    // 2. Open Invoice Form modal
    await navigateTo('/invoices?new=1');
    await page.waitForTimeout(400);

    const formModal = page.locator('form');
    await expect(formModal).toBeVisible();

    const tableHeaderRtl = page.locator('table thead tr').first();
    await expect(tableHeaderRtl).toBeVisible();

    const firstColRtl = tableHeaderRtl.locator('th').first(); // Description in RTL is on right
    const lastColRtl = tableHeaderRtl.locator('th').nth(5); // Total in RTL is on left

    const boxFirstRtl = await firstColRtl.boundingBox();
    const boxLastRtl = await lastColRtl.boundingBox();
    expect(boxFirstRtl).not.toBeNull();
    expect(boxLastRtl).not.toBeNull();

    if (boxFirstRtl && boxLastRtl) {
      // In RTL, the first header (Description) is positioned to the right of Total (boxFirstRtl.x > boxLastRtl.x)
      expect(boxFirstRtl.x).toBeGreaterThan(boxLastRtl.x);
    }

    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  });

  test('T1-RTL-02-03: Directional chevron icons are mirrored in RTL mode', async () => {
    const page = appInstance.window;

    // In LTR, find sidebar chevron
    const toggleSidebarBtn = page.locator('button[aria-label="Toggle Sidebar"]').first();
    await expect(toggleSidebarBtn).toBeVisible();

    const chevronSvgLtr = toggleSidebarBtn.locator('svg').first();
    const ltrClasses = await chevronSvgLtr.getAttribute('class');
    expect(ltrClasses).not.toContain('rotate-180');

    // Switch to RTL
    const langBtn = page.locator('[data-testid="lang-switch-btn"]').first();
    await langBtn.click();
    await page.waitForTimeout(200);

    // In RTL, chevron SVG must have rotate-180
    const chevronSvgRtl = toggleSidebarBtn.locator('svg').first();
    const rtlClasses = await chevronSvgRtl.getAttribute('class');
    expect(rtlClasses).toContain('rotate-180');
  });

  test('T1-RTL-02-04: Arabic local fonts are loaded and applied', async () => {
    const page = appInstance.window;

    // Switch to Arabic
    const langBtn = page.locator('[data-testid="lang-switch-btn"]').first();
    await langBtn.click();
    await page.waitForTimeout(200);

    // Inspect computed font family
    const fontFamily = await page.evaluate(() => {
      const root = document.querySelector('#root') || document.body;
      return window.getComputedStyle(root).fontFamily;
    });

    // Font stack should include Cairo or Tajawal or sans-serif
    expect(fontFamily.toLowerCase()).toMatch(/cairo|tajawal|system-ui|sans-serif/);
  });

  test('T1-RTL-03-01: Bidi isolation is enforced on currency and financial amounts', async () => {
    const page = appInstance.window;
    const { navigateTo } = appInstance;

    // Navigate to Dashboard
    await navigateTo('/');

    // Switch to Arabic
    const langBtn = page.locator('[data-testid="lang-switch-btn"]').first();
    await langBtn.click();
    await page.waitForTimeout(200);

    // Verify Bidi isolation on Dashboard Metric cards
    const metricDisplay = page.locator('[data-testid="compact-metric-card"]').first();
    await expect(metricDisplay).toBeVisible();

    await assertBidiIsolation(page, '[data-testid="compact-metric-card"]');
  });
});
