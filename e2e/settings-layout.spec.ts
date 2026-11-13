import { expect, test } from './fixtures/app-fixture.ts';
import { expectReachable } from './fixtures/reachability.ts';

/** Breakpoint `full` (Technical Specification 2.0.10): below it R-1 stacks the columns. */
const FULL_BREAKPOINT_PX = 1366;

const SECTIONS = [
  'Händlermarke',
  'Gerätearten und Merkmale',
  'Auswahllisten',
  'Titelmuster',
  'Textbausteine',
  'Hersteller und GPSR',
  'Lieferanten',
  'Code-Übersetzung',
  'Zustandszuordnung',
  'Kategoriezuordnung',
  'Merkmalszuordnung',
  'Beschreibungsvorlagen',
  'Kanäle und Preisregeln',
  'Datenblatt-Layout',
];

test.describe('UI-025 settings layout (CU-093)', () => {
  test('UI-025.default: DER-33-01 the first call of "Einstellungen" shows the 14 sections and opens "Händlermarke"', async ({
    page,
  }) => {
    await page.goto('/inserate');
    await page
      .getByRole('navigation', { name: 'Hauptnavigation' })
      .getByRole('link', { name: 'Einstellungen' })
      .click();

    const sections = page.getByRole('navigation', { name: 'Einstellungen' });
    await expect(sections.getByRole('link')).toHaveText(SECTIONS);
    await expect(sections.getByText('Zugangspasswort')).toHaveCount(0);
    await expect(page).toHaveURL(/\/einstellungen\/haendlermarke$/);
    await expect(sections.getByRole('link', { name: 'Händlermarke' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('UI-025.default: DER-33-02 after opening "Auswahllisten" the next call of the settings opens "Auswahllisten"', async ({
    page,
  }) => {
    const mainNavigation = page.getByRole('navigation', { name: 'Hauptnavigation' });
    const sections = page.getByRole('navigation', { name: 'Einstellungen' });

    await page.goto('/inserate');
    await mainNavigation.getByRole('link', { name: 'Einstellungen' }).click();
    await sections.getByRole('link', { name: 'Auswahllisten' }).click();
    await expect(page).toHaveURL(/\/einstellungen\/auswahllisten$/);

    await mainNavigation.getByRole('link', { name: 'Inserate' }).click();
    await expect(page.getByText('Noch keine Modell-Inserate')).toBeVisible();
    await mainNavigation.getByRole('link', { name: 'Einstellungen' }).click();

    await expect(page).toHaveURL(/\/einstellungen\/auswahllisten$/);
    await expect(sections.getByRole('link', { name: 'Auswahllisten' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    // Also after reloading the program in a new page of the same browser profile.
    await page.goto('/einstellungen');
    await expect(page).toHaveURL(/\/einstellungen\/auswahllisten$/);
  });

  test('UI-025.default: arrow keys move through the list and Enter opens the focused section', async ({
    page,
  }) => {
    await page.goto('/einstellungen/haendlermarke');
    const sections = page.getByRole('navigation', { name: 'Einstellungen' });

    await sections.getByRole('link', { name: 'Händlermarke' }).focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    await expect(sections.getByRole('link', { name: 'Gerätearten und Merkmale' })).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/einstellungen\/geraetearten$/);
    await expect(sections.getByRole('link', { name: 'Gerätearten und Merkmale' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('UI-025.default: DER-33-03 below 1366 CSS px the list stands above the content, no horizontal scroll bar, no text under 12 px (R-1)', async ({
    page,
  }, testInfo) => {
    await page.goto('/einstellungen/auswahllisten');
    const list = page.getByTestId('settings-section-column');
    const content = page.getByTestId('settings-content');
    await expect(list).toBeVisible();

    const listBox = (await list.boundingBox())!;
    const contentBox = (await content.boundingBox())!;
    if (page.viewportSize()!.width < FULL_BREAKPOINT_PX) {
      expect(contentBox.y).toBeGreaterThanOrEqual(listBox.y + listBox.height);
      expect(contentBox.x).toBe(listBox.x);
    } else {
      expect(listBox.width).toBe(240);
      expect(contentBox.x).toBe(listBox.x + listBox.width);
    }

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    // Covers the horizontal scroll bar, text under 12 CSS px and every section link (6.3). FM-5
    // checks only the narrow UI-019 (6.3), like the other settings screens; since the initial
    // settings (CU-071) UI-028 shows the values of a list there.
    if (testInfo.project.name !== 'FM-5') await expectReachable(page);
  });
});
