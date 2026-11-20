import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { insertManufacturer, insertModelTemplate } from '../../test/model-templates.ts';
import { createTestApp, SAME_ORIGIN_WRITE } from '../../test/test-app.ts';
import { migrations } from '../db/migrations/index.ts';
import { runMigrations } from '../db/migrator.ts';
import type { DB } from '../db/schema.ts';
import { createUnitOfWork, emptyChangeReport } from '../db/unit-of-work.ts';
import { createClock } from '../shared/clock.ts';
import type { ChangeEvent } from '../shared/events.ts';
import { createAssignmentService } from './assignment-service.ts';

// Integration and API tests of `POST /api/devices/{id}/rebooking` (CU-123, CU-128, CU-130;
// Technical Specification 2.6, REQ-020) on the initial settings of the seed migration: MV-A is an
// Apple MacBook Pro 13 (A1989), MV-B a notebook of another model. MI-X and MI-Y are model listings
// of MV-A that differ in the visual grade (2 and 4).

type TestApp = ReturnType<typeof createTestApp>;
let t: TestApp;
let ids: Record<'mvA' | 'mvB' | 'used', number>;
let values: Record<string, unknown>;

beforeEach(async () => {
  t = createTestApp();
  await runMigrations(t.database, migrations, () => new Date());
  const { sqlite } = t.database;
  const one = <T>(sql: string, ...params: unknown[]) => sqlite.prepare(sql).get(...params) as T;
  const notebook = one<{ id: number }>("SELECT id FROM device_type WHERE name = 'Notebook'").id;
  const valueId = (label: string) =>
    one<{ id: number }>('SELECT id FROM pick_list_value WHERE label = ?', label).id;
  const attributeId = (label: string) =>
    one<{ id: number }>(
      'SELECT id FROM attribute WHERE device_type_id = ? AND label = ?',
      notebook,
      label,
    ).id;
  const apple = insertManufacturer(sqlite, 'Apple');
  ids = {
    mvA: insertModelTemplate(sqlite, {
      deviceTypeId: notebook,
      manufacturerId: apple,
      modelName: 'MacBook Pro 13',
      typeDesignation: 'A1989',
      mpn: 'MR9Q2D/A',
    }),
    mvB: insertModelTemplate(sqlite, {
      deviceTypeId: notebook,
      manufacturerId: apple,
      modelName: 'MacBook Air 13',
      typeDesignation: 'A2337',
      mpn: 'MGN63D/A',
    }),
    used: valueId('gebraucht'),
  };
  // The device values of MI-A of the assignment tests: RAM 16 GB, 512 GB NVMe, German keyboard,
  // macOS 14, original power supply, battery with 85 %.
  values = {
    [attributeId('RAM')]: 16,
    [attributeId('Speicherkapazität')]: 512,
    [attributeId('Speichertyp')]: valueId('SSD (NVMe)'),
    [attributeId('Tastaturlayout')]: valueId('Deutsch (QWERTZ)'),
    [attributeId('Betriebssystem')]: valueId('macOS'),
    [attributeId('Betriebssystem-Version')]: 'macOS 14',
    [attributeId('Netzteil')]: valueId('mit Netzteil (original)'),
    [attributeId('Akku')]: valueId('mit Akku'),
    [attributeId('Akkukapazität')]: { percent: 85 },
  };
  await t.app.ready();
});

afterEach(async () => {
  await t.close();
});

const rows = <T>(sql: string, ...params: unknown[]) =>
  t.database.sqlite.prepare(sql).all(...params) as T[];
const count = (table: string) =>
  rows<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)[0]?.n ?? 0;
const quantityOf = (listingId: number) =>
  rows<{ quantity: number }>('SELECT quantity FROM listing WHERE id = ?', listingId)[0]?.quantity;
const deviceOf = (deviceId: number) =>
  rows<{ listing_id: number | null; version: number }>(
    'SELECT listing_id, version FROM device WHERE id = ?',
    deviceId,
  );

/** Captures a checked device of MV-A (or `modelTemplateId`) through the API; returns its id. */
async function captureDevice(
  wiNr: string,
  { visualGrade = '2', modelTemplateId = ids.mvA } = {},
): Promise<number> {
  const response = await t.app.inject({
    method: 'POST',
    url: '/api/devices',
    headers: SAME_ORIGIN_WRITE,
    payload: {
      wiNr,
      supplierId: null,
      modelTemplateId,
      conditionValueId: ids.used,
      visualGrade,
      conditionDescription: '',
      values,
      confirmedKeys: [],
    },
  });
  expect(response.statusCode).toBe(201);
  return response.json<{ id: number }>().id;
}

