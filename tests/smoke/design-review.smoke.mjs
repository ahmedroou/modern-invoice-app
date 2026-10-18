import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { _electron } from '@playwright/test';

const output = path.resolve('test-results/design-review');
fs.mkdirSync(output, { recursive: true });
const tempProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'meezan-design-review-'));
const executable = process.env.MEEZAN_TEST_EXE;
const app = await _electron.launch({ ...(executable ? { executablePath: path.resolve(executable) } : {}), args: executable ? [] : [path.resolve('dist-electron/main.js')], env: { ...process.env, NODE_ENV: 'test', ELECTRON_USER_DATA_DIR: tempProfile } });
const errors = [];
try {
  const page = await app.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  await page.waitForSelector('#account-email');
  await page.evaluate(() => { localStorage.setItem('app_language', 'ar'); localStorage.setItem('app_theme', 'light'); });
  await page.reload();
  await page.waitForSelector('#account-email');
  await page.screenshot({ path: path.join(output, 'login-ar-light.png') });
  const images = await page.evaluate(async () => {
    await Promise.all(Array.from(document.images).map(image => image.decode()));
    return Array.from(document.images).map(image => ({ width: image.naturalWidth, embedded: image.src.startsWith('data:image/png') }));
  });
  assert.ok(images.length > 0 && images.every(image => image.width > 0 && image.embedded), 'All logos decode from embedded assets');
  await page.evaluate(() => {
    localStorage.setItem('app_accounts_registry_v1', JSON.stringify([{ id: 'design-review-isolated', name: 'مساحة التجربة', email: 'ui-test@example.invalid', currency: 'SAR', createdAt: new Date().toISOString(), lastLoginAt: new Date().toISOString() }]));
    localStorage.setItem('app_current_account_id_v1', 'design-review-isolated');
    localStorage.setItem('app_remember_me_v1', 'true');
  });
  await page.reload();
  await page.waitForSelector('[data-testid="dashboard-view"]');
  await page.screenshot({ path: path.join(output, 'dashboard-ar-light.png') });
  await page.getByTestId('action-new-customer').click();
  await page.waitForSelector('[aria-labelledby="customer-modal-title"]');
  await page.keyboard.press('Escape');
  await page.evaluate(() => { location.hash = '#/'; });
  await page.waitForSelector('[data-testid="dashboard-view"]');
  await page.keyboard.press('Control+k');
  const dialog = page.locator('dialog[open]');
  await dialog.waitFor();
  await dialog.locator('input').fill('الإعدادات');
  await page.keyboard.press('Enter');
  await page.waitForSelector('[data-testid="settings-view"]');
  await page.getByTestId('settings-view').getByRole('button', { name: 'الوضع الداكن', exact: true }).click();
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), true);
  await page.reload();
  await page.waitForSelector('[data-testid="settings-view"]');
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), true);
  await page.screenshot({ path: path.join(output, 'settings-ar-dark.png') });
  for (const route of ['invoices', 'customers', 'payments', 'expenses', 'statements']) {
    await page.evaluate(route => { location.hash = '#/' + route; }, route);
    await page.waitForTimeout(300);
    assert.ok(await page.locator('#app-root').innerText());
    await page.screenshot({ path: path.join(output, route + '-ar-dark.png') });
  }
  await page.evaluate(() => { location.hash = '#/'; });
  await page.waitForSelector('[data-testid="dashboard-view"]');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'No page overflow at 390px');
  await page.screenshot({ path: path.join(output, 'dashboard-ar-mobile.png') });
  await page.getByTestId('quick-access-trigger').click();
  await page.locator('dialog[open]').waitFor();
  await page.keyboard.press('Escape');
  await page.evaluate(() => { localStorage.setItem('app_language', 'en'); localStorage.setItem('app_theme', 'light'); location.hash = '#/settings'; });
  await page.reload();
  await page.waitForSelector('[data-testid="settings-view"]');
  assert.equal(await page.evaluate(() => document.documentElement.dir), 'ltr');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: path.join(output, 'settings-en-light.png') });
  assert.deepEqual(errors, [], 'No uncaught renderer errors');
  console.log(JSON.stringify({ result: 'passed', checks: ['embedded logos', 'new customer shortcut', 'Ctrl K search and Enter navigation', 'persistent theme', 'Arabic and English', 'five module routes', 'mobile overflow', 'no renderer errors'], screenshots: output }, null, 2));
} finally {
  await app.close();
}
