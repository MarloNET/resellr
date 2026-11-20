import { spawnSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { test as base } from '@playwright/test';
import { CONFIG_FILE_NAME } from '@resellr/runtime-shared/configured-port';
import { isInRuntimeFolder } from '@resellr/runtime-shared/paths';
import { createDemoApi, type DemoApi, seedDemoData } from '@resellr/test-data/demo-seed';

import {
  expect,
  fileWriteTraceArgs,
  parseFileWrites,
  readFileWrites,
  requireStrace,
  test,
} from './fixtures/app-fixture.ts';

const DATABASE_FILE = 'resellr.db';
const NAVIGATION = [
  'Inserate',
  'Gerät einbuchen',
  'Modell-Bibliothek',
  'Geräte',
  'Änderungsprotokoll',
  'Einstellungen',
];
const DAY_MS = 24 * 60 * 60 * 1000;
/** Version stored before the second start, so it runs as the first start after an update (2.19 step 5). */
const OLDER_APP_VERSION = '0.0.0';
/** First bytes of every SQLite database file. */
const SQLITE_HEADER = 'SQLite format 3\0';
/** Signatures of the photo and logo files (JPEG, PNG; 2.11). */
const IMAGE_SIGNATURES = [Buffer.from([0xff, 0xd8, 0xff]), Buffer.from('89504e470d0a1a0a', 'hex')];

/** Every file below `dir`, recursively; a missing folder has none. */
function filesBelow(dir: string): string[] {
  try {
    return readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => join(entry.parentPath, entry.name));
  } catch {
    return [];
  }
}

function startsWith(file: string, prefix: Buffer): boolean {
  const head = Buffer.alloc(prefix.length);
  const fd = openSync(file, 'r');
  try {
    return readSync(fd, head, 0, prefix.length, 0) === prefix.length && head.equals(prefix);
  } finally {
    closeSync(fd);
  }
}

