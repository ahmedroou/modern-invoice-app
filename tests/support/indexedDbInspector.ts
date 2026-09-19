import { Page } from '@playwright/test';

/**
 * IndexedDB Inspector helper to verify local offline persistence
 */
export async function getIndexedDbDatabaseNames(page: Page): Promise<string[]> {
  return await page.evaluate(async () => {
    if (!('indexedDB' in window) || !indexedDB.databases) {
      return [];
    }
    const dbs = await indexedDB.databases();
    return dbs.map(d => d.name || '').filter(Boolean);
  });
}
