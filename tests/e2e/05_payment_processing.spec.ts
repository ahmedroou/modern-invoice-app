import { test, expect } from '@playwright/test';
import { launchTestApp, TestAppInstance } from '../support/electronHarness';

test.describe('Acceptance Criterion 5 (AC 5): Payment Recording & Status Transitions', () => {
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

  test('T1-PAY-01-01: Full payment transitions invoice status to Paid and updates Activity Log', async () => {
    const page = appInstance.window;
    const { navigateTo } = appInstance;

    // 1. Create a customer
    await navigateTo('/customers');
    await page.waitForTimeout(300);
    const addCustBtn = page.locator('[data-testid="add-customer-btn"]');
    await expect(addCustBtn).toBeVisible();
    await addCustBtn.click();
    await page.waitForTimeout(300);

    const customerName = 'Mohammed Al-Rashid Trading';
    await page.locator('[data-testid="customer-name-input"]').fill(customerName);
    await page.locator('[data-testid="customer-phone-input"]').fill('+966 55 123 4567');
    await page.locator('[data-testid="customer-submit-btn"]').click();
    await page.waitForTimeout(600);

    // 2. Navigate to Invoices and open New Invoice modal via button
    await navigateTo('/invoices');
    await page.waitForTimeout(400);

    const newInvoiceBtn = page.locator('[data-testid="new-invoice-btn"]');
    await expect(newInvoiceBtn).toBeVisible();
    await newInvoiceBtn.click();
    await page.waitForTimeout(400);

    const formModal = page.locator('form');
    await expect(formModal).toBeVisible();

    const customerSelect = page.locator('[data-testid="customer-select"]');
    const custOption = customerSelect.locator('option', { hasText: customerName });
    await expect(custOption).toBeAttached({ timeout: 5000 });
    const optionVal = await custOption.getAttribute('value');
    await customerSelect.selectOption(optionVal!);

    // Fill line item: 1 × 500 (no tax)
    await page.locator('[data-testid="item-0-description"]').fill('Web Development Services');
    await page.locator('[data-testid="item-0-quantity"]').fill('1');
    await page.locator('[data-testid="item-0-unitPrice"]').fill('500.00');
    await page.locator('[data-testid="item-0-taxRate"]').fill('0');

    const grandTotalDisplay = page.locator('#grand-total-display');
    await expect(grandTotalDisplay).toContainText('500.00');

    // Save the invoice and wait for modal to close
    const saveBtn = page.locator('[data-testid="invoice-submit-btn"]');
    await saveBtn.click();
    await expect(formModal).toBeHidden({ timeout: 10000 });
    await page.waitForTimeout(400);

    // 3. Click on the newly created invoice in list to open InvoiceDetail modal
    const invoiceCard = page.locator('.cursor-pointer').filter({ hasText: customerName }).first();
    await expect(invoiceCard).toBeVisible({ timeout: 5000 });
    await invoiceCard.click();
    await page.waitForTimeout(400);

    // InvoiceDetail modal is now open; verify initial unpaid status
    const detailModal = page.locator('div[role="dialog"]');
    await expect(detailModal).toBeVisible();
    await expect(detailModal).toContainText(/Unpaid|Overdue|غير مدفوع|متأخر/i);

    // Click Record Payment button inside the detail modal
    const recordPaymentBtn = detailModal.locator('button', { hasText: /Record Payment|تسجيل دفعة/i });
    await expect(recordPaymentBtn).toBeVisible();
    await recordPaymentBtn.click();
    await page.waitForTimeout(400);

    // 4. Record full payment inside PaymentModal
    const paymentModal = page.locator('div[role="dialog"]').filter({ hasText: /Record Payment|تسجيل دفعة/i });
    await expect(paymentModal).toBeVisible();

    const amountInput = paymentModal.locator('input[type="number"]');
    await amountInput.fill('500.00');

    const bankTransferBtn = paymentModal.locator('button').filter({ hasText: /Bank Transfer|تحويل بنكي/i }).first();
    if (await bankTransferBtn.isVisible()) {
      await bankTransferBtn.click();
    }

    const submitPaymentBtn = paymentModal.locator('button[type="submit"]');
    await submitPaymentBtn.click();
    await expect(paymentModal).toBeHidden({ timeout: 10000 });
    await page.waitForTimeout(400);

    // 5. Verify invoice status on card is now Paid
    const updatedCard = page.locator('.cursor-pointer').filter({ hasText: customerName }).first();
    await expect(updatedCard).toBeVisible();
    await expect(updatedCard).toContainText(/Paid|مدفوع/i);

    // Drill in to confirm detail modal shows Paid
    await updatedCard.click();
    await page.waitForTimeout(400);
    const openedDetail = page.locator('div[role="dialog"]');
    await expect(openedDetail).toContainText(/Paid|مدفوع/i);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // 6. Verify activity log on dashboard reflects the payment
    await navigateTo('/');
    await page.waitForTimeout(600);
    const activityFeed = page.locator('[data-testid="activity-feed"]');
    await expect(activityFeed).toBeVisible();
    await expect(activityFeed).toContainText(/500/);
    await expect(activityFeed).toContainText(/Payment|دفعة/i);
  });

  test('T1-PAY-01-02: Partial payment results in Partially Paid status with correct remaining amount', async () => {
    const page = appInstance.window;
    const { navigateTo } = appInstance;

    // 1. Create customer
    await navigateTo('/customers');
    await page.waitForTimeout(300);
    await page.locator('[data-testid="add-customer-btn"]').click();
    await page.waitForTimeout(300);

    const customerName = 'Fatima Al-Zahrani Co';
    await page.locator('[data-testid="customer-name-input"]').fill(customerName);
    await page.locator('[data-testid="customer-phone-input"]').fill('+966 50 987 6543');
    await page.locator('[data-testid="customer-submit-btn"]').click();
    await page.waitForTimeout(600);

    // 2. Create invoice for 1000
    await navigateTo('/invoices');
    await page.waitForTimeout(400);

    const newInvoiceBtn = page.locator('[data-testid="new-invoice-btn"]');
    await expect(newInvoiceBtn).toBeVisible();
    await newInvoiceBtn.click();
    await page.waitForTimeout(400);

    const formModal = page.locator('form');
    await expect(formModal).toBeVisible();

    const customerSelect = page.locator('[data-testid="customer-select"]');
    const custOption = customerSelect.locator('option', { hasText: customerName });
    await expect(custOption).toBeAttached({ timeout: 5000 });
    const optionVal = await custOption.getAttribute('value');
    await customerSelect.selectOption(optionVal!);

    await page.locator('[data-testid="item-0-description"]').fill('Annual Subscription');
    await page.locator('[data-testid="item-0-quantity"]').fill('1');
    await page.locator('[data-testid="item-0-unitPrice"]').fill('1000.00');
    await page.locator('[data-testid="item-0-taxRate"]').fill('0');

    await page.locator('[data-testid="invoice-submit-btn"]').click();
    await expect(formModal).toBeHidden({ timeout: 10000 });
    await page.waitForTimeout(400);

    // 3. Open invoice detail modal
    const invoiceCard = page.locator('.cursor-pointer').filter({ hasText: customerName }).first();
    await expect(invoiceCard).toBeVisible({ timeout: 5000 });
    await invoiceCard.click();
    await page.waitForTimeout(400);

    // 4. Record partial payment: 300 of 1000
    const detailModal = page.locator('div[role="dialog"]');
    const recordPaymentBtn = detailModal.locator('button', { hasText: /Record Payment|تسجيل دفعة/i });
    await recordPaymentBtn.click();
    await page.waitForTimeout(400);

    const paymentModal = page.locator('div[role="dialog"]').filter({ hasText: /Record Payment|تسجيل دفعة/i });
    const amountInput = paymentModal.locator('input[type="number"]');
    await amountInput.fill('300.00');
    const submitPaymentBtn = paymentModal.locator('button[type="submit"]');
    await submitPaymentBtn.click();
    await expect(paymentModal).toBeHidden({ timeout: 10000 });
    await page.waitForTimeout(400);

    // 5. Status should be Partially Paid on card and remaining due should reflect 700
    const updatedCard = page.locator('.cursor-pointer').filter({ hasText: customerName }).first();
    await expect(updatedCard).toContainText(/Partial|جزئي/i);
    await expect(updatedCard).toContainText('700');

    // Drill in to verify detail modal shows Partial and 700 due
    await updatedCard.click();
    await page.waitForTimeout(400);
    const openedDetail = page.locator('div[role="dialog"]');
    await expect(openedDetail).toContainText(/Partial|جزئي/i);
    await expect(openedDetail).toContainText('700');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  });

  test('T1-PAY-01-03: Reject negative or zero payment amount', async () => {
    const page = appInstance.window;
    const { navigateTo } = appInstance;

    // Create a customer & invoice for validation test
    await navigateTo('/customers');
    await page.waitForTimeout(300);
    await page.locator('[data-testid="add-customer-btn"]').click();
    await page.waitForTimeout(300);

    const customerName = 'Validation Test Co';
    await page.locator('[data-testid="customer-name-input"]').fill(customerName);
    await page.locator('[data-testid="customer-submit-btn"]').click();
    await page.waitForTimeout(600);

    await navigateTo('/invoices');
    await page.waitForTimeout(400);

    const newInvoiceBtn = page.locator('[data-testid="new-invoice-btn"]');
    await expect(newInvoiceBtn).toBeVisible();
    await newInvoiceBtn.click();
    await page.waitForTimeout(400);

    const formModal = page.locator('form');
    await expect(formModal).toBeVisible();

    const customerSelect = page.locator('[data-testid="customer-select"]');
    const custOption = customerSelect.locator('option', { hasText: customerName });
    await expect(custOption).toBeAttached({ timeout: 5000 });
    const optionVal = await custOption.getAttribute('value');
    await customerSelect.selectOption(optionVal!);

    await page.locator('[data-testid="item-0-description"]').fill('Validation Service');
    await page.locator('[data-testid="item-0-quantity"]').fill('1');
    await page.locator('[data-testid="item-0-unitPrice"]').fill('200.00');
    await page.locator('[data-testid="invoice-submit-btn"]').click();
    await expect(formModal).toBeHidden({ timeout: 10000 });
    await page.waitForTimeout(400);

    // Open detail modal
    const invoiceCard = page.locator('.cursor-pointer').filter({ hasText: customerName }).first();
    await invoiceCard.click();
    await page.waitForTimeout(400);

    const detailModal = page.locator('div[role="dialog"]');
    const recordPaymentBtn = detailModal.locator('button', { hasText: /Record Payment|تسجيل دفعة/i });
    await recordPaymentBtn.click();
    await page.waitForTimeout(400);

    const paymentModal = page.locator('div[role="dialog"]').filter({ hasText: /Record Payment|تسجيل دفعة/i });
    await expect(paymentModal).toBeVisible();

    const amountInput = paymentModal.locator('input[type="number"]');
    await amountInput.fill('-100');

    const submitBtn = paymentModal.locator('button[type="submit"]');
    await submitBtn.click();
    await page.waitForTimeout(300);

    // Error alert is displayed and modal stays open
    const errorAlert = paymentModal.locator('[data-testid="payment-error-alert"]');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText(/greater than 0/i);
    await expect(paymentModal).toBeVisible();
  });
});