/** A model listing created from a new device `wiNr` with `title`; returns both ids. */
async function createListingFrom(
  wiNr: string,
  title: string,
  options: Parameters<typeof captureDevice>[1] = {},
): Promise<{ listingId: number; deviceId: number }> {
  const deviceId = await captureDevice(wiNr, options);
  const response = await t.app.inject({
    method: 'POST',
    url: '/api/listings',
    headers: SAME_ORIGIN_WRITE,
    payload: { fromDeviceId: deviceId, deviceVersion: 1 },
  });
  expect(response.statusCode).toBe(201);
  const listingId = response.json<{ id: number }>().id;
  // Until the title formation of S5 every model listing of MV-A has the model name as title.
  t.database.sqlite
    .prepare('UPDATE listing SET display_title = ? WHERE id = ?')
    .run(title, listingId);
  return { listingId, deviceId };
}

const assign = (deviceId: number, payload: Record<string, unknown>) =>
  t.app.inject({
    method: 'POST',
    url: `/api/devices/${deviceId}/assignment`,
    headers: SAME_ORIGIN_WRITE,
    payload,
  });

const rebook = (deviceId: number, payload: Record<string, unknown>) =>
  t.app.inject({
    method: 'POST',
    url: `/api/devices/${deviceId}/rebooking`,
    headers: SAME_ORIGIN_WRITE,
    payload,
  });

/**
 * MI-X (visual grade 2, quantity 2) with "626198" and "626199" (visual grade 4, assigned despite
 * the deviation, version 2) and MI-Y (visual grade 4, quantity 1) with "626300": "626199" matches
 * MI-Y.
 */
async function xWithTwoAndYWithOne() {
  const x = await createListingFrom('626198', 'MI-X');
  const y = await createListingFrom('626300', 'MI-Y', { visualGrade: '4' });
  const deviceId = await captureDevice('626199', { visualGrade: '4' });
  expect(
    (await assign(deviceId, { version: 1, listingId: x.listingId, confirmDeviation: true }))
      .statusCode,
  ).toBe(200);
  expect([quantityOf(x.listingId), quantityOf(y.listingId)]).toEqual([2, 1]);
  return { miX: x.listingId, miY: y.listingId, deviceId };
}

const markStockStatus = (deviceId: number, status: string) =>
  t.database.sqlite
    .prepare('UPDATE device SET stock_status = ? WHERE id = ?')
    .run(status, deviceId);

