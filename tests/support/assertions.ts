import { Page, Locator, expect } from '@playwright/test';

/**
 * Custom assertions and verification helpers for E2E acceptance criteria.
 */

/**
 * Asserts that strictly ZERO calculate buttons exist in the DOM (AC 3).
 */
export async function assertNoCalculateButton(page: Page): Promise<void> {
  const calculateButtons = page.locator('button, input[type="button"], input[type="submit"]').filter({
    hasText: /calculate|احسب|حساب/i
  });
  const count = await calculateButtons.count();
  expect(count).toBe(0);
}

/**
 * Asserts that the document root has RTL attributes and layout (AC 2).
 */
export async function assertRtlLayout(page: Page): Promise<void> {
  const dir = await page.evaluate(() => document.documentElement.getAttribute('dir'));
  const lang = await page.evaluate(() => document.documentElement.getAttribute('lang'));
  expect(dir).toBe('rtl');
  expect(lang).toBe('ar');
}

/**
 * Asserts that the document root has LTR attributes and layout.
 */
export async function assertLtrLayout(page: Page): Promise<void> {
  const dir = await page.evaluate(() => document.documentElement.getAttribute('dir'));
  const lang = await page.evaluate(() => document.documentElement.getAttribute('lang'));
  expect(dir).toBe('ltr');
  expect(lang).toBe('en');
}

/**
 * Asserts that an element is docked towards the right half of the viewport (RTL mode)
 */
export async function assertDockedRight(locator: Locator, page: Page): Promise<void> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  const viewport = page.viewportSize();
  const pageWidth = viewport ? viewport.width : 1280;
  const midpointX = box!.x + box!.width / 2;
  expect(midpointX).toBeGreaterThan(pageWidth / 2);
}

/**
 * Asserts that an element is docked towards the left half of the viewport (LTR mode)
 */
export async function assertDockedLeft(locator: Locator, page: Page): Promise<void> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  const viewport = page.viewportSize();
  const pageWidth = viewport ? viewport.width : 1280;
  const midpointX = box!.x + box!.width / 2;
  expect(midpointX).toBeLessThan(pageWidth / 2);
}

/**
 * Asserts that a financial string strictly contains standard 2-decimal rounded precision
 */
export function assertFinancialPrecision(valueText: string): void {
  const match = valueText.match(/\d+\.\d{2}/);
  expect(match).not.toBeNull();
}

/**
 * Asserts that numeric or financial elements contain Bidi isolation (AC 2).
 */
export async function assertBidiIsolation(page: Page, selector: string): Promise<void> {
  const element = page.locator(selector).first();
  await expect(element).toBeVisible();

  const isIsolated = await element.evaluate((el) => {
    const dirAttr = el.getAttribute('dir');
    const style = window.getComputedStyle(el);
    return (
      dirAttr === 'ltr' ||
      dirAttr === 'rtl' ||
      style.unicodeBidi === 'isolate' ||
      style.unicodeBidi === 'embed' ||
      style.direction === 'ltr' ||
      el.closest('[dir="ltr"]') !== null ||
      el.querySelector('[dir="ltr"]') !== null
    );
  });

  expect(isIsolated).toBe(true);
}
