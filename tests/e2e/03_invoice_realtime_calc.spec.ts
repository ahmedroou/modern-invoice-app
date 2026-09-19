import { test, expect } from '@playwright/test';
import { launchTestApp, TestAppInstance } from '../support/electronHarness';
import { assertNoCalculateButton } from '../support/assertions';

test.describe('Acceptance Criterion 3 (AC 3): Real-Time Invoice Calculations & Zero Calculate Button', () => {
  let appInstance: TestAppInstance;

  test.beforeEach(async () => {
    appInstance = await launchTestApp();
    await appInstance.resetAppState();
  });

  test.afterEach(async () => {
    await appInstance.cleanup();
  });

  test('T1-INV-01-01: Verifies strictly ZERO calculate buttons exist in the DOM', async () => {
    const { window, navigateTo } = appInstance;

    await navigateTo('/invoices?new=1');
    await window.waitForTimeout(300);

    const form = window.locator('form');
    await expect(form).toBeVisible();

    // Verify absence of calculate button in DOM
    await assertNoCalculateButton(window);
  });

  test('T1-INV-01-02: Grand Total updates dynamically in real-time on Qty & Unit Price input', async () => {
    const { window, navigateTo } = appInstance;

    await navigateTo('/invoices?new=1');
    await window.waitForTimeout(300);

    const grandTotalDisplay = window.locator('#grand-total-display');
    await expect(grandTotalDisplay).toBeVisible();

    // Enter Description
    const descInput = window.locator('[data-testid="item-0-description"]');
    await descInput.fill('Cloud Infrastructure Setup');

    // Enter Quantity = 4
    const qtyInput = window.locator('[data-testid="item-0-quantity"]');
    await qtyInput.fill('4');

    // Enter Unit Price = 100.00
    const priceInput = window.locator('[data-testid="item-0-unitPrice"]');
    await priceInput.fill('100.00');

    // With default 15% VAT: 4 * 100 = 400 gross + 60.00 tax = 460.00 Grand Total
    await expect(grandTotalDisplay).toContainText('460.00');

    // Set Tax to 0 to verify tax changes trigger real-time recalculation
    const taxInput = window.locator('[data-testid="item-0-taxRate"]');
    await taxInput.fill('0');
    // Without tax: 4 * 100 = 400.00 Grand Total
    await expect(grandTotalDisplay).toContainText('400.00');

    // Absence of calculate button confirmed while form is active
    await assertNoCalculateButton(window);
  });

  test('T1-INV-01-03: Modifying quantity triggers instant recalculation with 0ms delay', async () => {
    const { window, navigateTo } = appInstance;

    await navigateTo('/invoices?new=1');
    await window.waitForTimeout(300);

    const grandTotalDisplay = window.locator('#grand-total-display');
    const qtyInput = window.locator('[data-testid="item-0-quantity"]');
    const priceInput = window.locator('[data-testid="item-0-unitPrice"]');
    const taxInput = window.locator('[data-testid="item-0-taxRate"]');

    // Set 0% tax for clear linear multiplication check
    await taxInput.fill('0');
    await qtyInput.fill('3');
    await priceInput.fill('50.00');
    await expect(grandTotalDisplay).toContainText('150.00');

    // Modify quantity to 6
    await qtyInput.fill('6');
    // Grand total should update immediately to 6 * 50 = 300.00
    await expect(grandTotalDisplay).toContainText('300.00');
  });

  test('T1-INV-02-01: Adding a second line item dynamically updates Subtotal and Grand Total', async () => {
    const { window, navigateTo } = appInstance;

    await navigateTo('/invoices?new=1');
    await window.waitForTimeout(300);

    const grandTotalDisplay = window.locator('#grand-total-display');

    // Item 1: 2 @ 100 = 200 (Tax 0%)
    await window.locator('[data-testid="item-0-description"]').fill('Item 1');
    await window.locator('[data-testid="item-0-quantity"]').fill('2');
    await window.locator('[data-testid="item-0-unitPrice"]').fill('100.00');
    await window.locator('[data-testid="item-0-taxRate"]').fill('0');
    await expect(grandTotalDisplay).toContainText('200.00');

    // Click "Add Item" button
    const addRowBtn = window.locator('button', { hasText: /Add Item|إضافة بند/i }).first();
    await addRowBtn.click();
    await window.waitForTimeout(200);

    // Item 2: 3 @ 50 = 150 (Tax 0%)
    const item1Desc = window.locator('[data-testid="item-1-description"]');
    await expect(item1Desc).toBeVisible();
    await item1Desc.fill('Item 2');
    await window.locator('[data-testid="item-1-quantity"]').fill('3');
    await window.locator('[data-testid="item-1-unitPrice"]').fill('50.00');
    await window.locator('[data-testid="item-1-taxRate"]').fill('0');

    // Grand total must reflect 200 + 150 = 350.00
    await expect(grandTotalDisplay).toContainText('350.00');
  });

  test('T1-CALC-01-01: Discounts and taxes calculate reactively without button click', async () => {
    const { window, navigateTo } = appInstance;

    await navigateTo('/invoices?new=1');
    await window.waitForTimeout(300);

    const grandTotalDisplay = window.locator('#grand-total-display');

    // Item 0: Qty 2 @ 100 = 200 gross
    await window.locator('[data-testid="item-0-description"]').fill('Consulting Service');
    await window.locator('[data-testid="item-0-quantity"]').fill('2');
    await window.locator('[data-testid="item-0-unitPrice"]').fill('100.00');

    // Apply 10% discount: line discount = 20.00, taxable = 180.00
    await window.locator('[data-testid="item-0-discount"]').fill('10');

    // Default tax rate is 15%: Tax = 180 * 0.15 = 27.00. Grand Total = 180 + 27 = 207.00
    await expect(grandTotalDisplay).toContainText('207.00');
  });

  test('T1-INV-02-02: Deleting a line item recalculates Grand Total dynamically', async () => {
    const { window, navigateTo } = appInstance;

    await navigateTo('/invoices?new=1');
    await window.waitForTimeout(300);

    const grandTotalDisplay = window.locator('#grand-total-display');

    // Item 1: 1 @ 500 = 500 (Tax 0%)
    await window.locator('[data-testid="item-0-description"]').fill('High Value Server');
    await window.locator('[data-testid="item-0-quantity"]').fill('1');
    await window.locator('[data-testid="item-0-unitPrice"]').fill('500.00');
    await window.locator('[data-testid="item-0-taxRate"]').fill('0');

    // Add Item 2: 1 @ 200 = 200 (Tax 0%)
    const addRowBtn = window.locator('button', { hasText: /Add Item|إضافة بند/i }).first();
    await addRowBtn.click();
    await window.waitForTimeout(200);

    await window.locator('[data-testid="item-1-description"]').fill('Server Rack');
    await window.locator('[data-testid="item-1-quantity"]').fill('1');
    await window.locator('[data-testid="item-1-unitPrice"]').fill('200.00');
    await window.locator('[data-testid="item-1-taxRate"]').fill('0');

    // Grand total: 700.00
    await expect(grandTotalDisplay).toContainText('700.00');

    // Delete item 1 (the first row)
    const deleteFirstRowBtn = window.locator('table tbody tr').first().locator('button').last();
    await deleteFirstRowBtn.click();
    await window.waitForTimeout(200);

    // Remaining item is Server Rack: 200.00
    await expect(grandTotalDisplay).toContainText('200.00');
  });
});
