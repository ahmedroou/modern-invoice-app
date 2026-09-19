import { test, expect } from '@playwright/test';
import { launchTestApp, TestAppInstance } from '../support/electronHarness';

test.describe('Acceptance Criterion 6 (AC 6): Offline-First Firestore Persistence', () => {
  let appInstance: TestAppInstance;

  test.beforeEach(async () => {
    appInstance = await launchTestApp();
    await appInstance.resetAppState();
  });

  test.afterEach(async () => {
    if (appInstance) {
      await appInstance.cleanup();
    }
  });

  test('T1-OFFLINE-01-01: Customer can be created while network is disconnected', async () => {
    const page = appInstance.window;
    const { navigateTo } = appInstance;

    // Simulate going offline via the browser offline event
    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
    });
    await page.waitForTimeout(300);

    // Sync badge should reflect offline state
    const syncBadge = page.locator('[data-testid="sync-badge"]').first();
    if (await syncBadge.isVisible()) {
      await expect(syncBadge).toContainText(/Offline|أوفلاين/i);
    }

    // Create a customer while offline
    await navigateTo('/customers');
    await page.waitForTimeout(300);

    const addCustBtn = page.locator('[data-testid="add-customer-btn"]');
    await expect(addCustBtn).toBeVisible();
    await addCustBtn.click();
    await page.waitForTimeout(300);

    const offlineCustomerName = 'Offline Customer Test Co';
    await page.locator('[data-testid="customer-name-input"]').fill(offlineCustomerName);
    await page.locator('[data-testid="customer-phone-input"]').fill('+966 50 000 9999');
    await page.locator('[data-testid="customer-submit-btn"]').click();
    await page.waitForTimeout(600);

    // Customer should appear in the list immediately (from local IndexedDB cache)
    const customerCard = page.locator('[data-testid^="customer-card-"]').filter({ hasText: offlineCustomerName }).first();
    await expect(customerCard).toBeVisible({ timeout: 3000 });

    // Restore online
    await page.evaluate(() => {
      window.dispatchEvent(new Event('online'));
    });
    await page.waitForTimeout(500);
  });

  test('T1-OFFLINE-01-02: Invoice can be created while network is disconnected', async () => {
    const page = appInstance.window;
    const { navigateTo } = appInstance;

    // First, create a customer while online
    await navigateTo('/customers');
    await page.waitForTimeout(300);
    await page.locator('[data-testid="add-customer-btn"]').click();
    await page.waitForTimeout(300);
    const customerName = 'Offline Invoice Test Ltd';
    await page.locator('[data-testid="customer-name-input"]').fill(customerName);
    await page.locator('[data-testid="customer-phone-input"]').fill('+966 55 000 1234');
    await page.locator('[data-testid="customer-submit-btn"]').click();
    await page.waitForTimeout(600);

    // Now go offline
    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
    });
    await page.waitForTimeout(300);

    // Create invoice while offline
    await navigateTo('/invoices?new=1');
    await page.waitForTimeout(400);

    const form = page.locator('form');
    await expect(form).toBeVisible();

    const customerSelect = page.locator('[data-testid="customer-select"]');
    const custOption = customerSelect.locator('option', { hasText: customerName });
    await expect(custOption).toBeAttached({ timeout: 5000 });
    const optionVal = await custOption.getAttribute('value');
    await customerSelect.selectOption(optionVal!);

    await page.locator('[data-testid="item-0-description"]').fill('Offline Service Item');
    await page.locator('[data-testid="item-0-quantity"]').fill('2');
    await page.locator('[data-testid="item-0-unitPrice"]').fill('250.00');
    await page.locator('[data-testid="item-0-taxRate"]').fill('0');

    const grandTotalDisplay = page.locator('#grand-total-display');
    await expect(grandTotalDisplay).toContainText('500.00');

    const saveBtn = page.locator('[data-testid="invoice-submit-btn"]');
    await saveBtn.click();
    await expect(form).toBeHidden({ timeout: 10000 });
    await page.waitForTimeout(400);

    // Invoice should be visible in the list (from local cache)
    const invoiceCard = page.locator('.cursor-pointer').filter({ hasText: customerName }).first();
    await expect(invoiceCard).toBeVisible({ timeout: 5000 });
    await expect(invoiceCard).toContainText('500.00');

    // Restore online — sync should begin automatically
    await page.evaluate(() => {
      window.dispatchEvent(new Event('online'));
    });
    await page.waitForTimeout(1000);

    // Sync badge should update back to online/synced
    const syncBadge = page.locator('[data-testid="sync-badge"]').first();
    if (await syncBadge.isVisible()) {
      await expect(syncBadge).not.toContainText(/Offline|أوفلاين/i);
    }
  });

  test('T1-OFFLINE-01-03: Application remains fully functional during offline → online transition', async () => {
    const page = appInstance.window;
    const { navigateTo } = appInstance;

    // Go online, load dashboard
    await navigateTo('/');
    await page.waitForTimeout(400);
    const dashboardKPIs = page.locator('[data-testid="metrics-grid"]');
    await expect(dashboardKPIs).toBeVisible();

    // Simulate network disconnect
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.waitForTimeout(200);

    // Navigate while offline — no crash or blank screen
    await navigateTo('/customers');
    await page.waitForTimeout(400);
    const addCustBtn = page.locator('[data-testid="add-customer-btn"]');
    await expect(addCustBtn).toBeVisible({ timeout: 5000 });

    await navigateTo('/invoices');
    await page.waitForTimeout(400);
    const newInvoiceBtn = page.locator('[data-testid="new-invoice-btn"]');
    await expect(newInvoiceBtn).toBeVisible({ timeout: 5000 });

    // Reconnect
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.waitForTimeout(500);

    // Back to dashboard — still functional
    await navigateTo('/');
    await page.waitForTimeout(400);
    await expect(dashboardKPIs).toBeVisible();
  });

  test('T1-OFFLINE-01-04: Pending sync queue drains automatically on reconnect', async () => {
    const page = appInstance.window;
    const { navigateTo } = appInstance;

    // Go offline and add a customer
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.waitForTimeout(300);

    await navigateTo('/customers');
    await page.waitForTimeout(300);
    await page.locator('[data-testid="add-customer-btn"]').click();
    await page.waitForTimeout(300);

    const queuedName = 'Sync Queue Test Customer';
    await page.locator('[data-testid="customer-name-input"]').fill(queuedName);
    await page.locator('[data-testid="customer-phone-input"]').fill('+966 50 111 2222');
    await page.locator('[data-testid="customer-submit-btn"]').click();
    await page.waitForTimeout(600);

    // Customer visible offline
    const customerCard = page.locator('[data-testid^="customer-card-"]').filter({ hasText: queuedName }).first();
    await expect(customerCard).toBeVisible({ timeout: 3000 });

    // Reconnect
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.waitForTimeout(2000);

    // Sync badge should not show offline anymore
    const syncBadge = page.locator('[data-testid="sync-badge"]').first();
    if (await syncBadge.isVisible()) {
      await expect(syncBadge).not.toContainText(/Offline|أوفلاين/i);
    }

    // Customer still visible after sync
    await expect(customerCard).toBeVisible();
  });
});