base.describe('REQ-106 observation of the file writes (Technical Specification 6.2)', () => {
  base(
    'reports every kind of write of a process and its children with the absolute path, no read',
    () => {
      requireStrace();
      const dir = mkdtempSync(join(tmpdir(), 'resellr-writes-'));
      try {
        const traceDir = join(dir, 'trace');
        mkdirSync(traceDir);
        mkdirSync(join(dir, 'Fotoübergabe'));
        writeFileSync(join(dir, 'only-read.txt'), 'x');
        writeFileSync(join(dir, 'attributes.txt'), 'x');
        const script = `
        import { spawnSync } from 'node:child_process';
        import fs from 'node:fs';
        import { DatabaseSync } from 'node:sqlite';
        fs.writeFileSync('Fotoübergabe/a "b".txt', 'x');
        fs.appendFileSync(${JSON.stringify(join(dir, 'append.jsonl'))}, 'x');
        fs.mkdirSync('made');
        fs.renameSync('made', 'moved');
        fs.rmdirSync('moved');
        fs.readFileSync('only-read.txt');
        const fd = fs.openSync('attributes.txt', 'r');
        fs.fchmodSync(fd, 0o600);
        fs.closeSync(fd);
        fs.utimesSync('attributes.txt', 1, 1);
        const db = new DatabaseSync('native.db');
        db.exec('PRAGMA journal_mode = WAL; CREATE TABLE t (x); INSERT INTO t VALUES (1)');
        db.close();
        fs.unlinkSync('Fotoübergabe/a "b".txt');
        fs.mkdirSync('target');
        fs.symlinkSync('target', 'linked');
        fs.writeFileSync('linked/through.txt', 'x');
        spawnSync(process.execPath, ['-e', "require('node:fs').writeFileSync('child.txt', 'x')"]);
      `;
        const result = spawnSync(
          'strace',
          [
            ...fileWriteTraceArgs(join(traceDir, 'probe')),
            '--',
            process.execPath,
            '--input-type=module',
            '-e',
            script,
          ],
          { cwd: dir, stdio: ['ignore', 'ignore', 'inherit'] },
        );
        expect(result.status).toBe(0);

        const written = readFileWrites(traceDir, dir).map(({ syscall, path }) => ({
          syscall,
          path: relative(dir, path),
        }));

        expect(written).toEqual(
          expect.arrayContaining([
            { syscall: 'openat', path: 'Fotoübergabe/a "b".txt' },
            { syscall: 'openat', path: 'append.jsonl' },
            { syscall: 'mkdir', path: 'made' },
            { syscall: 'rename', path: 'made' },
            { syscall: 'rename', path: 'moved' },
            { syscall: 'rmdir', path: 'moved' },
            { syscall: 'fchmod', path: 'attributes.txt' },
            { syscall: 'utimensat', path: 'attributes.txt' },
            { syscall: 'openat', path: 'native.db' },
            { syscall: 'openat', path: 'native.db-wal' },
            { syscall: 'unlink', path: 'Fotoübergabe/a "b".txt' },
            { syscall: 'symlink', path: 'linked' },
            // Seen at the target of the link, not at the link (FIND-321).
            { syscall: 'openat', path: 'target/through.txt' },
            { syscall: 'openat', path: 'child.txt' },
          ]),
        );
        const paths = written.map(({ path }) => path);
        expect(paths).not.toContain('only-read.txt');
        expect(paths).not.toContain('linked/through.txt');
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );

  base(
    'resolves paths relative to folder descriptors and fails on a line it does not understand',
    () => {
      const trace = [
        'openat2(3</data>, "media/x.jpg", {flags=O_WRONLY|O_CREAT, mode=0644, resolve=0}, 24) = 4</data/media/x.jpg>',
        'openat(AT_FDCWD</cwd>, "../config.json", O_RDONLY|O_CLOEXEC) = 5</config.json>',
        // A link in an allowed folder pointing outside: the path the kernel resolved counts.
        'openat(3</data>, "link/x.json", O_WRONLY|O_CREAT|O_TRUNC|O_CLOEXEC, 0666) = 6</outside/x.json>',
        'creat("/data/link.txt", 0644) = 7</outside/link.txt>',
        'renameat2(3</data>, "a.tmp", 4</logs>, "b", RENAME_NOREPLACE) = 0',
        'linkat(AT_FDCWD</cwd>, "a", 3</data>, "b", 0) = 0',
        'unlinkat(3</data/media/.incoming>, "upload", 0) = 0',
        'utimensat(7</data/resellr.db>, NULL, NULL, 0) = 0',
        'mkdir("Protokolle", 0777) = 0',
        'symlinkat("/etc/passwd", AT_FDCWD</cwd>, "link") = 0',
        // A call cut off by the end of the process counts; its result is unknown.
        'openat(AT_FDCWD</cwd>, "/logs/x.jsonl", O_WRONLY|O_APPEND <unfinished ...>) = ?',
      ].join('\n');

      expect(parseFileWrites(trace, '/start')).toEqual([
        { syscall: 'openat2', path: '/data/media/x.jpg' },
        { syscall: 'openat', path: '/outside/x.json' },
        { syscall: 'creat', path: '/outside/link.txt' },
        { syscall: 'renameat2', path: '/data/a.tmp' },
        { syscall: 'renameat2', path: '/logs/b' },
        { syscall: 'linkat', path: '/data/b' },
        { syscall: 'unlinkat', path: '/data/media/.incoming/upload' },
        { syscall: 'utimensat', path: '/data/resellr.db' },
        { syscall: 'mkdir', path: '/start/Protokolle' },
        { syscall: 'symlinkat', path: '/cwd/link' },
        { syscall: 'openat', path: '/logs/x.jsonl' },
      ]);
      expect(() => parseFileWrites('write(1</dev/pts/0>, "x", 1) = 1', '/')).toThrow(
        /Unexpected line/,
      );
    },
  );
});

/** A changing request of the demo data (CU-061), as it went to the API, with its answer. */
interface SeedWrite {
  method: string;
  path: string;
  body: unknown;
  answer: unknown;
}

/** The demo API, recording every changing request with its answer in `writes`. */
function recordingDemoApi(baseUrl: string, writes: SeedWrite[]): DemoApi {
  const api = createDemoApi(baseUrl);
  return {
    ...api,
    request: async <T>(method: string, path: string, body?: unknown): Promise<T> => {
      const answer = await api.request<T>(method, path, body);
      if (method !== 'GET' && method !== 'HEAD') writes.push({ method, path, body, answer });
      return answer;
    },
  };
}

/**
 * Collections whose plain `GET` leaves out seeded entries, with the read that shows all of them:
 * a list with `includeInactive` returns its deactivated entries only on request (2.2).
 */
const READ_PATHS: Record<string, string> = {
  '/api/manufacturers': '/api/manufacturers?includeInactive=true',
  '/api/suppliers': '/api/suppliers?includeInactive=true',
};

/**
 * Collections whose list answer leaves out fields of its entries, so every entry is also read in
 * full with `GET {path}/{id}`: the model-template list carries no original EAN (2.4).
 */
const DETAIL_PATHS = new Set(['/api/model-templates']);

/**
 * Collections without a list read yet, so each created entry is read with `GET {path}/{id}` by
 * the id of its answer: the devices, whose search follows with #187.
 */
const ENTRY_PATHS = new Set(['/api/devices']);

/**
 * Collections without any read of their own yet, with the read that shows each created entry by
 * the body of its request: a model listing through the device it was created from (`listing` of
 * `GET /api/devices/{id}`, 2.5); the reads of the listings follow with #198.
 */
const VIA_PATHS: Record<string, (body: unknown) => string> = {
  '/api/listings': (body) => `/api/devices/${(body as { fromDeviceId: number }).fromDeviceId}`,
};

/**
 * Actions on a single entry, with the read of the entry that shows their result: an assignment
 * through the device (`listing` of `GET /api/devices/{id}`, 2.5, 2.6).
 */
const ACTION_PATHS: [RegExp, (path: string) => string][] = [
  [/^\/api\/devices\/\d+\/assignment$/, (path) => path.replace(/\/assignment$/, '')],
];

/**
 * What the user sees of the seeded data: the answer of `GET` on every collection the demo data
 * created entries in and on every single resource it saved (`PUT`, e.g. the merchant profile). A
 * seed area that writes to a path without `GET` fails here and has to name how its data is read
 * (`READ_PATHS`, `DETAIL_PATHS`, `ENTRY_PATHS`, `VIA_PATHS`, `ACTION_PATHS`).
 */
async function readSeededState(baseUrl: string, writes: SeedWrite[]): Promise<unknown> {
  const api = createDemoApi(baseUrl);
  const collections = [
    ...new Set(writes.filter((w) => w.method === 'POST' || w.method === 'PUT').map((w) => w.path)),
  ];
  const state: Record<string, unknown> = {};
  for (const path of collections.sort()) {
    if (ENTRY_PATHS.has(path)) {
      for (const { answer } of writes.filter((w) => w.method === 'POST' && w.path === path)) {
        const { id } = answer as { id: number };
        state[`${path}/${id}`] = await api.request('GET', `${path}/${id}`);
      }
      continue;
    }
    const action = ACTION_PATHS.find(([pattern]) => pattern.test(path));
    if (action !== undefined) {
      const read = action[1](path);
      state[`${path} via ${read}`] = await api.request('GET', read);
      continue;
    }
    const via = VIA_PATHS[path];
    if (via !== undefined) {
      for (const { body } of writes.filter((w) => w.method === 'POST' && w.path === path)) {
        state[`${path} via ${via(body)}`] = await api.request('GET', via(body));
      }
      continue;
    }
    const list = await api.request<{ items: { id: number }[] }>('GET', READ_PATHS[path] ?? path);
    state[path] = list;
    if (DETAIL_PATHS.has(path)) {
      for (const { id } of list.items) {
        state[`${path}/${id}`] = await api.request('GET', `${path}/${id}`);
      }
    }
  }
  return state;
}

/** Text values shorter than this are too common to tell seeded data from other content. */
const MIN_SEEDED_TEXT_LENGTH = 4;

/** Every text value of the seeded requests that is long enough to be recognised in any file. */
function seededTexts(writes: SeedWrite[]): string[] {
  const texts = new Set<string>();
  const collect = (value: unknown): void => {
    if (typeof value === 'string' && value.length >= MIN_SEEDED_TEXT_LENGTH) texts.add(value);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value !== null && typeof value === 'object') Object.values(value).forEach(collect);
  };
  writes.forEach(({ body }) => collect(body));
  return [...texts];
}

/** The texts that occur in `file` as UTF-8 or UTF-16 (whatever the format of the file is). */
function textsIn(file: string, texts: string[]): string[] {
  const content = readFileSync(file);
  return texts.filter(
    (text) =>
      content.includes(Buffer.from(text, 'utf8')) || content.includes(Buffer.from(text, 'utf16le')),
  );
}

test.describe('REQ-106 no data outside the data folder (Technical Specification 2.19, 6.2)', () => {
  // Both tests use the same server, observed by the project `write-paths` (playwright.config.ts).
  test.describe.configure({ mode: 'serial' });

  /** Handed from the run to the check of the data folder. */
  const run = {
    writes: [] as SeedWrite[],
    stateBeforeEnd: undefined as unknown,
    clock: new Date(Date.now() + 8 * DAY_MS),
  };

  test('a complete run writes only in the data, log, handover and update-copy folder', async ({
    page,
    server,
  }) => {
    test.setTimeout(120_000);
    // Use: the demo data of every finished build step through the API (entities, photos, logo,
    // settings), then every area of the navigation in the browser.
    await seedDemoData(recordingDemoApi(server.baseUrl, run.writes));
    await page.goto('/');
    const navigation = page.getByRole('navigation', { name: 'Hauptnavigation' });
    for (const label of NAVIGATION) {
      await navigation.getByRole('link', { name: label, exact: true }).click();
      await expect(navigation.getByRole('link', { name: label, exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      );
    }
    run.stateBeforeEnd = await readSeededState(server.baseUrl, run.writes);
    // Orderly end with checkpoint and end marker (2.17).
    await server.shutdown();

    // Next start as the first start after an update (copy before the update, 2.19 step 5), eight
    // days later, so the housekeeping of the handover and log folder has something to delete.
    const database = new DatabaseSync(join(server.paths.dataDir, DATABASE_FILE));
    database
      .prepare(
        "INSERT INTO app_meta (key, value) VALUES ('app_version', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
      )
      .run(OLDER_APP_VERSION);
    database.close();
    await server.restart({ testClockAt: run.clock });
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible();
    await server.shutdown();

    const writes = server.fileWrites();
    expect(writes.filter(({ path }) => !isInRuntimeFolder(path, server.paths))).toEqual([]);
    // The observation saw the run: the database and the operations log were written.
    const paths = writes.map(({ path }) => path);
    expect(paths).toContain(join(server.paths.dataDir, DATABASE_FILE));
    expect(paths.some((path) => path.startsWith(`${server.paths.logDir}/`))).toBe(true);
  });

  test('after the run the data folder holds all entities, photos, the logo and all settings, nothing lies outside', async ({
    server,
  }) => {
    const { dataDir, logDir, handoverDir, updateCopyDir } = server.paths;
    const texts = seededTexts(run.writes);
    // Without seeded texts the checks below would prove nothing.
    expect(texts.length, 'seeded text values').toBeGreaterThan(0);

    const dataFiles = filesBelow(dataDir).map((file) => relative(dataDir, file));
    const database = new DatabaseSync(join(dataDir, DATABASE_FILE), { readOnly: true });
    try {
      expect(database.prepare('PRAGMA quick_check').get()).toEqual({ quick_check: 'ok' });
      // Every photo and the logo the database knows lies as a file below media in the data folder.
      const mediaFiles = database.prepare('SELECT hash, kind FROM media_file').all();
      for (const { hash, kind } of mediaFiles) {
        const folder = kind === 'logo' ? 'media/logo/' : 'media/photos/';
        expect(
          dataFiles.some((file) => file.startsWith(folder) && file.includes(String(hash))),
          `${kind} ${String(hash)} in the data folder`,
        ).toBe(true);
      }
    } finally {
      database.close();
    }

    // Outside the data folder lie only logs, photo handovers and the copies of the data folder
    // before an update (2.19). No seeded value lies as UTF-8 or UTF-16 text in a log or handover
    // file, whatever the file format (JSON, log lines, ...); the binary forms are recognised by
    // their signature: no database and no config.json except the update copies, no image except
    // in the handover folder.
    const outside = [
      ...filesBelow(logDir),
      ...filesBelow(handoverDir),
      ...filesBelow(updateCopyDir),
    ];
    const isUpdateCopy = (file: string) => file.startsWith(`${updateCopyDir}/`);
    expect(
      outside
        .filter((file) => !isUpdateCopy(file))
        .map((file) => ({ file, texts: textsIn(file, texts) }))
        .filter(({ texts: found }) => found.length > 0),
    ).toEqual([]);
    expect(
      outside.filter(
        (file) =>
          !isUpdateCopy(file) &&
          (startsWith(file, Buffer.from(SQLITE_HEADER)) || file.endsWith(`/${CONFIG_FILE_NAME}`)),
      ),
    ).toEqual([]);
    expect(
      outside.filter(
        (file) =>
          !file.startsWith(`${handoverDir}/`) &&
          IMAGE_SIGNATURES.some((signature) => startsWith(file, signature)),
      ),
    ).toEqual([]);

    // The data folder alone holds everything: a start with the log, handover and update-copy
    // folder moved away shows the same seeded data as the run before its end.
    for (const dir of [logDir, handoverDir, updateCopyDir]) {
      if (existsSync(dir)) renameSync(dir, `${dir}.after-run`);
    }
    await server.restart({ testClockAt: run.clock });
    const state = await readSeededState(server.baseUrl, run.writes);
    expect(state).toEqual(run.stateBeforeEnd);
    const shown = JSON.stringify(state);
    expect(texts.filter((text) => !shown.includes(JSON.stringify(text).slice(1, -1)))).toEqual([]);
    await server.shutdown();
  });
});
