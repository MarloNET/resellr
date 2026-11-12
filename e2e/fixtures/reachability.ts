import { expect, type Page } from '@playwright/test';

/** Operable elements of Technical Specification 6.3 ("Aktion erreichbar"). */
const OPERABLE_SELECTOR = [
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  '[role="button"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="checkbox"]',
  '[role="switch"]',
].join(', ');

/** Areas whose content must not be cut off (6.3, "Inhalt erreichbar"). */
const CONTENT_AREAS = 'main, nav, aside, [role="dialog"]';

/** Smallest computed font size of visible text in CSS px (6.3). */
const MIN_FONT_SIZE_PX = 12;

/**
 * Checks one operable element after `scrollIntoViewIfNeeded()`: completely inside the viewport,
 * and `document.elementFromPoint` hits the element or a child in its center and just inside the
 * middle of each edge, so neither a fixed bar, a banner nor another part of the frame covers it.
 * Runs in the browser; returns the problem or null.
 */
function checkOperableElement(element: Element): string | null {
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  const rect = element.getBoundingClientRect();
  if (rect.left < 0 || rect.top < 0 || rect.right > viewportWidth || rect.bottom > viewportHeight) {
    return `not completely inside the viewport ${viewportWidth}x${viewportHeight}: ${JSON.stringify(rect)}`;
  }
  const inset = 1;
  const middleX = rect.left + rect.width / 2;
  const middleY = rect.top + rect.height / 2;
  const points: [string, number, number][] = [
    ['center', middleX, middleY],
    ['top edge', middleX, rect.top + inset],
    ['bottom edge', middleX, rect.bottom - inset],
    ['left edge', rect.left + inset, middleY],
    ['right edge', rect.right - inset, middleY],
  ];
  for (const [name, x, y] of points) {
    const hit = document.elementFromPoint(x, y);
    if (hit === null || !element.contains(hit)) {
      const by = hit === null ? 'nothing' : `${hit.tagName.toLowerCase()}.${hit.className}`;
      return `covered at the ${name} by ${by}`;
    }
  }
  return null;
}

/**
 * Checks the page as a whole (6.3): no content cut off by `overflow: hidden` or `clip` in the
 * content areas (except values marked `data-truncated`), content outside the viewport only in
 * a scrolling area, no horizontal scroll bar of the page or the navigation column, the head
 * "resellr" inside the viewport, and no visible text under 12 CSS px. Runs in the browser.
 */
function checkPage({ contentAreas, minFontSize }: { contentAreas: string; minFontSize: number }) {
  const problems: string[] = [];
  const describe = (element: Element) => {
    const text = (element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return `<${element.tagName.toLowerCase()}> "${text}"`;
  };
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  const clips = (value: string) => value === 'hidden' || value === 'clip';
  const scrolls = (value: string) => value === 'auto' || value === 'scroll';

  const regions = [...document.querySelectorAll(contentAreas)];
  const inRegions = new Set<Element>(
    regions.flatMap((region) => [region, ...region.querySelectorAll('*')]),
  );

  for (const element of inRegions) {
    if (!element.checkVisibility() || element.closest('[data-truncated]')) continue;
    const style = getComputedStyle(element);
    if (clips(style.overflowX) && element.scrollWidth > element.clientWidth) {
      problems.push(`${describe(element)} cuts off content horizontally`);
    }
    if (clips(style.overflowY) && element.scrollHeight > element.clientHeight) {
      problems.push(`${describe(element)} cuts off content vertically`);
    }

    // Content outside the viewport must lie in an area that scrolls in that direction.
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const outsideX = rect.left < 0 || rect.right > viewportWidth;
    const outsideY = rect.top < 0 || rect.bottom > viewportHeight;
    if (!outsideX && !outsideY) continue;
    let scrollable = false;
    for (let parent = element.parentElement; parent !== null; parent = parent.parentElement) {
      const parentStyle = getComputedStyle(parent);
      const isRoot = parent === document.scrollingElement;
      if (
        (outsideX &&
          (isRoot || scrolls(parentStyle.overflowX)) &&
          parent.scrollWidth > parent.clientWidth) ||
        (outsideY &&
          (isRoot || scrolls(parentStyle.overflowY)) &&
          parent.scrollHeight > parent.clientHeight)
      ) {
        scrollable = true;
        break;
      }
    }
    if (!scrollable) problems.push(`${describe(element)} lies outside the viewport unscrollable`);
  }

  const page = document.scrollingElement ?? document.documentElement;
  if (page.scrollWidth > page.clientWidth) {
    problems.push(`the page scrolls horizontally (${page.scrollWidth} > ${page.clientWidth})`);
  }
  for (const column of document.querySelectorAll('aside, aside *')) {
    if (column.scrollWidth > column.clientWidth && scrolls(getComputedStyle(column).overflowX)) {
      problems.push(`the navigation column scrolls horizontally: ${describe(column)}`);
    }
  }

  const head = [...document.querySelectorAll('aside *')].find(
    (element) => element.children.length === 0 && element.textContent?.trim() === 'resellr',
  );
  const headRect = head?.getBoundingClientRect();
  if (
    headRect === undefined ||
    !head?.checkVisibility() ||
    headRect.top < 0 ||
    headRect.left < 0 ||
    headRect.bottom > viewportHeight ||
    headRect.right > viewportWidth
  ) {
    problems.push('the head "resellr" is not inside the viewport');
  }

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (parent === null || node.textContent?.trim() === '' || !parent.checkVisibility()) continue;
    const fontSize = parseFloat(getComputedStyle(parent).fontSize);
    if (fontSize < minFontSize) problems.push(`${describe(parent)} has font size ${fontSize}px`);
  }

  return problems;
}

/**
 * Problems of the reachability check (CU-062, Technical Specification 6.3, REQ-077) of the
 * current page in the viewport of the current project: operable elements that are not
 * reachable, unreachable content, horizontal scroll bars, the head "resellr" not visible, text
 * under 12 CSS px. Elements in closed menus and dialogs are checked by the flow that opens them.
 */
export async function findReachabilityProblems(page: Page): Promise<string[]> {
  const problems: string[] = [];

  for (const element of await page.locator(OPERABLE_SELECTOR).all()) {
    const skip = await element.evaluate(
      (node) =>
        !node.checkVisibility() ||
        node.matches(':disabled, [aria-disabled="true"]') ||
        node.closest('[aria-hidden="true"]') !== null,
    );
    if (skip) continue;
    await element.scrollIntoViewIfNeeded();
    // Playwright aligns a `<textarea>` by its inner box without the border, so its bottom border
    // stays 1 px outside; the browser's own scroll brings the whole element into view.
    await element.evaluate((node) => node.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
    const problem = await element.evaluate(checkOperableElement);
    if (problem !== null) {
      const name = await element.evaluate(
        (node) => `<${node.tagName.toLowerCase()}> "${node.textContent?.trim() ?? ''}"`,
      );
      problems.push(`${name} ${problem}`);
    }
  }

  problems.push(
    ...(await page.evaluate(checkPage, {
      contentAreas: CONTENT_AREAS,
      minFontSize: MIN_FONT_SIZE_PX,
    })),
  );
  return problems;
}

/** Reachability check of one screen in every row FM-1 to FM-6 (6.3): no problem at all. */
export async function expectReachable(page: Page): Promise<void> {
  expect(await findReachabilityProblems(page), `reachability of ${page.url()}`).toEqual([]);
}
