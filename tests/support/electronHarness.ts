import { _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

export interface TestAppOptions {
  width?: number;
  height?: number;
}

export interface TestAppInstance {
  app: ElectronApplication;
  window: Page;
  tempUserDataDir: string;
  cleanup: () => Promise<void>;
  resetAppState: () => Promise<void>;
  navigateTo: (route: string) => Promise<void>;
}

/**
 * Robust Electron test app launcher for Playwright E2E suites.
 * Launches the compiled Electron desktop application headlessly and deterministically
 * with an isolated temporary user data directory per test instance.
 */
export async function launchTestApp(options: TestAppOptions = {}): Promise<TestAppInstance> {
  const mainPath = path.join(projectRoot, 'dist-electron/main.js');
  const tempUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'electron-test-user-'));

  const app = await electron.launch({
    args: [mainPath, `--user-data-dir=${tempUserDataDir}`],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      VITE_USE_FIREBASE_EMULATOR: 'true'
    },
    timeout: 30000
  });

  const page = await app.firstWindow();
  page.on('console', (msg) => {
    console.log(`[Renderer Console] [${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    console.error(`[Renderer PageError]`, err);
  });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('[data-testid="app-titlebar"]', { timeout: 25000 });

  const defaultWidth = options.width || 1280;
  const defaultHeight = options.height || 800;
  await page.setViewportSize({ width: defaultWidth, height: defaultHeight });

  const resetAppState = async () => {
    await page.setViewportSize({ width: 1280, height: 800 });
    // If UI is currently in RTL, toggle language button to return to English LTR
    const isRtl = await page.evaluate(() => document.documentElement.getAttribute('dir') === 'rtl');
    if (isRtl) {
      const langBtn = page.locator('[data-testid="lang-switch-btn"]').first();
      if (await langBtn.isVisible()) {
        await langBtn.click();
        await page.waitForTimeout(200);
      }
    }

    // If UI is currently in Dark mode, toggle theme button to return to light
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if (isDark) {
      const themeBtn = page.locator('[data-testid="theme-toggle-btn"]').first();
      if (await themeBtn.isVisible()) {
        await themeBtn.click();
        await page.waitForTimeout(200);
      }
    }

    await page.evaluate(() => {
      try {
        window.location.hash = '#/';
        localStorage.clear();
        localStorage.setItem('app_language', 'en');
        localStorage.setItem('app_theme', 'light');
        document.documentElement.setAttribute('dir', 'ltr');
        document.documentElement.setAttribute('lang', 'en');
        document.documentElement.classList.remove('dark');
      } catch (e) {
        console.warn('Could not reset localStorage:', e);
      }
    });
    await page.waitForTimeout(200);
  };

  const navigateTo = async (route: string) => {
    const formattedRoute = route.startsWith('#') ? route : `#${route.startsWith('/') ? route : '/' + route}`;
    await page.evaluate((targetHash) => {
      window.location.hash = targetHash;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }, formattedRoute);
    await page.waitForTimeout(200);
  };

  return {
    app,
    window: page,
    tempUserDataDir,
    resetAppState,
    navigateTo,
    cleanup: async () => {
      try {
        await app.close();
      } catch (err) {
        console.warn('[electronHarness] App close warning:', err);
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 400));
        try {
          if (fs.existsSync(tempUserDataDir)) {
            fs.rmSync(tempUserDataDir, { recursive: true, force: true });
          }
        } catch {
          // ignore cleanup lock on windows temp
        }
      }
    }
  };
}
