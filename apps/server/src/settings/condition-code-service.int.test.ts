import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { insertPickLists, pickListId } from '../../test/pick-lists.ts';
import { openDatabase, type Database } from '../db/database.ts';
import { runMigrations } from '../db/migrator.ts';
import { migrations } from '../db/migrations/index.ts';
import type { DB } from '../db/schema.ts';
import { createUnitOfWork, type UnitOfWorkRunner } from '../db/unit-of-work.ts';
import type { Clock } from '../shared/clock.ts';
import type { ChangeEvent } from '../shared/events.ts';
import { createConditionCodeService } from './condition-code-service.ts';

const NOW = new Date('2026-11-12T09:15:00.000Z');
const clock: Clock = { now: () => NOW, today: () => '2026-11-12' };

let dir: string;
let database: Database<DB>;
/** Change events the actions of the service emitted. */
let emitted: ChangeEvent[];

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'resellr-condition-codes-'));
  database = openDatabase<DB>(join(dir, 'resellr.db'));
  await runMigrations(database, migrations, () => NOW);
  insertPickLists(database.sqlite);
  emitted = [];
});

afterEach(async () => {
  await database.close();
  rmSync(dir, { recursive: true, force: true });
});

/** The unit of work of the app, recording each change event an action emits. */
function recordingUnitOfWork(): UnitOfWorkRunner<DB> {
  const inner = createUnitOfWork(database.db, {});
  return {
    run: (action) =>
      inner.run((tx) =>
        action({
          ...tx,
          db: tx.db,
          emit: (event) => {
            emitted.push(event);
            tx.emit(event);
          },
        }),
      ),
  };
}

const service = () =>
  createConditionCodeService({ db: database.db, uow: recordingUnitOfWork(), clock });

const failAuditWrites = () =>
  database.sqlite.exec(
    "CREATE TRIGGER fail_audit BEFORE INSERT ON audit_entry BEGIN SELECT RAISE(ABORT, 'audit'); END",
  );

const codeRows = () =>
  database.sqlite.prepare('SELECT code, plain_text, version FROM condition_code').all();

/**
 * A device captured with the plain text of "DGS" in its condition description. Devices are
 * captured from S4 on (#54, #57); until then the test writes the rows directly, as the schema of
 * S1 allows.
 */
function insertDeviceWithDescription(description: string) {
  const at = '2026-11-12T08:00:00.000Z';
  database.sqlite.exec(`
    INSERT INTO device_type (id, name, name_key, active, sort_order, version, created_at, updated_at)
      VALUES (1, 'Notebook', 'notebook', 1, 1, 1, '${at}', '${at}');
    INSERT INTO manufacturer (id, name, name_key, active, gpsr_complete, version, created_at, updated_at)
      VALUES (1, 'Lenovo', 'lenovo', 1, 0, 1, '${at}', '${at}');
    INSERT INTO pick_list_value (id, pick_list_id, label, label_key, sort_order, active, version)
      VALUES (1, ${pickListId('condition')}, 'Gebraucht', 'gebraucht', 1, 1, 1);
    INSERT INTO model_template (id, device_type_id, manufacturer_id, model_name, model_name_key,
        mpn_unknown, model_values, default_device_values, search_key, import_review_pending,
        import_review_keys, version, created_at, updated_at)
      VALUES (1, 1, 1, 'T14', 't14', 1, '{}', '{}', 'lenovo t14', 0, '[]', 1, '${at}', '${at}');
  `);
  database.sqlite
    .prepare(
      `INSERT INTO device (wi_nr, wi_nr_key, model_template_id, condition_code, condition_value_id,
         visual_grade, condition_description, device_values, review_keys, capture_status,
         stock_status, captured_at, captured_on, version, updated_at)
       VALUES ('626198', '626198', 1, 'DGS', 1, 2, ?, '{}', '[]', 'checked', 'available', ?,
         '2026-11-12', 1, ?)`,
    )
    .run(description, at, at);
}

describe('condition code service (CU-081)', () => {
  it('AC-REQ-022-03 changing the plain text of "DGS" leaves the stored condition description unchanged and emits no event', async () => {
    const entry = await service().create({ code: 'DGS', plainText: 'Gebrauchsspuren' });
    insertDeviceWithDescription('Gebrauchsspuren');
    const deviceBefore = database.sqlite.prepare('SELECT * FROM device').get();

    const changed = await service().update(entry.id, {
      version: 1,
      plainText: 'Deutliche Gebrauchsspuren',
    });

    expect(changed.plainText).toBe('Deutliche Gebrauchsspuren');
    expect(database.sqlite.prepare('SELECT * FROM device').get()).toEqual(deviceBefore);
    expect(await service().resolve('dgs', null)).toMatchObject({
      plainText: 'Deutliche Gebrauchsspuren',
    });
    expect(emitted).toEqual([]);
  });

  it('DER-38-09 creating, changing and deleting an entry emits no event for recalculating channel contents', async () => {
    const entry = await service().create({ code: 'DGS', plainText: 'Kratzer' });
    await service().update(entry.id, { version: 1, plainText: 'Dellen' });
    await service().delete(entry.id, 2);

    expect(emitted).toEqual([]);
  });

  it('stores the clock time as created_at, updated_at and occurred_at of the audit entry', async () => {
    await service().create({ code: 'DGS', plainText: 'Kratzer' });

    expect(
      database.sqlite.prepare('SELECT created_at, updated_at FROM condition_code').get(),
    ).toEqual({ created_at: NOW.toISOString(), updated_at: NOW.toISOString() });
    expect(database.sqlite.prepare('SELECT occurred_at FROM audit_entry').pluck().get()).toBe(
      NOW.toISOString(),
    );
  });

  it('stores no new entry without its audit entry (2.0.4)', async () => {
    failAuditWrites();

    await expect(service().create({ code: 'DGS', plainText: 'Kratzer' })).rejects.toThrow('audit');

    expect(codeRows()).toEqual([]);
  });

  it('keeps the entry when the audit entry of a change or a deletion fails (2.0.4)', async () => {
    const entry = await service().create({ code: 'DGS', plainText: 'Kratzer' });
    failAuditWrites();

    await expect(service().update(entry.id, { version: 1, plainText: 'Dellen' })).rejects.toThrow(
      'audit',
    );
    await expect(service().delete(entry.id, 1)).rejects.toThrow('audit');

    expect(codeRows()).toEqual([{ code: 'DGS', plain_text: 'Kratzer', version: 1 }]);
  });
});
