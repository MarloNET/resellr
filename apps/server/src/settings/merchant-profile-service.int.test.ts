import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openDatabase, type Database } from '../db/database.ts';
import { runMigrations } from '../db/migrator.ts';
import { initialSchema } from '../db/migrations/20261110_0001_initial_schema.ts';
import type { DB } from '../db/schema.ts';
import { createUnitOfWork, emptyChangeReport, type EventHandlers } from '../db/unit-of-work.ts';
import type { Clock } from '../shared/clock.ts';
import type { SettingsChanged } from '../shared/events.ts';
import { createMerchantProfileService } from './merchant-profile-service.ts';

const NOW = new Date('2026-11-12T09:15:00.000Z');
const clock: Clock = { now: () => NOW, today: () => '2026-11-12' };

let dir: string;
let database: Database<DB>;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'resellr-merchant-profile-'));
  database = openDatabase<DB>(join(dir, 'resellr.db'));
  // Schema only: the tests write their own settings; the initial settings have their own
  // tests (CU-071).
  await runMigrations(database, [initialSchema], () => NOW);
});

afterEach(async () => {
  await database.close();
  rmSync(dir, { recursive: true, force: true });
});

function serviceWith(handlers: EventHandlers<DB> = {}) {
  const uow = createUnitOfWork(database.db, handlers);
  return createMerchantProfileService({ db: database.db, uow, clock });
}

const profileRows = () =>
  database.sqlite
    .prepare(
      'SELECT id, brand_name, contact_text, logo_hash, version, updated_at FROM merchant_profile',
    )
    .all();

const auditRows = () =>
  database.sqlite
    .prepare(
      'SELECT object_type, object_category, object_id, object_label, action, old_value, new_value, occurred_at FROM audit_entry ORDER BY id',
    )
    .all();

/** The empty row of the seed migration (#150, Technical Specification 3.8). */
const insertEmptyRow = () =>
  database.sqlite.exec(
    "INSERT INTO merchant_profile (id, brand_name, contact_text, logo_hash, version, updated_at) VALUES (1, '', '', NULL, 1, '2026-11-10T08:00:00.000Z')",
  );

