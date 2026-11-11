import { spawnSync } from 'node:child_process';
import {
  closeSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readSync,
  rmSync,
} from 'node:fs';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { test as base } from '@playwright/test';
import { CONFIG_FILE_NAME } from '@resellr/runtime-shared/configured-port';
import { isInRuntimeFolder } from '@resellr/runtime-shared/paths';
import { createDemoApi, seedDemoData } from '@resellr/test-data/demo-seed';

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
            { syscall: 'openat', path: 'child.txt' },
          ]),
        );
        expect(written.map(({ path }) => path)).not.toContain('only-read.txt');
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

test.describe('REQ-106 no data outside the data folder (Technical Specification 2.19, 6.2)', () => {
  // Both tests use the same server, observed by the project `write-paths` (playwright.config.ts).
  test.describe.configure({ mode: 'serial' });

  test('a complete run writes only in the data, log, handover and update-copy folder', async ({
    page,
    server,
  }) => {
    test.setTimeout(120_000);
    // Use: the demo data of every finished build step through the API (entities, photos, logo,
    // settings), then every area of the navigation in the browser.
    await seedDemoData(createDemoApi(server.baseUrl));
    await page.goto('/');
    const navigation = page.getByRole('navigation', { name: 'Hauptnavigation' });
    for (const label of NAVIGATION) {
      await navigation.getByRole('link', { name: label, exact: true }).click();
      await expect(navigation.getByRole('link', { name: label, exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      );
    }
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
    await server.restart({ testClockAt: new Date(Date.now() + 8 * DAY_MS) });
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

  test('after the run the data folder holds all entities, photos, the logo and all settings, nothing lies outside', ({
    server,
  }) => {
    const { dataDir, handoverDir, updateCopyDir } = server.paths;
    const dataFiles = filesBelow(dataDir).map((file) => relative(dataDir, file));
    expect(dataFiles).toEqual(expect.arrayContaining([DATABASE_FILE, CONFIG_FILE_NAME]));

    const database = new DatabaseSync(join(dataDir, DATABASE_FILE), { readOnly: true });
    try {
      expect(database.prepare('PRAGMA quick_check').get()).toEqual({ quick_check: 'ok' });
      const tables = database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all()
        .map(({ name }) => String(name));
      // Entities and settings (merchant_profile, channel settings, ...) are rows of resellr.db.
      expect(tables).toEqual(
        expect.arrayContaining(['merchant_profile', 'media_file', 'app_meta']),
      );
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

    // Outside the data folder lie only logs, photo handovers and the copies before an update:
    // no database and no config.json except those copies, no image except in the handover folder.
    const outside = [
      ...filesBelow(server.paths.logDir),
      ...filesBelow(handoverDir),
      ...filesBelow(updateCopyDir),
    ];
    const isUpdateCopy = (file: string) => file.startsWith(`${updateCopyDir}/`);
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
  });
});
