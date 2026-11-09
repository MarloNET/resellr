import { request as httpRequest } from 'node:http';

import { errorResponseSchema } from '@resellr/domain/errors/error-response';

import { type AppServer, expect, isLocalRequest, test } from './fixtures/app-fixture.ts';
import { expectReachable } from './fixtures/reachability.ts';

const NAVIGATION = [
  'Inserate',
  'Gerät einbuchen',
  'Modell-Bibliothek',
  'Geräte',
  'Änderungsprotokoll',
  'Einstellungen',
];

/** Raw HTTP request, because a browser does not let a page choose `Host` or `Origin`. */
function rawRequest(
  server: AppServer,
  { method, path, headers }: { method: string; path: string; headers: Record<string, string> },
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      { host: '127.0.0.1', port: server.port, method, path, headers, setHost: false },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => (text += chunk));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(text) }));
      },
    );
    req.on('error', reject);
    req.end(method === 'GET' ? undefined : '{}');
  });
}

test.describe('Walking Skeleton (Technical Specification 4.6)', () => {
  test('E1 /inserate shows the frame, the navigation and "Noch keine Modell-Inserate" (UI-002.empty)', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/inserate$/);
    await expect(
      page.getByRole('complementary').getByText('resellr', { exact: true }),
    ).toBeVisible();
    const navigation = page.getByRole('navigation', { name: 'Hauptnavigation' });
    await expect(navigation.getByRole('link')).toHaveText(NAVIGATION);
    await expect(navigation.getByRole('link', { name: 'Inserate' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByRole('main').getByText('Noch keine Modell-Inserate')).toBeVisible();
    await expect(
      page.getByRole('main').getByRole('link', { name: 'Gerät einbuchen' }),
    ).toBeVisible();
  });

  test('E1 every navigation entry keeps the frame and marks itself as current', async ({
    page,
  }) => {
    await page.goto('/inserate');
    const navigation = page.getByRole('navigation', { name: 'Hauptnavigation' });

    for (const label of NAVIGATION) {
      const link = navigation.getByRole('link', { name: label, exact: true });
      await link.click();
      await expect(page).toHaveURL(
        new URL((await link.getAttribute('href')) ?? '', page.url()).href,
      );
      await expect(link).toHaveAttribute('aria-current', 'page');
      await expect(navigation.getByRole('link')).toHaveText(NAVIGATION);
    }
  });

  test('E3 GET /api/ops/health and GET /api/ops/status answer as after #112', async ({
    page,
    server,
  }) => {
    const health = await page.request.get('/api/ops/health');
    expect(health.status()).toBe(200);
    expect(await health.json()).toEqual({ state: 'ready', startId: null });

    const status = await page.request.get('/api/ops/status');
    expect(status.status()).toBe(200);
    expect(await status.json()).toEqual({
      dataDirPath: server.paths.dataDir,
      appVersion: '0.1.0',
    });
  });

  test('E4 local-guard rejects a wrong host with 403 forbidden_host', async ({ server }) => {
    for (const host of [`localhost:${server.port}`, `attacker.example:${server.port}`]) {
      const response = await rawRequest(server, {
        method: 'GET',
        path: '/api/ops/health',
        headers: { host },
      });

      expect(response.status, host).toBe(403);
      expect(errorResponseSchema.parse(response.body).error.code, host).toBe('forbidden_host');
    }
  });

  test('E4 local-guard rejects a foreign origin with 403 forbidden_origin', async ({ server }) => {
    const host = `127.0.0.1:${server.port}`;
    const write = await rawRequest(server, {
      method: 'POST',
      path: '/api/ops/health',
      headers: {
        host,
        origin: 'http://attacker.example',
        'sec-fetch-site': 'cross-site',
        'content-type': 'application/json',
      },
    });
    const read = await rawRequest(server, {
      method: 'GET',
      path: '/api/ops/status',
      headers: { host, 'sec-fetch-site': 'cross-site' },
    });

    for (const response of [write, read]) {
      expect(response.status).toBe(403);
      expect(errorResponseSchema.parse(response.body).error.code).toBe('forbidden_origin');
    }
  });

  test('E6 /inserate is reachable in this window size (REQ-077)', async ({ page }) => {
    await page.goto('/inserate');
    await expect(page.getByText('Noch keine Modell-Inserate')).toBeVisible();

    await expectReachable(page);
  });

  test('E10 REQ-079 the browser sends requests only to 127.0.0.1', async ({
    page,
    browserRequests,
  }) => {
    await page.goto('/inserate');
    await expect(page.getByText('Noch keine Modell-Inserate')).toBeVisible();
    await page.waitForLoadState('networkidle');

    // The page, its script, style sheet and fonts, and the API calls of the frame.
    expect(browserRequests.length).toBeGreaterThan(1);
    expect(browserRequests.filter((url) => !isLocalRequest(url))).toEqual([]);
  });
});
