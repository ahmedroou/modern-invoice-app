import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { _electron, expect } from '@playwright/test';

const output = path.resolve('test-results/customer-payment-regression');
fs.mkdirSync(output, { recursive: true });
const profile = process.env.MEEZAN_TEST_PROFILE || fs.mkdtempSync(path.join(os.tmpdir(), 'meezan-payment-regression-'));
const executable = process.env.MEEZAN_TEST_EXE;
const accountId = 'regression-isolated';
let app;
const errors = [];
async function launch() {
  app = await _electron.launch({ ...(executable ? { executablePath: path.resolve(executable) } : {}), args: executable ? [] : [path.resolve('dist-electron/main.js')], env: { ...process.env, NODE_ENV: 'test', ELECTRON_USER_DATA_DIR: profile } });
  const page = await app.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  await page.waitForSelector('[data-testid="app-titlebar"]');
  await page.evaluate(async () => { await window.__TEST_SIMULATE_OFFLINE__(); });
  return page;
}
async function route(page, hash) {
  await page.evaluate(hash => { location.hash = hash; }, '#/' + hash);
}
async function invoiceFromCache(page) {
  return page.evaluate(account => JSON.parse(localStorage.getItem('app_local_invoices_cache_v1_' + account) || '[]')[0], accountId);
}
async function verifyDetail(page, invoiceId, remaining) {
  await route(page, 'invoices?id=' + invoiceId);
  await expect(page.getByTestId('invoice-detail-modal')).toBeVisible();
  await expect(page.getByTestId('remaining-amount')).toContainText(remaining.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
}
async function pay(page, amount) {
  await page.getByTestId('record-payment-btn').click();
  await expect(page.getByTestId('payment-modal')).toBeVisible();
  await page.getByTestId('payment-amount-input').fill(String(amount));
  await page.getByTestId('payment-modal').locator('button[type="submit"]').click();
  await expect(page.getByTestId('payment-modal')).toBeHidden();
}
try {
  let page = await launch();
  await page.evaluate(account => {
    const now = new Date().toISOString();
    localStorage.setItem('app_accounts_registry_v1', JSON.stringify([{ id: account, name: 'Regression test', email: 'regression@example.invalid', currency: 'SAR', createdAt: now, lastLoginAt: now }]));
    localStorage.setItem('app_current_account_id_v1', account);
    localStorage.setItem('app_remember_me_v1', 'true');
    localStorage.setItem('app_language', 'ar');
    localStorage.setItem('app_theme', 'light');
  }, accountId);
  await page.reload();
  await page.waitForSelector('[data-testid="dashboard-view"]');
  await page.evaluate(async () => { await window.__TEST_SIMULATE_OFFLINE__(); });
  await page.getByTestId('action-new-customer').click();
  await page.getByTestId('customer-name-input').fill('عميل اختبار السداد');
  await page.getByTestId('customer-submit-btn').click();
  const card = page.locator('[data-testid^="customer-card-"]').first();
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.getByTestId('customer-ledger-view')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'عميل اختبار السداد', exact: true }).first()).toBeVisible();
  await expect(page.getByText('تعذر العثور على حساب العميل', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: path.join(output, 'new-customer-ledger.png') });
  await route(page, 'invoices?new=1');
  await expect(page.getByTestId('customer-select')).toBeVisible();
  await page.getByTestId('customer-select').selectOption({ label: 'عميل اختبار السداد (SAR)' });
  await page.getByTestId('item-0-description').fill('خدمة اختبار');
  await page.getByTestId('item-0-quantity').fill('1');
  await page.getByTestId('item-0-unitPrice').fill('1000');
  await page.getByTestId('item-0-taxRate').fill('0');
  await page.getByLabel('Due Date', { exact: true }).fill('2099-01-01');
  await page.getByTestId('invoice-submit-btn').click();
  await expect(page.getByTestId('invoice-submit-btn')).toBeHidden();
  await expect.poll(async () => (await invoiceFromCache(page))?.amountDue).toBe(1000);
  const invoice = await invoiceFromCache(page);
  await verifyDetail(page, invoice.id, 1000);
  await pay(page, 250);
  await expect.poll(async () => (await invoiceFromCache(page))?.amountDue).toBe(750);
  await expect(page.getByTestId('compact-metric-card').filter({ hasText: 'المستحقات المعلقة' })).toContainText('750.00');
  await verifyDetail(page, invoice.id, 750);
  await page.screenshot({ path: path.join(output, 'partial-payment-remaining-750.png') });
  await app.close();
  app = undefined;
  page = await launch();
  await verifyDetail(page, invoice.id, 750);
  await pay(page, 750);
  await expect.poll(async () => (await invoiceFromCache(page))?.amountDue).toBe(0);
  await verifyDetail(page, invoice.id, 0);
  await expect(page.getByTestId('invoice-status-badge')).toHaveText(/مدفوعة/);
  await page.screenshot({ path: path.join(output, 'full-payment-remaining-zero.png') });
  await route(page, 'customers?id=' + invoice.customerId);
  await expect(page.getByRole('heading', { name: 'عميل اختبار السداد', exact: true }).first()).toBeVisible();
  const payments = await page.evaluate(account => JSON.parse(localStorage.getItem('meezan_local_payments_' + account) || '[]'), accountId);
  assert.equal(payments.length, 2);
  assert.equal(payments.reduce((sum, payment) => sum + payment.amount, 0), 1000);
  const cached = await invoiceFromCache(page);
  assert.equal(cached.amountPaid, 1000);
  assert.equal(cached.status, 'PAID');
  await page.screenshot({ path: path.join(output, 'customer-ledger-paid.png') });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: 'passed', profile, checks: ['new customer opens immediately', 'invoice 1000 less 250 equals 750 in header and detail', 'partial payment survives full app restart', 'second payment 750 leaves zero and PAID', 'two payment records total 1000', 'customer ledger opens after restart', 'no renderer errors'], screenshots: output }, null, 2));
} catch (error) {
  if (app) { const page = (await app.windows())[0]; await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {}); }
  throw error;
} finally {
  if (app) await app.close();
}
