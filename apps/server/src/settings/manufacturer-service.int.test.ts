import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { EMPTY_GPSR, type Gpsr } from '@resellr/domain/schemas/manufacturer.schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openDatabase, type Database } from '../db/database.ts';
import { runMigrations } from '../db/migrator.ts';
import { migrations } from '../db/migrations/index.ts';
import type { DB } from '../db/schema.ts';
import { createUnitOfWork, emptyChangeReport, type EventHandlers } from '../db/unit-of-work.ts';
import type { Clock } from '../shared/clock.ts';
import type { SettingsChanged } from '../shared/events.ts';
import { createManufacturerService } from './manufacturer-service.ts';

const NOW = new Date('2026-11-12T09:15:00.000Z');
const clock: Clock = { now: () => NOW, today: () => '2026-11-12' };

let dir: string;
let database: Database<DB>;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'resellr-manufacturers-'));
  database = openDatabase<DB>(join(dir, 'resellr.db'));
  await runMigrations(database, migrations, () => NOW);
});

afterEach(async () => {
  await database.close();
  rmSync(dir, { recursive: true, force: true });
});

const serviceWith = (handlers: EventHandlers<DB>) =>
  createManufacturerService({
    db: database.db,
    uow: createUnitOfWork(database.db, handlers),
    clock,
  });

const service = () => serviceWith({});

const failAuditWrites = () =>
  database.sqlite.exec(
    "CREATE TRIGGER fail_audit BEFORE INSERT ON audit_entry BEGIN SELECT RAISE(ABORT, 'audit'); END",
  );

const manufacturerRows = () =>
  database.sqlite.prepare('SELECT name, name_key, active, version FROM manufacturer').all();

describe('manufacturer service (CU-078)', () => {
  it('stores the clock time as created_at, updated_at and occurred_at of the audit entry', async () => {
    await service().create({ name: 'Lenovo' });

    expect(
      database.sqlite.prepare('SELECT created_at, updated_at FROM manufacturer').get(),
    ).toEqual({ created_at: NOW.toISOString(), updated_at: NOW.toISOString() });
    expect(database.sqlite.prepare('SELECT occurred_at FROM audit_entry').pluck().get()).toBe(
      NOW.toISOString(),
    );
  });

  it('stores the name key in lower case and a new manufacturer without GPSR as incomplete', async () => {
    await service().create({ name: 'Lenovo' });

    expect(
      database.sqlite.prepare('SELECT name_key, gpsr_complete FROM manufacturer').get(),
    ).toEqual({ name_key: 'lenovo', gpsr_complete: 0 });
  });

  it('stores no new manufacturer without its audit entry (2.0.4)', async () => {
    failAuditWrites();

    await expect(service().create({ name: 'Lenovo' })).rejects.toThrow('audit');

    expect(manufacturerRows()).toEqual([]);
  });

  it('keeps name, status and version when the audit entry of a change fails (2.0.4)', async () => {
    const { manufacturer } = await service().create({ name: 'Lenvo' });
    failAuditWrites();

    await expect(
      service().update(manufacturer.id, { version: 1, name: 'Lenovo', active: false }),
    ).rejects.toThrow('audit');

    expect(manufacturerRows()).toEqual([
      { name: 'Lenvo', name_key: 'lenvo', active: 1, version: 1 },
    ]);
  });
});

const LENOVO_GPSR: Gpsr = {
  ...EMPTY_GPSR,
  legalName: 'Lenovo PC HK Limited',
  street: 'Meitnerstraße 9',
  postalCode: '70563',
  city: 'Stuttgart',
  country: 'Deutschland',
  contact: 'info@lenovo.com',
};

const auditRows = () =>
  database.sqlite
    .prepare(
      "SELECT action, object_label, old_value, new_value FROM audit_entry WHERE object_type = 'manufacturer' ORDER BY id",
    )
    .all();

