import { existsSync, readdirSync, rmSync } from 'node:fs';
import { createServer, type Socket } from 'node:net';
import { join } from 'node:path';

import { INITIAL_DEVICE_TYPES } from '@resellr/seed-data/initial-settings';
import {
  DEMO_ASSIGNMENTS,
  DEMO_DATASHEET_BLOCK_ORDER,
  DEMO_DEVICE_TYPES,
  DEMO_DEVICES,
  DEMO_LISTINGS,
  DEMO_MANUFACTURERS,
  DEMO_MERCHANT_PROFILE,
  DEMO_MODEL_TEMPLATES,
  DEMO_SUPPLIERS,
  DEMO_TEXT_BLOCKS,
  type SeedArea,
} from '@resellr/test-data/demo-seed';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import { type RunningDemo, startDemo } from './run-demo.ts';

/** The 29 tables of Technical Specification 3.1 to 3.3 and the table of the migration run. */
const SCHEMA_TABLES = [
  'app_meta',
  'app_migration',
  'attribute',
  'attribute_mapping',
  'audit_entry',
  'category_mapping',
  'channel',
  'channel_content',
  'condition_code',
  'condition_mapping',
  'datasheet_layout',
  'description_template',
  'device',
  'device_type',
  'listing',
  'listing_delivery_scope',
  'listing_photo',
  'listing_price',
  'manufacturer',
  'media_file',
  'merchant_profile',
  'model_template',
  'pick_list',
  'pick_list_value',
  'price_rule',
  'supplier',
  'text_block',
  'text_block_channel',
  'text_block_device_type',
  'title_pattern',
];

/** Tables the startup itself fills: the migration run and the operating values (CU-285). */
const STARTUP_TABLES = new Set(['app_migration', 'app_meta']);

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (address === null || typeof address === 'string') throw new Error('no port');
  return address.port;
}