describe('POST /api/devices/{id}/rebooking (CU-123, Technical Specification 2.6)', () => {
  it('AC-REQ-020-01 rebooks an available device from X (quantity 2) to Y (quantity 1); X has quantity 1 and Y quantity 2', async () => {
    const { miX, miY, deviceId } = await xWithTwoAndYWithOne();

    const response = await rebook(deviceId, { version: 2, targetListingId: miY });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      device: { id: deviceId, wiNr: '626199', listingId: miY, version: 3 },
      listing: { id: miY, quantity: 2 },
      previousListing: { id: miX, quantity: 1 },
      // Until S5 no handler reports channels (4.4.0).
      adjustStockChannels: [],
    });
    expect([quantityOf(miX), quantityOf(miY)]).toEqual([1, 2]);
    expect(deviceOf(deviceId)).toEqual([{ listing_id: miY, version: 3 }]);
    const stock = rows<{ id: number; stock_json: string }>(
      'SELECT id, stock_json FROM listing WHERE id IN (?, ?) ORDER BY id',
      miX,
      miY,
    ).map((row) => JSON.parse(row.stock_json).quantity);
    expect(stock).toEqual([1, 2]);
  });

  it('AC-REQ-020-03 rebooks the last device of X to Y; X stays with quantity 0 and is not deleted', async () => {
    const x = await createListingFrom('626198', 'MI-X');
    const y = await createListingFrom('626300', 'MI-Y', { visualGrade: '4' });
    const listings = count('listing');

    const response = await rebook(x.deviceId, {
      version: 2,
      targetListingId: y.listingId,
      confirmDeviation: true,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      listing: { id: y.listingId, quantity: 2 },
      previousListing: { id: x.listingId, quantity: 0 },
    });
    expect(count('listing')).toBe(listings);
    expect(rows('SELECT id, quantity FROM listing WHERE id = ?', x.listingId)).toEqual([
      { id: x.listingId, quantity: 0 },
    ]);
  });

  it('DER-61-06 writes the audit entry rebooked with the previous and the new model listing', async () => {
    const { deviceId } = await xWithTwoAndYWithOne();
    const miY = rows<{ id: number }>("SELECT id FROM listing WHERE display_title = 'MI-Y'")[0]?.id;

    await rebook(deviceId, { version: 2, targetListingId: miY });

    const entries = rows<Record<string, unknown>>(
      `SELECT object_type, object_category, object_id, object_label, action, old_value, new_value,
              occurred_at IS NOT NULL AS timed
         FROM audit_entry WHERE object_id = ? AND action = 'rebooked'`,
      deviceId,
    );
    expect(entries).toEqual([
      {
        object_type: 'device',
        object_category: 'device',
        object_id: deviceId,
        object_label: 'Gerät 626199',
        action: 'rebooked',
        old_value: JSON.stringify({ 'Modell-Inserat': 'MI-X' }),
        new_value: JSON.stringify({ 'Modell-Inserat': 'MI-Y' }),
        timed: 1,
      },
    ]);
  });

  it('DER-61-06 writes a confirmed deviation of the target with the deviations, as "trotzdem zuordnen" does', async () => {
    const x = await createListingFrom('626198', 'MI-X');
    const y = await createListingFrom('626300', 'MI-Y', { visualGrade: '4' });

    await rebook(x.deviceId, { version: 2, targetListingId: y.listingId, confirmDeviation: true });

    const entries = rows<{ new_value: string }>(
      "SELECT new_value FROM audit_entry WHERE object_id = ? AND action = 'rebooked'",
      x.deviceId,
    );
    expect(entries).toEqual([
      {
        new_value: JSON.stringify({
          'Modell-Inserat': 'MI-Y',
          Abweichungen: ['Optik-Note: Gerät 2, Modell-Inserat 4'],
        }),
      },
    ]);
  });

  it('AC-REQ-020-02 rejects a sold device with device_not_available; nothing is stored', async () => {
    const { miX, miY, deviceId } = await xWithTwoAndYWithOne();
    markStockStatus(deviceId, 'sold');
    const auditEntries = count('audit_entry');

    const response = await rebook(deviceId, { version: 2, targetListingId: miY });

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'device_not_available',
      message: 'Ein verkauftes oder storniertes Gerät kann nicht umgebucht werden',
    });
    expect(deviceOf(deviceId)).toEqual([{ listing_id: miX, version: 2 }]);
    expect(count('audit_entry')).toBe(auditEntries);
  });

  it('rejects a cancelled device with device_not_available', async () => {
    const { miY, deviceId } = await xWithTwoAndYWithOne();
    markStockStatus(deviceId, 'cancelled');

    const response = await rebook(deviceId, { version: 2, targetListingId: miY });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('device_not_available');
  });

  it('rejects an unassigned device with device_not_assigned; nothing is stored', async () => {
    const y = await createListingFrom('626300', 'MI-Y', { visualGrade: '4' });
    const deviceId = await captureDevice('626199', { visualGrade: '4' });

    const response = await rebook(deviceId, { version: 1, targetListingId: y.listingId });

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'device_not_assigned',
      message: 'Gerät keinem Modell-Inserat zugeordnet',
    });
    expect(deviceOf(deviceId)).toEqual([{ listing_id: null, version: 1 }]);
    expect(quantityOf(y.listingId)).toBe(1);
  });

  it('rejects a target of another model template with other_model_template; nothing is stored', async () => {
    const x = await createListingFrom('626198', 'MI-X');
    const ofB = await createListingFrom('626400', 'MI-B', { modelTemplateId: ids.mvB });

    const response = await rebook(x.deviceId, { version: 2, targetListingId: ofB.listingId });

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'other_model_template',
      message: 'Gerät gehört zu anderer Modellvorlage',
    });
    expect([quantityOf(x.listingId), quantityOf(ofB.listingId)]).toEqual([1, 1]);
  });

  it('answers a deviating target without confirmation with target_deviation and the deviations to the target; nothing is stored', async () => {
    const x = await createListingFrom('626198', 'MI-X');
    const y = await createListingFrom('626300', 'MI-Y', { visualGrade: '4' });
    const auditEntries = count('audit_entry');

    const response = await rebook(x.deviceId, {
      version: 2,
      targetListingId: y.listingId,
      confirmDeviation: false,
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'confirmation_required',
      message: 'Das Gerät weicht vom Ziel-Modell-Inserat ab.',
      details: {
        kind: 'target_deviation',
        deviations: [
          { key: 'visualGrade', label: 'Optik-Note', deviceValue: '2', listingValue: '4' },
        ],
      },
    });
    expect(deviceOf(x.deviceId)).toEqual([{ listing_id: x.listingId, version: 2 }]);
    expect([quantityOf(x.listingId), quantityOf(y.listingId)]).toEqual([1, 1]);
    expect(count('audit_entry')).toBe(auditEntries);
  });

  it('rejects the current model listing as target as a program error of the user interface (400)', async () => {
    const x = await createListingFrom('626198', 'MI-X');

    const response = await rebook(x.deviceId, { version: 2, targetListingId: x.listingId });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('bad_request');
    expect(deviceOf(x.deviceId)).toEqual([{ listing_id: x.listingId, version: 2 }]);
  });

  it('rejects an outdated device version with 409 version_conflict; nothing is stored', async () => {
    const { miX, miY, deviceId } = await xWithTwoAndYWithOne();

    const response = await rebook(deviceId, { version: 1, targetListingId: miY });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('version_conflict');
    expect([quantityOf(miX), quantityOf(miY)]).toEqual([2, 1]);
  });

  it('answers not_found for an unknown device', async () => {
    const y = await createListingFrom('626300', 'MI-Y');

    const response = await rebook(999, { version: 1, targetListingId: y.listingId });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('not_found');
  });

  it('rejects an unknown or missing target as a program error of the user interface (400)', async () => {
    const x = await createListingFrom('626198', 'MI-X');

    const unknown = await rebook(x.deviceId, { version: 2, targetListingId: 999 });
    const missing = await rebook(x.deviceId, { version: 2 });

    expect([unknown.statusCode, missing.statusCode]).toEqual([400, 400]);
    expect(unknown.json().error.code).toBe('bad_request');
  });

  describe('order of the checks: the first matching stage wins (2.6)', () => {
    it('checks the device version before the stock status', async () => {
      const { miY, deviceId } = await xWithTwoAndYWithOne();
      markStockStatus(deviceId, 'sold');

      const response = await rebook(deviceId, { version: 1, targetListingId: miY });

      expect(response.json().error.code).toBe('version_conflict');
    });

    it('checks the stock status before the assignment', async () => {
      const y = await createListingFrom('626300', 'MI-Y');
      const deviceId = await captureDevice('626199', { visualGrade: '4' });
      markStockStatus(deviceId, 'sold');

      const response = await rebook(deviceId, { version: 1, targetListingId: y.listingId });

      expect(response.json().error.code).toBe('device_not_available');
    });

    it('checks the assignment before the model template', async () => {
      const ofB = await createListingFrom('626400', 'MI-B', { modelTemplateId: ids.mvB });
      const deviceId = await captureDevice('626199');

      const response = await rebook(deviceId, { version: 1, targetListingId: ofB.listingId });

      expect(response.json().error.code).toBe('device_not_assigned');
    });

    it('checks the model template before the variant data', async () => {
      const x = await createListingFrom('626198', 'MI-X');
      const ofB = await createListingFrom('626400', 'MI-B', {
        modelTemplateId: ids.mvB,
        visualGrade: '4',
      });

      const response = await rebook(x.deviceId, { version: 2, targetListingId: ofB.listingId });

      expect(response.json().error.code).toBe('other_model_template');
    });
  });
});

