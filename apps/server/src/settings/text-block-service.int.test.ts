import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { openDatabase, type Database } from '../db/database.ts';
import { runMigrations } from '../db/migrator.ts';
import { initialSchema } from '../db/migrations/20261110_0001_initial_schema.ts';
import type { DB } from '../db/schema.ts';
import { createUnitOfWork, emptyChangeReport } from '../db/unit-of-work.ts';
import type { Clock } from '../shared/clock.ts';
import type { SettingsChanged } from '../shared/events.ts';
import { createTextBlockService } from './text-block-service.ts';

const NOW = new Date('2026-11-13T09:15:00.000Z');
const clock: Clock = { now: () => NOW, today: () => '2026-11-13' };

let dir: string;
let database: Database<DB>;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'resellr-text-block-'));
  database = openDatabase<DB>(join(dir, 'resellr.db'));
  await runMigrations(database, [initialSchema], () => NOW);
});

afterEach(async () => {
  await database.close();
  rmSync(dir, { recursive: true, force: true });
});

const AT = '2026-11-10T08:00:00.000Z';

/** Two device types and the three channels of the initial settings, ids in insert order. */
function insertTargets() {
  const deviceType = database.sqlite.prepare(
    `INSERT INTO device_type (name, name_key, active, sort_order, version, created_at, updated_at) VALUES (?, ?, 1, ?, 1, '${AT}', '${AT}')`,
  );
  const [notebook, smartphone] = ['Notebook', 'Smartphone'].map(
    (name, index) => deviceType.run(name, name.toLowerCase(), index + 1).lastInsertRowid as number,
  ) as [number, number];
  const channel = database.sqlite.prepare(
    `INSERT INTO channel (code, name, active, title_max_length, vb_allowed, sort_order, condition_mappings_version, version, created_at, updated_at) VALUES (?, ?, 1, 80, 0, ?, 1, 1, '${AT}', '${AT}')`,
  );
  const [shop, kleinanzeigen, ebay] = ['Shop', 'Kleinanzeigen', 'eBay'].map(
    (name, index) => channel.run(name.toLowerCase(), name, index + 1).lastInsertRowid as number,
  ) as [number, number, number];
  return { notebook, smartphone, shop, kleinanzeigen, ebay };
}

/** The service with a handler that records each `SettingsChanged` and the stored scope. */
function recordingService() {
  const seen: { event: SettingsChanged; channelsInTransaction: number[] }[] = [];
  const uow = createUnitOfWork(database.db, {
    change: {
      SettingsChanged: async (event, tx) => {
        const rows = await tx.db.selectFrom('text_block_channel').select('channel_id').execute();
        seen.push({ event, channelsInTransaction: rows.map(({ channel_id }) => channel_id) });
        return emptyChangeReport();
      },
    },
  });
  return { service: createTextBlockService({ db: database.db, uow, clock }), seen };
}

const textBlock = {
  name: 'Abholung',
  kind: 'pickup_contact',
  body: 'Abholung nach Absprache.',
} as const;

describe('text block service: SettingsChanged (CU-082, Technical Specification 2.2, 2.8.3)', () => {
  it('a new text block reports its scope, "alle" resolved to every device type and channel', async () => {
    const { notebook, smartphone, kleinanzeigen } = insertTargets();
    const { service, seen } = recordingService();

    await service.create({
      ...textBlock,
      allDeviceTypes: true,
      deviceTypeIds: [],
      allChannels: false,
      channelIds: [kleinanzeigen],
    });

    expect(seen).toEqual([
      {
        event: {
          type: 'SettingsChanged',
          scope: {
            kind: 'text_block',
            deviceTypeIds: [notebook, smartphone],
            channelIds: [kleinanzeigen],
          },
        },
        channelsInTransaction: [kleinanzeigen],
      },
    ]);
  });

  it('"alle" is resolved also to deactivated device types and channels', async () => {
    const { notebook, smartphone, shop, kleinanzeigen, ebay } = insertTargets();
    database.sqlite.prepare('UPDATE device_type SET active = 0 WHERE id = ?').run(smartphone);
    database.sqlite.prepare('UPDATE channel SET active = 0 WHERE id = ?').run(ebay);
    const { service, seen } = recordingService();

    await service.create({
      ...textBlock,
      allDeviceTypes: true,
      deviceTypeIds: [],
      allChannels: true,
      channelIds: [],
    });

    expect(seen.map(({ event }) => event.scope)).toEqual([
      {
        kind: 'text_block',
        deviceTypeIds: [notebook, smartphone],
        channelIds: [shop, kleinanzeigen, ebay],
      },
    ]);
  });

  it('a change of the legal check status alone reports no event', async () => {
    insertTargets();
    const { service, seen } = recordingService();
    const { textBlock: created } = await service.create({
      ...textBlock,
      kind: 'legal',
      allDeviceTypes: true,
      deviceTypeIds: [],
      allChannels: true,
      channelIds: [],
    });
    seen.length = 0;

    const { textBlock: changed } = await service.update(created.id, {
      version: 1,
      legalStatus: 'checked',
      legalCheckedOn: '2026-11-05',
      legalCheckedBy: 'Kanzlei Muster',
    });

    expect(changed).toMatchObject({ legalStatus: 'checked', version: 2 });
    expect(seen).toEqual([]);
  });

  it('a change reports the old and the new scope together in one event', async () => {
    const { notebook, smartphone, shop, kleinanzeigen } = insertTargets();
    const { service, seen } = recordingService();
    const { textBlock: created } = await service.create({
      ...textBlock,
      allDeviceTypes: false,
      deviceTypeIds: [notebook],
      allChannels: false,
      channelIds: [shop],
    });
    seen.length = 0;

    await service.update(created.id, {
      version: 1,
      deviceTypeIds: [smartphone],
      channelIds: [kleinanzeigen],
    });

    expect(seen).toEqual([
      {
        event: {
          type: 'SettingsChanged',
          scope: {
            kind: 'text_block',
            deviceTypeIds: [notebook, smartphone],
            channelIds: [shop, kleinanzeigen],
          },
        },
        channelsInTransaction: [kleinanzeigen],
      },
    ]);
  });

  it('a change of the text or a deactivation reports the unchanged scope', async () => {
    const { notebook, ebay } = insertTargets();
    const { service, seen } = recordingService();
    const { textBlock: created } = await service.create({
      ...textBlock,
      allDeviceTypes: false,
      deviceTypeIds: [notebook],
      allChannels: false,
      channelIds: [ebay],
    });
    seen.length = 0;

    await service.update(created.id, { version: 1, body: 'Neu' });
    await service.update(created.id, { version: 2, active: false });

    const scope = { kind: 'text_block', deviceTypeIds: [notebook], channelIds: [ebay] };
    expect(seen.map(({ event }) => event)).toEqual([
      { type: 'SettingsChanged', scope },
      { type: 'SettingsChanged', scope },
    ]);
  });

  it('a save without a difference reports nothing', async () => {
    insertTargets();
    const { service, seen } = recordingService();
    const { textBlock: created } = await service.create({
      ...textBlock,
      allDeviceTypes: true,
      deviceTypeIds: [],
      allChannels: true,
      channelIds: [],
    });
    seen.length = 0;

    await service.update(created.id, { version: 1, body: textBlock.body, allChannels: true });

    expect(seen).toEqual([]);
  });
});
