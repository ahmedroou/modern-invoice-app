import { test, expect } from '@playwright/test';
import { launchTestApp, TestAppInstance } from '../support/electronHarness';

test.describe('Acceptance Criterion 4 (AC 4): Customer Balance Synchronization & Atomic Mutations', () => {
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

  test('T1-CUST-03-01: Creating an invoice updates the customer Outstanding Amount instantly', async () => {
    const page = appInstance.window;
    const { navigateTo } = appInstance;

    // 1. Create a fresh customer
    await navigateTo('/customers');
    await page.waitForTimeout(300);

    const addCustBtn = page.locator('[data-testid="add-customer-btn"]');
    await expect(addCustBtn).toBeVisible();
    await addCustBtn.click();
    await page.waitForTimeout(300);

    const customerName = 'Atlas Engineering Ltd';
    const nameInput = page.locator('[data-testid="customer-name-input"]');
    await nameInput.fill(customerName);

    const phoneInput = page.locator('[data-testid="customer-phone-input"]');
    await phoneInput.fill('+966 50 999 1122');

    // Submit customer creation form
    const saveCustomerBtn = page.locator('[data-testid="customer-submit-btn"]');
    await saveCustomerBtn.click();
    await page.waitForTimeout(600);

    // Verify customer card appears with 0.00 initial due
    const customerCard = page.locator('[data-testid^="customer-card-"]').filter({ hasText: customerName }).first();
    await expect(customerCard).toBeVisible();
    await expect(customerCard).toContainText('0.00');

    // 2. Create an invoice for this customer
    await navigateTo('/invoices?new=1');
    await page.waitForTimeout(400);

    const form = page.locator('form');
    await expect(form).toBeVisible();

    // Select customer from dropdown
    const customerSelect = page.locator('[data-testid="customer-select"]');
    const custOption = customerSelect.locator('option', { hasText: customerName });
    await expect(custOption).toBeAttached({ timeout: 5000 });
    const optionVal = await custOption.getAttribute('value');
    await customerSelect.selectOption(optionVal!);

    // Populate line item: 1 unit @ 500.00, Tax 0% -> 500.00 Grand Total
    await page.locator('[data-testid="item-0-description"]').fill('Engineering Assessment');
    await page.locator('[data-testid="item-0-quantity"]').fill('1');
    await page.locator('[data-testid="item-0-unitPrice"]').fill('500.00');
    await page.locator('[data-testid="item-0-taxRate"]').fill('0');

    // Grand total displays 500.00
    const grandTotalDisplay = page.locator('#grand-total-display');
    await expect(grandTotalDisplay).toContainText('500.00');

    // Save invoice
    const saveInvoiceBtn = page.locator('[data-testid="invoice-submit-btn"]');
    await saveInvoiceBtn.click();
    await page.waitForTimeout(800);

    // 3. Navigate back to customers and verify instant balance sync
    await navigateTo('/customers');
    await page.waitForTimeout(600);

    // Customer card must reflect updated due of 500.00
    const updatedCard = page.locator('[data-testid^="customer-card-"]').filter({ hasText: customerName }).first();
    await expect(updatedCard).toBeVisible();
    await expect(updatedCard).toContainText('500.00');
  });

  test('T1-CUST-03-02: Multi-invoice balance accumulates accurately on the customer account', async () => {
    const page = appInstance.window;
    const { navigateTo } = appInstance;

    // 1. Create a customer
    await navigateTo('/customers');
    await page.waitForTimeout(300);

    await page.locator('[data-testid="add-customer-btn"]').click();
    await page.waitForTimeout(300);

    const customerName = 'Apex Logistics KSA';
    await page.locator('[data-testid="customer-name-input"]').fill(customerName);
    await page.locator('[data-testid="customer-submit-btn"]').click();
    await page.waitForTimeout(600);

    const customerCard = page.locator('[data-testid^="customer-card-"]').filter({ hasText: customerName }).first();
    await expect(customerCard).toBeVisible({ timeout: 10000 });
    await expect(customerCard).toContainText('0.00');

    // 2. Invoice 1: 400.00
    await navigateTo('/invoices?new=1');
    await page.waitForTimeout(400);
    const select1 = page.locator('[data-testid="customer-select"]');
    const opt1 = select1.locator('option', { hasText: customerName });
    await expect(opt1).toBeAttached({ timeout: 5000 });
    const val1 = await opt1.getAttribute('value');
    await select1.selectOption(val1!);

    await page.locator('[data-testid="item-0-description"]').fill('Logistics Phase 1');
    await page.locator('[data-testid="item-0-quantity"]').fill('1');
    await page.locator('[data-testid="item-0-unitPrice"]').fill('400.00');
    await page.locator('[data-testid="item-0-taxRate"]').fill('0');
    await page.locator('[data-testid="invoice-submit-btn"]').click();
    await page.waitForTimeout(800);

    // 3. Invoice 2: 250.00
    await navigateTo('/customers');
    await page.waitForTimeout(400);
    await navigateTo('/invoices?new=1');
    await page.waitForTimeout(400);

    const select2 = page.locator('[data-testid="customer-select"]');
    const opt2 = select2.locator('option', { hasText: customerName });
    await expect(opt2).toBeAttached({ timeout: 5000 });
    const val2 = await opt2.getAttribute('value');
    await select2.selectOption(val2!);

    await page.locator('[data-testid="item-0-description"]').fill('Logistics Phase 2');
    await page.locator('[data-testid="item-0-quantity"]').fill('1');
    await page.locator('[data-testid="item-0-unitPrice"]').fill('250.00');
    await page.locator('[data-testid="item-0-taxRate"]').fill('0');
    await page.locator('[data-testid="invoice-submit-btn"]').click();
    await page.waitForTimeout(800);

    // 4. Verify customer balance is 400 + 250 = 650.00
    await navigateTo('/customers');
    await page.waitForTimeout(600);

    const card = page.locator('[data-testid^="customer-card-"]').filter({ hasText: customerName }).first();
    await expect(card).toBeVisible({ timeout: 10000 });
    await expect(card).toContainText('650.00');
  });

  test('T1-CUST-03-03: Customer Ledger reflects chronological invoices and total outstanding balance', async () => {
    const page = appInstance.window;
    const { navigateTo } = appInstance;

    // 1. Create a customer
    await navigateTo('/customers');
    await page.waitForTimeout(300);

    await page.locator('[data-testid="add-customer-btn"]').click();
    await page.waitForTimeout(300);

    const customerName = 'Beacon Trading Group';
    await page.locator('[data-testid="customer-name-input"]').fill(customerName);
    await page.locator('[data-testid="customer-submit-btn"]').click();
    await page.waitForTimeout(600);

    const customerCard = page.locator('[data-testid^="customer-card-"]').filter({ hasText: customerName }).first();
    await expect(customerCard).toBeVisible({ timeout: 10000 });
    await expect(customerCard).toContainText('0.00');

    // 2. Invoice: 750.00
    await navigateTo('/invoices?new=1');
    await page.waitForTimeout(400);
    const select = page.locator('[data-testid="customer-select"]');
    const opt = select.locator('option', { hasText: customerName });
    await expect(opt).toBeAttached({ timeout: 5000 });
    const val = await opt.getAttribute('value');
    await select.selectOption(val!);

    await page.locator('[data-testid="item-0-description"]').fill('Warehouse Goods');
    await page.locator('[data-testid="item-0-quantity"]').fill('1');
    await page.locator('[data-testid="item-0-unitPrice"]').fill('750.00');
    await page.locator('[data-testid="item-0-taxRate"]').fill('0');
    await page.locator('[data-testid="invoice-submit-btn"]').click();
    await page.waitForTimeout(800);

    // 3. Drill down into Customer Ledger
    await navigateTo('/customers');
    await page.waitForTimeout(600);

    const card = page.locator('[data-testid^="customer-card-"]').filter({ hasText: customerName }).first();
    await expect(card).toBeVisible({ timeout: 10000 });
    await card.click();

    // Verify Customer Ledger view is mounted
    const ledgerView = page.locator('[data-testid="customer-ledger-view"]');
    await expect(ledgerView).toBeVisible({ timeout: 10000 });
    await expect(ledgerView).toContainText('750.00', { timeout: 15000 });
  });
});