describe('startDemo (CU-004)', () => {
  let demo: RunningDemo | undefined;

  afterEach(async () => {
    await demo?.stop();
    demo = undefined;
  });

  it('E2 starts on 127.0.0.1:<PORT> with a fresh data folder, the full schema, the initial settings and the demo data', async () => {
    const port = await freePort();
    demo = await startDemo({ port });

    expect(demo.baseUrl).toBe(`http://127.0.0.1:${port}`);
    const health = await fetch(`${demo.baseUrl}/api/ops/health`);
    expect(await health.json()).toEqual({ state: 'ready', startId: null });

    const db = new Database(join(demo.paths.dataDir, 'resellr.db'), { readonly: true });
    try {
      const tables = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
        )
        .pluck()
        .all();
      expect(tables).toEqual(SCHEMA_TABLES);

      const migrations = db.prepare('SELECT name FROM app_migration').pluck().all();
      expect(migrations).toEqual([
        '20261110_0001_initial_schema',
        '20261110_0002_seed_initial_settings',
      ]);

      const filled = SCHEMA_TABLES.filter((table) => !STARTUP_TABLES.has(table)).filter(
        (table) => db.prepare(`SELECT COUNT(*) FROM ${table}`).pluck().get() !== 0,
      );
      // The initial settings of the seed migration CU-071 and the demo data written through the
      // API on top of them (CU-061): the device types, suppliers, manufacturers, the merchant
      // profile, the text blocks and the datasheet layout of S2, the model templates of S3 and the
      // devices, the model listing and the assignment of S4 with their audit entries.
      expect(filled.sort()).toEqual([
        'attribute',
        'attribute_mapping',
        'audit_entry',
        'channel',
        'datasheet_layout',
        'description_template',
        'device',
        'device_type',
        'listing',
        'manufacturer',
        'merchant_profile',
        'model_template',
        'pick_list',
        'pick_list_value',
        'supplier',
        'text_block',
        'title_pattern',
      ]);
      expect(db.prepare('SELECT name, active FROM device_type ORDER BY sort_order').all()).toEqual([
        ...INITIAL_DEVICE_TYPES.map((name) => ({ name, active: 1 })),
        ...DEMO_DEVICE_TYPES.map(({ name, active }) => ({ name, active: active ? 1 : 0 })),
      ]);
      expect(db.prepare('SELECT name, active FROM supplier ORDER BY id').all()).toEqual(
        DEMO_SUPPLIERS.map(({ name, active }) => ({ name, active: active ? 1 : 0 })),
      );
      expect(db.prepare('SELECT name, active FROM manufacturer ORDER BY id').all()).toEqual(
        DEMO_MANUFACTURERS.map(({ name, active }) => ({ name, active: active ? 1 : 0 })),
      );
      expect(db.prepare('SELECT brand_name, contact_text FROM merchant_profile').all()).toEqual([
        {
          brand_name: DEMO_MERCHANT_PROFILE.brandName,
          contact_text: DEMO_MERCHANT_PROFILE.contactText,
        },
      ]);
      expect(
        db.prepare('SELECT name, kind, body, active FROM text_block ORDER BY id').all(),
      ).toEqual(
        DEMO_TEXT_BLOCKS.map(({ name, kind, body, active }) => ({
          name,
          kind,
          body,
          active: active ? 1 : 0,
        })),
      );
      expect(db.prepare('SELECT block_order FROM datasheet_layout').pluck().all()).toEqual([
        JSON.stringify(DEMO_DATASHEET_BLOCK_ORDER),
      ]);
      expect(
        db.prepare('SELECT model_name, mpn, mpn_unknown FROM model_template ORDER BY id').all(),
      ).toEqual(
        DEMO_MODEL_TEMPLATES.map(({ modelName, mpn }) => ({
          model_name: modelName,
          mpn,
          mpn_unknown: mpn === null ? 1 : 0,
        })),
      );
      // The demo model listing comes from device "626198"; device "626200" is assigned to it
      // (quantity 2), the other devices stay unassigned.
      const listings = db
        .prepare('SELECT id, article_number, quantity FROM listing ORDER BY id')
        .all() as { id: number; article_number: string; quantity: number }[];
      expect(listings).toEqual(
        DEMO_LISTINGS.map(({ fromWiNr }) => ({
          id: expect.any(Number),
          article_number: fromWiNr,
          quantity: 1 + DEMO_ASSIGNMENTS.filter((a) => a.listingOfWiNr === fromWiNr).length,
        })),
      );
      const listingOf = (wiNr: string) =>
        wiNr === '626198' || DEMO_ASSIGNMENTS.some(({ device }) => device.wiNr === wiNr)
          ? listings[0]?.id
          : null;
      expect(
        db.prepare('SELECT wi_nr, listing_id, stock_status FROM device ORDER BY id').all(),
      ).toEqual(
        [...DEMO_DEVICES, ...DEMO_ASSIGNMENTS.map(({ device }) => device)].map(({ wiNr }) => ({
          wi_nr: wiNr,
          listing_id: listingOf(wiNr),
          stock_status: 'available',
        })),
      );
    } finally {
      db.close();
    }
  });

  it('gives every run its own temporary folder and removes it when stopped', async () => {
    const first = await startDemo({ port: await freePort() });
    const second = await startDemo({ port: await freePort() });
    try {
      expect(first.root).not.toBe(second.root);
    } finally {
      await second.stop();
    }
    await first.stop();

    expect(existsSync(first.root)).toBe(false);
    expect(existsSync(second.root)).toBe(false);
  });

  it('E1 writes the demo data only after ready, and stops the server and names the kept folder when that fails', async () => {
    const port = await freePort();
    const healthDuringSeed: unknown[] = [];
    const failingArea: SeedArea = async (api) => {
      healthDuringSeed.push(await api.request('GET', '/api/ops/health'));
      throw new Error('seed failed');
    };

    const error = await startDemo({ port, seedAreas: [failingArea] }).then(
      (started) => void (demo = started),
      (caught: unknown) => caught,
    );

    expect(healthDuringSeed).toEqual([{ state: 'ready', startId: null }]);
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toMatch(/^seed failed; temporary folder with the logs: /);
    const root = /temporary folder with the logs: (.+)$/.exec(message)?.[1] ?? '';
    // The server is stopped and no longer holds the port; the folder stays for its logs.
    await expect(fetch(`http://127.0.0.1:${port}/api/ops/health`)).rejects.toThrow();
    expect(existsSync(join(root, 'Daten', 'resellr.db'))).toBe(true);
    rmSync(root, { recursive: true, force: true });
  });

  it('stops and names the kept temporary folder when the port is taken', async () => {
    // Another program on the port that accepts connections but never answers.
    const sockets: Socket[] = [];
    const blocker = createServer((socket) => sockets.push(socket));
    await new Promise<void>((resolve) => blocker.listen(0, '127.0.0.1', resolve));
    const address = blocker.address();
    if (address === null || typeof address === 'string') throw new Error('no port');

    let error: unknown;
    try {
      await startDemo({ port: address.port }).catch((caught: unknown) => (error = caught));
    } finally {
      sockets.forEach((socket) => socket.destroy());
      await new Promise<void>((resolve) => blocker.close(() => resolve()));
    }

    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain('exit code 10');
    const root = /temporary folder with the logs: (.+)$/.exec(message)?.[1] ?? '';
    // The error log in the kept folder says why the start was aborted (2.19 step 8).
    expect(readdirSync(join(root, 'Protokolle')).length).toBeGreaterThan(0);
    rmSync(root, { recursive: true, force: true });
  }, 15_000);
});
