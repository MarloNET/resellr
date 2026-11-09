import type { Page } from '@playwright/test';

import { expect, test } from './fixtures/app-fixture.ts';
import { findReachabilityProblems } from './fixtures/reachability.ts';

/** A frame like CU-044: navigation column with the head "resellr" and a scrolling content area. */
const frame = (content: string, column = '') => `
  <style>
    body { margin: 0; font: 14px sans-serif; }
    .frame { display: flex; height: 100vh; overflow: hidden; }
    aside { width: 208px; flex-shrink: 0; overflow-y: auto; }
    main { flex: 1; min-width: 0; overflow-y: auto; overflow-x: hidden; }
  </style>
  <div class="frame">
    <aside><header>resellr</header><nav><a href="#a">Inserate</a></nav>${column}</aside>
    <main>${content}</main>
  </div>`;

async function reachabilityProblems(page: Page): Promise<string> {
  return (await findReachabilityProblems(page)).join('\n');
}

/** The check of CU-062 must find what Technical Specification 6.3 forbids. */
test.describe('Reachability check (CU-062)', () => {
  test('passes a frame without problems', async ({ page }) => {
    await page.setContent(frame('<button>Speichern</button><p>Text</p>'));

    expect(await reachabilityProblems(page)).toBe('');
  });

  test('finds an operable element covered by a fixed bar', async ({ page }) => {
    await page.setContent(
      frame(`<button style="margin-top: 20px">Speichern</button>
        <div style="position: fixed; left: 0; right: 0; top: 0; height: 30px; background: red">Leiste</div>`),
    );

    expect(await reachabilityProblems(page)).toContain('"Speichern" covered at the');
  });

  test('finds an operable element covered only beyond its center', async ({ page }) => {
    await page.setContent(
      frame(`<button style="width: 200px; height: 40px">Speichern</button>
        <div style="position: fixed; left: 0; right: 0; top: 0; height: 3px; background: red"></div>`),
    );

    expect(await reachabilityProblems(page)).toContain('covered at the top edge');
  });

  test('finds content cut off by overflow hidden', async ({ page }) => {
    await page.setContent(
      frame(
        '<div style="width: 50px; overflow: hidden; white-space: nowrap">Ein langer abgeschnittener Text</div>',
      ),
    );

    expect(await reachabilityProblems(page)).toContain('cuts off content horizontally');
  });

  test('accepts a value marked as truncated by design', async ({ page }) => {
    await page.setContent(
      frame(
        '<div data-truncated title="Ein langer Text" style="width: 50px; overflow: hidden; white-space: nowrap">Ein langer Text</div>',
      ),
    );

    expect(await reachabilityProblems(page)).toBe('');
  });

  test('finds a horizontal scroll bar of the page', async ({ page }) => {
    await page.setContent(
      `<aside><header>resellr</header></aside><main><div style="width: 5000px">breit</div></main>`,
    );

    expect(await reachabilityProblems(page)).toContain('the page scrolls horizontally');
  });

  test('finds a horizontal scroll bar of the navigation column', async ({ page }) => {
    await page.setContent(
      frame('', '<div style="overflow-x: auto"><div style="width: 600px">breit</div></div>'),
    );

    expect(await reachabilityProblems(page)).toContain(
      'the navigation column scrolls horizontally',
    );
  });

  test('finds content outside the viewport that cannot be scrolled to', async ({ page }) => {
    await page.setContent(
      frame('<p style="position: fixed; top: 5000px; left: 300px">unerreichbar</p>'),
    );

    expect(await reachabilityProblems(page)).toContain('"unerreichbar" lies outside the viewport');
  });

  test('finds a missing head "resellr"', async ({ page }) => {
    await page.setContent('<main><p>Text</p></main>');

    expect(await reachabilityProblems(page)).toContain(
      'the head "resellr" is not inside the viewport',
    );
  });

  test('finds text under 12 CSS px', async ({ page }) => {
    await page.setContent(frame('<p style="font-size: 11px">klein</p>'));

    expect(await reachabilityProblems(page)).toContain('"klein" has font size 11px');
  });
});
