import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

test.describe('Electron Launch & Preload Smoke Test', () => {
  test('launches application and attaches window.electronAPI', async () => {
    const electronApp = await electron.launch({
      args: [path.join(projectRoot, 'dist-electron/main.js')],
      env: { ...process.env, NODE_ENV: 'production' }
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    const hasElectronAPI = await window.evaluate(() => typeof (window as any).electronAPI !== 'undefined');
    
    // We expect this assertion to fail right now because preload has ESM bug!
    expect(hasElectronAPI).toBe(true);

    await electronApp.close();
  });
});
