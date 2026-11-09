import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import { isLocalRequest } from './fixtures/app-fixture.ts';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));
const READY_LINE = /resellr demo: (http:\/\/127\.0\.0\.1:(\d+)\/) \(data folder (.+)\)/;

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (address === null || typeof address === 'string') throw new Error('No free port');
  return address.port;
}

/**
 * `npm run demo` as documented (CU-004, Baseline 11.3), with `PORT` so it does not collide with
 * a resellr running on 4310. It builds the user interface the matrix projects then serve.
 */
test('E1 npm run demo builds, starts on 127.0.0.1:PORT with a fresh data folder and Chrome shows the frame', async ({
  page,
  context,
}) => {
  test.setTimeout(180_000);
  const port = await freePort();
  // Own process group, so Ctrl+C can be sent to npm, the demo start and the server together.
  const demo = spawn('npm', ['run', 'demo'], {
    cwd: REPO_ROOT,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'inherit'],
    detached: true,
  });
  const exited = new Promise<number | null>((resolve) => demo.once('exit', resolve));
  let output = '';
  demo.stdout.setEncoding('utf8');
  const ready = new Promise<RegExpMatchArray>((resolve, reject) => {
    demo.stdout.on('data', (chunk: string) => {
      output += chunk;
      const match = READY_LINE.exec(output);
      if (match) resolve(match);
    });
    void exited.then((code) => reject(new Error(`npm run demo ended with ${code}:\n${output}`)));
  });

  try {
    const [, url, readyPort, dataDir] = await ready;
    expect(readyPort).toBe(String(port));
    expect(existsSync(`${dataDir}/resellr.db`)).toBe(true);

    const requests: string[] = [];
    context.on('request', (request) => requests.push(request.url()));
    await page.goto(url ?? '');

    await expect(page).toHaveURL(/\/inserate$/);

    await expect(
      page.getByRole('complementary').getByText('resellr', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link'),
    ).toHaveCount(6);
    await expect(page.getByRole('main').getByText('Noch keine Modell-Inserate')).toBeVisible();
    expect(requests.filter((request) => !isLocalRequest(request))).toEqual([]);

    // Ctrl+C stops the server and removes the temporary folder.
    process.kill(-(demo.pid ?? 0), 'SIGINT');
    await expect.poll(() => existsSync(dataDir ?? '')).toBe(false);
    await exited;
  } finally {
    if (demo.exitCode === null && demo.signalCode === null)
      process.kill(-(demo.pid ?? 0), 'SIGKILL');
  }
});