describe('manufacturer service: GPSR details (CU-078, REQ-027, Technical Specification 2.2)', () => {
  it('DER-41-06 a change of the GPSR details reports SettingsChanged for the manufacturer in the same transaction', async () => {
    const { manufacturer } = await service().create({ name: 'Lenovo' });
    const seen: { event: SettingsChanged; stored: unknown }[] = [];
    const recording = serviceWith({
      change: {
        SettingsChanged: async (event, tx) => {
          const stored = await tx.db
            .selectFrom('manufacturer')
            .select(['gpsr_postal_code', 'gpsr_complete'])
            .executeTakeFirst();
          seen.push({ event, stored });
          return emptyChangeReport();
        },
      },
    });

    await recording.update(manufacturer.id, { version: 1, gpsr: LENOVO_GPSR });

    // Scope `manufacturer`: all model listings of its model templates (2.2, 2.8.3).
    expect(seen).toEqual([
      {
        event: {
          type: 'SettingsChanged',
          scope: { kind: 'manufacturer', manufacturerId: manufacturer.id },
        },
        stored: { gpsr_postal_code: '70563', gpsr_complete: 1 },
      },
    ]);
  });

  it('DER-41-06 rolls the save back with its audit entry when a handler of SettingsChanged fails', async () => {
    const { manufacturer } = await service().create({ name: 'Lenovo' });
    const failing = serviceWith({
      change: {
        SettingsChanged: async () => {
          throw new Error('handler');
        },
      },
    });

    await expect(
      failing.update(manufacturer.id, { version: 1, gpsr: LENOVO_GPSR }),
    ).rejects.toThrow('handler');

    expect(
      database.sqlite
        .prepare('SELECT gpsr_legal_name, gpsr_complete, version FROM manufacturer')
        .get(),
    ).toEqual({ gpsr_legal_name: null, gpsr_complete: 0, version: 1 });
    expect(auditRows()).toHaveLength(1);
  });

  it('reports no SettingsChanged and keeps the version when the GPSR details are unchanged', async () => {
    const { manufacturer } = await service().create({ name: 'Lenovo' });
    await service().update(manufacturer.id, { version: 1, gpsr: LENOVO_GPSR });
    const handler = vi.fn(async () => emptyChangeReport());

    const { manufacturer: saved } = await serviceWith({
      change: { SettingsChanged: handler },
    }).update(manufacturer.id, { version: 2, gpsr: { ...LENOVO_GPSR } });

    expect(handler).not.toHaveBeenCalled();
    expect(saved.version).toBe(2);
    expect(auditRows()).toHaveLength(2);
  });

  it('a rename or status change alone reports no SettingsChanged (rename: #159)', async () => {
    const { manufacturer } = await service().create({ name: 'Lenvo' });
    const handler = vi.fn(async () => emptyChangeReport());

    await serviceWith({ change: { SettingsChanged: handler } }).update(manufacturer.id, {
      version: 1,
      name: 'Lenovo',
      active: false,
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('stores empty fields as NULL and derives gpsr_complete when saving (3.1)', async () => {
    const { manufacturer } = await service().create({ name: 'Lenovo' });

    await service().update(manufacturer.id, {
      version: 1,
      gpsr: { ...LENOVO_GPSR, postalCode: '', euRpName: 'EU Rep GmbH' },
    });

    expect(
      database.sqlite
        .prepare(
          'SELECT gpsr_postal_code, eu_rp_name, eu_rp_address, gpsr_complete FROM manufacturer',
        )
        .get(),
    ).toEqual({
      gpsr_postal_code: null,
      eu_rp_name: 'EU Rep GmbH',
      eu_rp_address: null,
      gpsr_complete: 0,
    });
  });

  it('writes one audit entry "updated" with the changed fields under their labels (3.6)', async () => {
    const { manufacturer } = await service().create({ name: 'Lenvo' });
    await service().update(manufacturer.id, {
      version: 1,
      gpsr: { ...EMPTY_GPSR, legalName: 'Lenovo PC HK Limited', city: 'Stuttgart' },
    });

    await service().update(manufacturer.id, {
      version: 2,
      name: 'Lenovo',
      gpsr: {
        ...EMPTY_GPSR,
        legalName: 'Lenovo PC HK Limited',
        city: 'Berlin',
        postalCode: '10115',
      },
    });

    expect(auditRows().slice(1)).toEqual([
      {
        action: 'updated',
        object_label: 'Hersteller Lenvo',
        old_value: JSON.stringify({ Herstellername: '', Ort: '' }),
        new_value: JSON.stringify({ Herstellername: 'Lenovo PC HK Limited', Ort: 'Stuttgart' }),
      },
      {
        action: 'updated',
        object_label: 'Hersteller Lenovo',
        old_value: JSON.stringify({ Name: 'Lenvo', Postleitzahl: '', Ort: 'Stuttgart' }),
        new_value: JSON.stringify({ Name: 'Lenovo', Postleitzahl: '10115', Ort: 'Berlin' }),
      },
    ]);
  });
});