describe('merchant profile service (CU-084)', () => {
  it('reads the empty profile with version 1 while the seed row is missing', async () => {
    expect(await serviceWith().get()).toEqual({
      brandName: '',
      contactText: '',
      logo: null,
      version: 1,
    });
  });

  it('reads the empty row of the seed in the same way', async () => {
    insertEmptyRow();

    expect(await serviceWith().get()).toEqual({
      brandName: '',
      contactText: '',
      logo: null,
      version: 1,
    });
  });

  it.each([
    ['without the seed row', () => {}],
    ['with the empty seed row', insertEmptyRow],
  ])('stores name and contact details as the single row %s', async (_case, prepare) => {
    prepare();

    const saved = await serviceWith().update({
      version: 1,
      brandName: 'Muster-Händler',
      contactText: 'Tel. 0761 1234',
    });

    expect(saved).toEqual({
      brandName: 'Muster-Händler',
      contactText: 'Tel. 0761 1234',
      logo: null,
      version: 2,
    });
    expect(profileRows()).toEqual([
      {
        id: 1,
        brand_name: 'Muster-Händler',
        contact_text: 'Tel. 0761 1234',
        logo_hash: null,
        version: 2,
        updated_at: NOW.toISOString(),
      },
    ]);
  });

  it('shows a stored logo with its address under /media/logo', async () => {
    const hash = 'a'.repeat(64);
    database.sqlite.exec(
      `INSERT INTO media_file (hash, kind, ext, mime, byte_size, width, height, created_at)
         VALUES ('${hash}', 'logo', 'png', 'image/png', 10, 1, 1, '2026-11-10T08:00:00.000Z')`,
    );
    database.sqlite.exec(
      `INSERT INTO merchant_profile (id, brand_name, contact_text, logo_hash, version, updated_at) VALUES (1, 'B', '', '${hash}', 3, '2026-11-10T08:00:00.000Z')`,
    );

    expect((await serviceWith().get()).logo).toEqual({ hash, url: `/media/logo/${hash}` });
  });

  it('writes one audit entry with the changed fields only', async () => {
    const service = serviceWith();
    await service.update({ version: 1, brandName: 'Muster-Händler', contactText: '' });
    await service.update({ version: 2, brandName: 'Muster-Händler', contactText: 'Tel. 1' });

    expect(auditRows()).toEqual([
      {
        object_type: 'merchant_profile',
        object_category: 'settings',
        object_id: 1,
        object_label: 'Händlermarke',
        action: 'updated',
        old_value: JSON.stringify({ Name: '' }),
        new_value: JSON.stringify({ Name: 'Muster-Händler' }),
        occurred_at: NOW.toISOString(),
      },
      {
        object_type: 'merchant_profile',
        object_category: 'settings',
        object_id: 1,
        object_label: 'Händlermarke',
        action: 'updated',
        old_value: JSON.stringify({ Kontaktangaben: '' }),
        new_value: JSON.stringify({ Kontaktangaben: 'Tel. 1' }),
        occurred_at: NOW.toISOString(),
      },
    ]);
  });

  it('rejects an outdated version with version_conflict and keeps the stored profile', async () => {
    const service = serviceWith();
    await service.update({ version: 1, brandName: 'B1', contactText: '' });

    await expect(
      service.update({ version: 1, brandName: 'B2', contactText: '' }),
    ).rejects.toMatchObject({ code: 'version_conflict' });

    expect(await service.get()).toMatchObject({ brandName: 'B1', version: 2 });
    expect(auditRows()).toHaveLength(1);
  });

  it('stores, logs and reports nothing when nothing changed', async () => {
    const handler = vi.fn(async () => emptyChangeReport());
    const service = serviceWith({ change: { SettingsChanged: handler } });
    await service.update({ version: 1, brandName: 'B', contactText: 'K' });
    handler.mockClear();

    expect(await service.update({ version: 2, brandName: 'B', contactText: 'K' })).toMatchObject({
      version: 2,
    });

    expect(handler).not.toHaveBeenCalled();
    expect(auditRows()).toHaveLength(1);
  });

  it.each([
    ['the name', { brandName: 'Muster-Händler', contactText: '' }],
    ['the contact details', { brandName: '', contactText: 'Tel. 0761 1234' }],
  ])(
    'DER-42-11 a change of %s reports SettingsChanged for all channel contents in the same transaction',
    async (_case, change) => {
      insertEmptyRow();
      const seen: { event: SettingsChanged; rowInTransaction: unknown }[] = [];
      const service = serviceWith({
        change: {
          SettingsChanged: async (event, tx) => {
            const row = await tx.db
              .selectFrom('merchant_profile')
              .select(['brand_name', 'contact_text'])
              .executeTakeFirst();
            seen.push({ event, rowInTransaction: row });
            return emptyChangeReport();
          },
        },
      });

      await service.update({ version: 1, ...change });

      expect(seen).toEqual([
        {
          event: { type: 'SettingsChanged', scope: { kind: 'all' } },
          rowInTransaction: { brand_name: change.brandName, contact_text: change.contactText },
        },
      ]);
    },
  );

  it('DER-42-11 rolls the save back with its audit entry when a handler of SettingsChanged fails', async () => {
    insertEmptyRow();
    const service = serviceWith({
      change: {
        SettingsChanged: async () => {
          throw new Error('rebuild failed');
        },
      },
    });

    await expect(
      service.update({ version: 1, brandName: 'Muster-Händler', contactText: '' }),
    ).rejects.toThrow('rebuild failed');

    expect(await service.get()).toEqual({ brandName: '', contactText: '', logo: null, version: 1 });
    expect(auditRows()).toEqual([]);
  });

  it('stores no change without its audit entry (2.0.4)', async () => {
    database.sqlite.exec(
      "CREATE TRIGGER fail_audit BEFORE INSERT ON audit_entry BEGIN SELECT RAISE(ABORT, 'audit'); END",
    );

    await expect(
      serviceWith().update({ version: 1, brandName: 'B', contactText: '' }),
    ).rejects.toThrow('audit');

    expect(profileRows()).toEqual([]);
  });
});
