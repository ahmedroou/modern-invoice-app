import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { _electron, expect } from '@playwright/test';

const executable = process.env.MEEZAN_OLD_EXE;
assert.ok(executable, 'Set MEEZAN_OLD_EXE to the older packaged application');
const sandbox = process.env.MEEZAN_UPDATE_SANDBOX || fs.mkdtempSync(path.join(os.tmpdir(), 'meezan-update-check-'));
const app = await _electron.launch({
  executablePath: path.resolve(executable),
  args: [],
  env: { ...process.env, NODE_ENV: 'test', ELECTRON_USER_DATA_DIR: path.join(sandbox, 'profile'), LOCALAPPDATA: path.join(sandbox, 'cache') }
});
const mainPid = await app.evaluate(() => process.pid);
try {
  const page = await app.firstWindow();
  await page.waitForSelector('[data-testid="app-titlebar"]');
  const version = await page.evaluate(() => window.electronAPI.getAppVersion());
  assert.notEqual(version, '1.0.4', 'This check must use an older application');
  await page.evaluate(() => localStorage.setItem('app_language', 'ar'));
  await page.reload();
  await expect.poll(async () => page.evaluate(() => window.electronAPI.getUpdateState()), { timeout: 60000, intervals: [1000, 2000, 5000] }).toMatchObject({ state: 'available', info: { version: '1.0.4' } });
  await page.getByTitle('تحميل التحديث').filter({ visible: true }).first().click();
  await expect.poll(async () => page.evaluate(() => window.electronAPI.getUpdateState()), { timeout: 600000, intervals: [1000, 3000, 5000] }).toMatchObject({ state: 'downloaded', info: { version: '1.0.4' } });
  await expect(page.getByRole('button', { name: 'تثبيت الآن', exact: true }).first()).toBeVisible();
  fs.mkdirSync('test-results/customer-payment-regression', { recursive: true });
  await page.screenshot({ path: 'test-results/customer-payment-regression/update-ready-to-install.png' });
  console.log(JSON.stringify({ result: 'passed', previousVersion: version, availableVersion: '1.0.4', downloaded: true, installButtonVisible: true, sandbox }, null, 2));
} finally {
  // Terminate the isolated test process so its quit handler cannot install the downloaded update.
  if (process.platform === 'win32') {
    execFileSync('taskkill.exe', ['/PID', String(mainPid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  } else {
    app.process().kill('SIGKILL');
  }
}
