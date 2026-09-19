import { Page } from '@playwright/test';

/**
 * Programmatic Network Simulator for Playwright E2E tests
 * Disconnects Firestore sockets and window network events to test offline persistence.
 */
export async function simulateOffline(page: Page): Promise<void> {
  await page.evaluate(async () => {
    if (typeof (window as any).__TEST_SIMULATE_OFFLINE__ === 'function') {
      await (window as any).__TEST_SIMULATE_OFFLINE__();
    }
    window.dispatchEvent(new Event('offline'));
  });
}

export async function simulateOnline(page: Page): Promise<void> {
  await page.evaluate(async () => {
    if (typeof (window as any).__TEST_SIMULATE_ONLINE__ === 'function') {
      await (window as any).__TEST_SIMULATE_ONLINE__();
    }
    window.dispatchEvent(new Event('online'));
  });
}

export async function getSyncStatus(page: Page): Promise<{
  isOnline: boolean;
  statusText: string;
}> {
  return await page.evaluate(() => {
    const badge = document.querySelector('[data-testid="sync-badge"]');
    return {
      isOnline: navigator.onLine,
      statusText: badge?.textContent?.trim() || ''
    };
  });
}
