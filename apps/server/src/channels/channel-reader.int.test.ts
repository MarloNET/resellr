import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestApp } from '../../test/test-app.ts';
import { migrations } from '../db/migrations/index.ts';
import { runMigrations } from '../db/migrator.ts';
import { createChannelReader } from './channel-reader.ts';

// Integration tests of `findChannel` (CU-161, CU-160; Technical Specification 2.7, Nachtrag
// MAR-1171) on the initial channels of the seed migration: only Kleinanzeigen allows
// "Verhandlungsbasis".

type TestApp = ReturnType<typeof createTestApp>;
let t: TestApp;

beforeEach(async () => {
  t = createTestApp();
  await runMigrations(t.database, migrations, () => new Date());
});

afterEach(async () => {
  await t.close();
});

const channelId = (code: string) =>
  (t.database.sqlite.prepare('SELECT id FROM channel WHERE code = ?').get(code) as { id: number })
    .id;

describe('findChannel (CU-161)', () => {
  it('returns a known channel with its name and whether it allows "Verhandlungsbasis"', async () => {
    const reader = createChannelReader(t.database.db);

    expect(await reader.findChannel(channelId('kleinanzeigen'))).toEqual({
      id: channelId('kleinanzeigen'),
      name: 'Kleinanzeigen',
      vbAllowed: true,
    });
    expect(await reader.findChannel(channelId('shop'))).toEqual({
      id: channelId('shop'),
      name: 'Shop',
      vbAllowed: false,
    });
  });

  it('returns a deactivated channel as well', async () => {
    t.database.sqlite.prepare("UPDATE channel SET active = 0 WHERE code = 'ebay'").run();

    expect(await createChannelReader(t.database.db).findChannel(channelId('ebay'))).toEqual({
      id: channelId('ebay'),
      name: 'eBay',
      vbAllowed: false,
    });
  });

  it('returns undefined for an unknown id', async () => {
    expect(await createChannelReader(t.database.db).findChannel(999)).toBeUndefined();
  });
});