describe('rebook events (CU-123, CU-128; Technical Specification 2.0.4, 2.6)', () => {
  it('DER-61-06 reports StockChanged of both model listings and answers the channels of the reports', async () => {
    const { miX, miY, deviceId } = await xWithTwoAndYWithOne();
    const seen: ChangeEvent[] = [];
    const uow = createUnitOfWork<DB>(t.database.db, {
      change: {
        StockChanged: async (event) => {
          seen.push(event);
          return {
            ...emptyChangeReport(),
            adjustStockChannels: event.listingId === miY ? [2] : [3],
          };
        },
      },
    });
    const service = createAssignmentService({ uow, clock: createClock() });

    const result = await service.rebook(deviceId, { version: 2, targetListingId: miY });

    expect(seen).toEqual(
      expect.arrayContaining([
        { type: 'StockChanged', listingId: miX },
        { type: 'StockChanged', listingId: miY },
      ]),
    );
    expect(seen).toHaveLength(2);
    expect(result).toMatchObject({
      listing: { id: miY, quantity: 2 },
      previousListing: { id: miX, quantity: 1 },
    });
    expect([...result.adjustStockChannels].sort()).toEqual([2, 3]);
  });

  it('stores nothing when a handler of StockChanged fails', async () => {
    const { miX, miY, deviceId } = await xWithTwoAndYWithOne();
    const uow = createUnitOfWork<DB>(t.database.db, {
      change: {
        StockChanged: async () => {
          throw new Error('stock flags failed');
        },
      },
    });
    const service = createAssignmentService({ uow, clock: createClock() });

    await expect(service.rebook(deviceId, { version: 2, targetListingId: miY })).rejects.toThrow(
      'stock flags failed',
    );
    expect([quantityOf(miX), quantityOf(miY)]).toEqual([2, 1]);
    expect(deviceOf(deviceId)).toEqual([{ listing_id: miX, version: 2 }]);
  });
});
