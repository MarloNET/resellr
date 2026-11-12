import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestApp, HOST, SAME_ORIGIN_WRITE } from '../../../test/test-app.ts';
import { runMigrations } from '../migrator.ts';
import { migrations } from './index.ts';

// Seed migration CU-071 against a freshly created database. The expected values are copied from
// Requirements 9.2, 9.3, 9.8 and 9.12, not from CU-070, so each entry is checked against the
// chapter (AC-REQ-006-01).

type TestApp = ReturnType<typeof createTestApp>;
let t: TestApp;

beforeEach(async () => {
  t = createTestApp();
  await runMigrations(t.database, migrations, () => new Date());
  await t.app.ready();
});

afterEach(async () => {
  await t.close();
});

const get = async <T>(url: string): Promise<T> => {
  const response = await t.app.inject({ method: 'GET', url, headers: { host: HOST } });
  expect(response.statusCode).toBe(200);
  return response.json<T>();
};

const rows = <T>(query: string, ...params: unknown[]) =>
  t.database.sqlite.prepare(query).all(...params) as T[];

const DEVICE_TYPES = ['Notebook', 'PC/Mini-PC', 'Tablet', 'Smartphone'] as const;
type DeviceTypeName = (typeof DEVICE_TYPES)[number];

/** Requirements 9.2: list name → start values; "Optik-Note" is a fixed number, no list. */
const PICK_LISTS_9_2: Record<string, string[]> = {
  Zustand: ['gebraucht', 'defekt', 'refurbished'],
  Tastaturlayout: [
    'Deutsch (QWERTZ)',
    'Ungarisch',
    'Englisch (QWERTY, US)',
    'Englisch (QWERTY, UK)',
  ],
  Netzteil: ['mit Netzteil (original)', 'mit Netzteil (nicht original)', 'ohne Netzteil'],
  Akku: ['mit Akku', 'mit Akku (defekt)', 'ohne Akku'],
  Speichertyp: ['SSD (SATA)', 'SSD (NVMe)', 'HDD', 'eMMC'],
  'Display-Oberfläche': ['matt', 'glänzend'],
  Betriebssystem: [
    'Windows 11 Pro',
    'Windows 11 Home',
    'Windows 10 Pro',
    'macOS',
    'iOS',
    'iPadOS',
    'Android',
    'ohne Betriebssystem',
  ],
  Anschlusstyp: [
    'USB-A 2.0',
    'USB-A 3.x',
    'USB-C',
    'USB-C Thunderbolt',
    'HDMI',
    'DisplayPort',
    'VGA',
    'LAN (RJ45)',
    'Kartenleser',
    'Audio (Kombi)',
    'Seriell',
  ],
  Anschlussposition: ['vorn', 'hinten'],
};

/**
 * Requirements 9.3, one row per attribute in its order: label, data type, unit (pick list for
 * "Auswahl"), then the cells Notebook, PC/Mini-PC, Tablet, Smartphone ("–" = not present).
 */
const TABLE_9_3: [string, string, string | null, string, string, string, string][] = [
  ['Prozessor', 'text', null, 'M, P', 'M, P', 'M', 'M'],
  ['Prozessorkerne', 'integer', null, 'M', 'M', '–', '–'],
  ['Prozessortakt', 'decimal', 'GHz', 'M', 'M', '–', '–'],
  ['RAM', 'integer', 'GB', 'G, P, V', 'G, P, V', 'M', 'M'],
  ['RAM-Typ', 'text', null, 'G', 'G', '–', '–'],
  ['Speicherkapazität', 'integer', 'GB', 'G, P, V', 'G, P, V', 'M, P', 'M, P'],
  ['Speichertyp', 'pick', 'Speichertyp', 'G, V', 'G, V', '–', '–'],
  ['Zweiter Speicherplatz', 'text', null, 'G', 'G', '–', '–'],
  ['Optisches Laufwerk', 'text', null, 'M', 'M', '–', '–'],
  ['Displaygröße', 'decimal', 'Zoll', 'M, P', '–', 'M, P', 'M, P'],
  ['Auflösung', 'text', null, 'M', '–', 'M', 'M'],
  ['Display-Oberfläche', 'pick', 'Display-Oberfläche', 'M', '–', '–', '–'],
  ['Touchscreen', 'boolean', null, 'M', '–', '–', '–'],
  ['Grafik 1', 'text', null, 'M', 'M', '–', '–'],
  ['Grafik 2', 'text', null, 'M', 'M', '–', '–'],
  ['Tastaturlayout', 'pick', 'Tastaturlayout', 'G, P, V', '–', '–', '–'],
  ['Tastaturbeleuchtung', 'boolean', null, 'M', '–', '–', '–'],
  ['Ziffernblock', 'boolean', null, 'M', '–', '–', '–'],
  ['Fingerprint', 'boolean', null, 'M', '–', 'M', 'M'],
  ['WLAN', 'text', null, 'M', 'M', 'M', 'M'],
  ['Bluetooth', 'text', null, 'M', 'M', 'M', 'M'],
  ['Mobilfunk (LTE/5G)', 'boolean', null, 'M', '–', 'M', 'M'],
  ['LAN', 'boolean', null, 'M', 'M', '–', '–'],
  ['Webcam', 'text', null, 'M', '–', 'M', 'M'],
  ['Anschlüsse', 'ports', null, 'M', 'M', 'M', 'M'],
  ['Betriebssystem', 'pick', 'Betriebssystem', 'G, P, V', 'G, P, V', 'G, P, V', 'G, P, V'],
  ['Betriebssystem-Version', 'text', null, 'G', 'G', 'G', 'G'],
  ['Farbe', 'text', null, 'M', 'M', 'M', 'M'],
  ['Netzteil', 'pick', 'Netzteil', 'G, P, V', '–', 'G, P, V', 'G, V'],
  ['Akku', 'pick', 'Akku', 'G, P, V', '–', 'G, P, V', 'G, P, V'],
  ['Akkukapazität', 'integer', '%', 'G', '–', 'G', 'G'],
];

const cellOf = (row: (typeof TABLE_9_3)[number], deviceType: DeviceTypeName) =>
  row[3 + DEVICE_TYPES.indexOf(deviceType)] as string;

/** Attribute labels of a device type in the order of 9.3. */
const labelsOf = (deviceType: DeviceTypeName) =>
  TABLE_9_3.filter((row) => cellOf(row, deviceType) !== '–').map(([label]) => label);

/** System roles of 2.1.1. */
const ROLES: Record<string, string> = {
  Tastaturlayout: 'keyboard_layout',
  Netzteil: 'power_supply',
  Akku: 'battery',
  Akkukapazität: 'battery_capacity',
};

interface ApiDeviceType {
  id: number;
  name: string;
  active: boolean;
  attributeCount: number;
}
interface ApiAttribute {
  id: number;
  label: string;
  dataType: string;
  systemRole: string | null;
  unit: string | null;
  unitSpacing: boolean;
  minValue: string | null;
  maxValue: string | null;
  pickListId: number | null;
  level: string;
  variantForming: boolean;
  required: boolean;
  datasheetBlock: string;
  active: boolean;
}
interface ApiPickList {
  id: number;
  key: string;
  name: string;
  isBatteryList: boolean;
}
interface ApiPickListValue {
  label: string;
  active: boolean;
  batteryPresent: boolean | null;
}

const deviceTypes = async () =>
  (await get<{ items: ApiDeviceType[] }>('/api/device-types?limit=200')).items;

const deviceTypeId = async (name: DeviceTypeName) => {
  const found = (await deviceTypes()).find((deviceType) => deviceType.name === name);
  if (found === undefined) throw new Error(`no device type ${name}`);
  return found.id;
};

const attributesOf = async (name: DeviceTypeName) =>
  (await get<{ items: ApiAttribute[] }>(`/api/device-types/${await deviceTypeId(name)}/attributes`))
    .items;

/** Attribute id → label over all device types. */
const attributeLabels = () =>
  new Map(
    rows<{ id: number; label: string }>('SELECT id, label FROM attribute').map((row) => [
      row.id,
      row.label,
    ]),
  );

const FIELD_NAMES: Record<string, string> = {
  manufacturer: 'Hersteller',
  modelName: 'Modellbezeichnung',
  typeDesignation: 'Typbezeichnung',
  mpn: 'Herstellernummer',
  deviceType: 'Geräteart',
  ean: 'EAN',
  articleNumber: 'Artikelnummer',
  conditionDescription: 'Zustandsbeschreibung',
  conditionLabel: 'Zustandsbezeichnung des Kanals',
  quantity: 'Stückzahl',
};

type Source = { kind: 'attribute'; attributeId: number } | { kind: 'field'; field: string };

const sourceName = (source: Source, labels: Map<number, string>) =>
  source.kind === 'attribute' ? labels.get(source.attributeId) : FIELD_NAMES[source.field];

const channelIdByName = (name: string) =>
  rows<{ id: number }>('SELECT id FROM channel WHERE name = ?', name)[0]?.id;

describe('seed migration 20261110_0002_seed_initial_settings (CU-071)', () => {
  it('AC-REQ-006-01 creates the device types of 9.3, active and in this order', async () => {
    expect((await deviceTypes()).map(({ name, active }) => ({ name, active }))).toEqual(
      DEVICE_TYPES.map((name) => ({ name, active: true })),
    );
  });

  it.each(DEVICE_TYPES)(
    'AC-REQ-006-01 gives %s the attributes of 9.3 with level, variant flag, required, data type and unit',
    async (deviceType) => {
      const pickLists = (await get<{ items: ApiPickList[] }>('/api/pick-lists')).items;
      const listName = (id: number | null) => pickLists.find((list) => list.id === id)?.name;
      const attributes = await attributesOf(deviceType);

      expect(attributes.map(({ label }) => label)).toEqual(labelsOf(deviceType));
      for (const attribute of attributes) {
        const row = TABLE_9_3.find(([label]) => label === attribute.label);
        if (row === undefined) throw new Error(`unexpected attribute ${attribute.label}`);
        const [label, dataType, unitOrList] = row;
        const cell = cellOf(row, deviceType).split(', ');
        expect({
          label,
          level: attribute.level,
          variantForming: attribute.variantForming,
          required: attribute.required,
          dataType: attribute.dataType,
          unitOrList: dataType === 'pick' ? listName(attribute.pickListId) : attribute.unit,
          systemRole: attribute.systemRole,
          active: attribute.active,
        }).toEqual({
          label,
          level: cell.includes('M') ? 'model' : 'device',
          variantForming: cell.includes('V'),
          required: cell.includes('P'),
          dataType,
          unitOrList,
          systemRole: ROLES[label] ?? null,
          active: true,
        });
      }
    },
  );

  it('AC-REQ-006-01 writes RAM and storage without a space and limits Akkukapazität to 0–100', async () => {
    const attributes = await attributesOf('Notebook');
    const byLabel = (label: string) => attributes.find((attribute) => attribute.label === label);
    // Requirements test data MV-A: "16GB", "512GB".
    expect(byLabel('RAM')?.unitSpacing).toBe(false);
    expect(byLabel('Speicherkapazität')?.unitSpacing).toBe(false);
    expect(byLabel('Displaygröße')?.unitSpacing).toBe(true);
    expect(byLabel('Akkukapazität')).toMatchObject({ minValue: '0', maxValue: '100' });
    expect(
      attributes.filter(({ minValue, maxValue }) => minValue !== null || maxValue !== null),
    ).toHaveLength(1);
  });

  it('assigns the attributes to the data sheet blocks after 9.12 and REQ-005', async () => {
    const attributes = await attributesOf('Notebook');
    const block = (label: string) =>
      attributes.find((attribute) => attribute.label === label)?.datasheetBlock;
    expect(block('Anschlüsse')).toBe('ports');
    expect(['Betriebssystem', 'Betriebssystem-Version'].map(block)).toEqual([
      'software',
      'software',
    ]);
    expect(['Netzteil', 'Akku', 'Akkukapazität'].map(block)).toEqual([
      'delivery_scope',
      'delivery_scope',
      'delivery_scope',
    ]);
    const others = attributes.filter(
      ({ label }) =>
        ![
          'Anschlüsse',
          'Betriebssystem',
          'Betriebssystem-Version',
          'Netzteil',
          'Akku',
          'Akkukapazität',
        ].includes(label),
    );
    expect(new Set(others.map(({ datasheetBlock }) => datasheetBlock))).toEqual(
      new Set(['technical']),
    );
  });

  it('AC-REQ-006-01 creates the pick lists of 9.2 with their start values, all active', async () => {
    const pickLists = (await get<{ items: ApiPickList[] }>('/api/pick-lists')).items;
    expect(pickLists.map(({ name }) => name)).toEqual(Object.keys(PICK_LISTS_9_2));
    for (const list of pickLists) {
      const values = (await get<{ items: ApiPickListValue[] }>(`/api/pick-lists/${list.id}/values`))
        .items;
      expect(values.map(({ label }) => label)).toEqual(PICK_LISTS_9_2[list.name]);
      expect(values.every(({ active }) => active)).toBe(true);
      expect(list.isBatteryList).toBe(list.key === 'battery');
      // Flag "Akku vorhanden" only in the list Akku: ja, ja, nein.
      expect(values.map(({ batteryPresent }) => batteryPresent)).toEqual(
        list.key === 'battery' ? [true, true, false] : values.map(() => null),
      );
    }
  });

  it('AC-REQ-006-01 creates the title patterns of 9.3 with prefixes, suffixes and shortening priorities', async () => {
    const labels = attributeLabels();
    const COMPUTER =
      '{Hersteller} {Modellbezeichnung} ({Typbezeichnung}), {Prozessor}, {RAM} RAM, {Speicherkapazität} {Farbe}';
    const MOBILE =
      '{Hersteller} {Modellbezeichnung} ({Typbezeichnung}), {Speicherkapazität}, {Betriebssystem-Version}, {Farbe}';
    const expected: Record<DeviceTypeName, [string, Record<string, number>]> = {
      Notebook: [COMPUTER, { Farbe: 4, Speicherkapazität: 3, RAM: 2 }],
      'PC/Mini-PC': [COMPUTER, { Farbe: 4, Speicherkapazität: 3, RAM: 2 }],
      Tablet: [MOBILE, { Farbe: 4, 'Betriebssystem-Version': 3, Speicherkapazität: 2 }],
      Smartphone: [MOBILE, { Farbe: 4, 'Betriebssystem-Version': 3, Speicherkapazität: 2 }],
    };

    const patterns = rows<{ name: string; channel_id: number | null; parts: string }>(
      `SELECT d.name, p.channel_id, p.parts FROM title_pattern p
       JOIN device_type d ON d.id = p.device_type_id ORDER BY d.sort_order`,
    );
    expect(patterns.map(({ name }) => name)).toEqual([...DEVICE_TYPES]);
    for (const { name, channel_id: channelId, parts } of patterns) {
      // No channel's own title pattern (9.12).
      expect(channelId).toBeNull();
      const parsed = JSON.parse(parts) as (Source & {
        prefix: string;
        suffix: string;
        priority: number;
      })[];
      const named = parsed.map((part) => ({ ...part, name: sourceName(part, labels) }));
      const [shorthand, priorities] = expected[name as DeviceTypeName];
      expect(named.map((part) => `${part.prefix}{${part.name}}${part.suffix}`).join('')).toBe(
        shorthand,
      );
      expect(Object.fromEntries(named.map((part) => [part.name, part.priority]))).toEqual({
        Hersteller: 1,
        Modellbezeichnung: 1,
        Typbezeichnung: 1,
        ...(name === 'Notebook' || name === 'PC/Mini-PC' ? { Prozessor: 1 } : {}),
        ...priorities,
      });
    }
  });

  it('AC-REQ-006-01 creates the channels of 9.12, all active, without price rule', () => {
    expect(
      rows('SELECT name, active, title_max_length, vb_allowed FROM channel ORDER BY sort_order'),
    ).toEqual([
      { name: 'Shop', active: 1, title_max_length: 128, vb_allowed: 0 },
      { name: 'Kleinanzeigen', active: 1, title_max_length: 65, vb_allowed: 1 },
      { name: 'eBay', active: 1, title_max_length: 80, vb_allowed: 0 },
    ]);
    expect(rows('SELECT * FROM price_rule')).toEqual([]);
  });

  it.each(DEVICE_TYPES)(
    'AC-REQ-006-01 creates the attribute mappings of 9.8 for %s, without fields of missing attributes',
    async (deviceType) => {
      // Requirements 9.8: field label ← source, in this order.
      const TABLE_9_8: Record<string, [string, string][]> = {
        Shop: [
          ['Artikelnummer', 'Artikelnummer'],
          ['EAN-13', 'EAN'],
          ['Herstellernummer (MPN)', 'Herstellernummer'],
          ['Hersteller', 'Hersteller'],
          ['Prozessor', 'Prozessor'],
          ['RAM', 'RAM'],
          ['Speicher', 'Speicherkapazität'],
          ['Display', 'Displaygröße'],
          ['Anschlüsse', 'Anschlüsse'],
          ['Betriebssystem', 'Betriebssystem'],
          ['Stückzahl', 'Stückzahl'],
        ],
        Kleinanzeigen: [
          ['Typ', 'Geräteart'],
          ['Marke', 'Hersteller'],
          ['Modell', 'Modellbezeichnung'],
          ['Zustand', 'Zustandsbezeichnung des Kanals'],
          ['Betriebssystem', 'Betriebssystem'],
          ['Prozessor', 'Prozessor'],
          ['RAM', 'RAM'],
          ['Speicher', 'Speicherkapazität'],
          ['Farbe', 'Farbe'],
        ],
        eBay: [
          ['Marke', 'Hersteller'],
          ['Modell', 'Modellbezeichnung'],
          ['Prozessor', 'Prozessor'],
          ['Bildschirmgröße', 'Displaygröße'],
          ['Arbeitsspeicher', 'RAM'],
          ['Speicherkapazität', 'Speicherkapazität'],
          ['Betriebssystem', 'Betriebssystem'],
          ['Farbe', 'Farbe'],
          ['Herstellernummer', 'Herstellernummer'],
          ['EAN', 'EAN'],
          ['Zustandsbeschreibung', 'Zustandsbeschreibung'],
        ],
      };
      const allAttributes = new Set(TABLE_9_3.map(([label]) => label));
      const own = new Set(labelsOf(deviceType));
      const labels = attributeLabels();
      const id = await deviceTypeId(deviceType);

      for (const [channel, fields] of Object.entries(TABLE_9_8)) {
        const [mapping] = rows<{ fields: string }>(
          'SELECT fields FROM attribute_mapping WHERE channel_id = ? AND device_type_id = ?',
          channelIdByName(channel),
          id,
        );
        const stored = JSON.parse(mapping?.fields ?? '[]') as {
          label: string;
          source: Source;
          required: boolean;
          valueMap: unknown[];
        }[];
        expect(stored.map(({ label, source }) => [label, sourceName(source, labels)])).toEqual(
          fields.filter(([, source]) => !allAttributes.has(source) || own.has(source)),
        );
        // No field is required by the channel, no value mapping is shipped (9.8, V-03).
        expect(stored.every(({ required, valueMap }) => !required && valueMap.length === 0)).toBe(
          true,
        );
        // Attribute sources point at an attribute of this device type.
        const ownIds = new Set(
          rows<{ id: number }>('SELECT id FROM attribute WHERE device_type_id = ?', id).map(
            (row) => row.id,
          ),
        );
        for (const { source } of stored) {
          if (source.kind === 'attribute') expect(ownIds.has(source.attributeId)).toBe(true);
        }
      }
      expect(rows('SELECT id FROM attribute_mapping WHERE device_type_id = ?', id)).toHaveLength(3);
    },
  );

  it('AC-REQ-006-01 creates the description templates of 9.12 for all device types', () => {
    const KINDS: Record<string, string> = {
      battery_notice: 'Akku-Hinweis',
      legal: 'Rechtliches',
      pickup_contact: 'Abholung/Kontakt',
    };
    const CONDITION = 'Zustand: {Zustandsbezeichnung Kanal} / {Zustandsbeschreibung}';
    const DELIVERY_SCOPE =
      'Lieferumfang: {Lieferumfang} / Netzteil: {Netzteil} / Akku: {Akku} / Akkukapazität: {Akkukapazität} / Bausteine Art Akku-Hinweis';
    const LEGAL = 'ohne Überschrift: Bausteine Art Rechtliches';
    const expected: Record<string, string[]> = {
      Shop: [CONDITION, DELIVERY_SCOPE, 'Artikeldetails: {Merkmalsliste}', LEGAL],
      Kleinanzeigen: [
        'ohne Überschrift: WI-Nr: {WI-Nr} / ProduktNr. {Herstellernummer}',
        CONDITION,
        DELIVERY_SCOPE,
        'Technische Daten: {Merkmalsliste}',
        'Abholung und Kontakt: Bausteine Art Abholung/Kontakt',
        LEGAL,
      ],
      eBay: [CONDITION, DELIVERY_SCOPE, 'Technische Daten: {Merkmalsliste}', LEGAL],
    };

    const templates = rows<{ name: string; sections: string }>(
      `SELECT c.name, t.sections FROM description_template t
       JOIN channel c ON c.id = t.channel_id ORDER BY c.sort_order`,
    );
    expect(templates.map(({ name }) => name)).toEqual(['Shop', 'Kleinanzeigen', 'eBay']);
    for (const { name, sections } of templates) {
      const parsed = JSON.parse(sections) as {
        heading: string;
        deviceTypeIds: number[];
        lines: (
          { kind: 'text'; text: string } | { kind: 'textBlockKind'; textBlockKind: string }
        )[];
      }[];
      expect(parsed.every(({ deviceTypeIds }) => deviceTypeIds.length === 0)).toBe(true);
      expect(
        parsed.map(
          ({ heading, lines }) =>
            `${heading === '' ? 'ohne Überschrift' : heading}: ${lines
              .map((line) =>
                line.kind === 'text' ? line.text : `Bausteine Art ${KINDS[line.textBlockKind]}`,
              )
              .join(' / ')}`,
        ),
      ).toEqual(expected[name]);
    }
  });

  it('AC-REQ-006-01 creates the data sheet layout of 9.12 with the attribute order of 9.3', async () => {
    const [layout] = rows<{ header_labels: string; block_order: string; attribute_order: string }>(
      'SELECT header_labels, block_order, attribute_order FROM datasheet_layout',
    );
    expect(JSON.parse(layout?.header_labels ?? '')).toEqual(['Shop:', 'eBay:', 'Kleinanzeigen:']);
    expect(JSON.parse(layout?.block_order ?? '')).toEqual([
      'identification',
      'condition',
      'delivery_scope',
      'technical',
      'ports',
      'software',
    ]);
    const labels = attributeLabels();
    const order = JSON.parse(layout?.attribute_order ?? '') as Record<string, number[]>;
    const expected: Record<string, string[]> = {};
    for (const deviceType of DEVICE_TYPES) {
      expected[String(await deviceTypeId(deviceType))] = labelsOf(deviceType);
    }
    expect(
      Object.fromEntries(
        Object.entries(order).map(([id, ids]) => [
          id,
          ids.map((attributeId) => labels.get(attributeId)),
        ]),
      ),
    ).toEqual(expected);
  });

  it('AC-REQ-006-03 leaves mappings, text blocks, GPSR, merchant details, condition codes and suppliers empty', async () => {
    expect(await get('/api/suppliers?includeInactive=true')).toEqual({ items: [], total: 0 });
    expect(await get('/api/manufacturers?includeInactive=true')).toEqual({ items: [], total: 0 });
    for (const table of [
      'category_mapping',
      'condition_mapping',
      'text_block',
      'text_block_device_type',
      'text_block_channel',
      'manufacturer',
      'condition_code',
      'supplier',
      'media_file',
    ]) {
      expect({ table, rows: rows(`SELECT * FROM ${table}`) }).toEqual({ table, rows: [] });
    }
    // Exactly one record of merchant details, empty and without logo (3.1, 3.8).
    expect(
      rows('SELECT id, brand_name, contact_text, logo_hash, version FROM merchant_profile'),
    ).toEqual([{ id: 1, brand_name: '', contact_text: '', logo_hash: null, version: 1 }]);
  });

  it('writes no audit entries and leaves no foreign key findings', () => {
    expect(rows('SELECT * FROM audit_entry')).toEqual([]);
    expect(t.database.sqlite.pragma('foreign_key_check')).toEqual([]);
  });

  it('AC-REQ-006-02 renames an attribute of the device type Notebook (the initial settings are settings)', async () => {
    const ram = (await attributesOf('Notebook')).find(({ label }) => label === 'RAM');
    const { version } = rows<{ version: number }>(
      'SELECT version FROM attribute WHERE id = ?',
      ram?.id,
    )[0] ?? { version: 0 };
    const response = await t.app.inject({
      method: 'PATCH',
      url: `/api/attributes/${ram?.id}`,
      headers: SAME_ORIGIN_WRITE,
      payload: { version, label: 'Arbeitsspeicher' },
    });
    expect(response.statusCode).toBe(200);
    expect((await attributesOf('Notebook')).map(({ label }) => label)).toContain('Arbeitsspeicher');
  });

  it('DER-33-11 a second migration run does not apply the initial settings again and keeps changed values', async () => {
    const ram = (await attributesOf('Notebook')).find(({ label }) => label === 'RAM');
    const response = await t.app.inject({
      method: 'PATCH',
      url: `/api/attributes/${ram?.id}`,
      headers: SAME_ORIGIN_WRITE,
      payload: { version: 1, label: 'Arbeitsspeicher', required: false },
    });
    expect(response.statusCode).toBe(200);
    const snapshot = () =>
      Object.fromEntries(
        [
          'device_type',
          'attribute',
          'pick_list',
          'pick_list_value',
          'title_pattern',
          'channel',
          'attribute_mapping',
          'description_template',
          'datasheet_layout',
          'merchant_profile',
        ].map((table) => [table, rows(`SELECT * FROM ${table} ORDER BY rowid`)]),
      );
    const before = snapshot();

    // Like the start of a new program version on the existing database.
    await expect(runMigrations(t.database, migrations, () => new Date())).resolves.toEqual([]);

    expect(snapshot()).toEqual(before);
    expect(rows('SELECT label, required FROM attribute WHERE id = ?', ram?.id)).toEqual([
      { label: 'Arbeitsspeicher', required: 0 },
    ]);
    expect(rows("SELECT COUNT(*) AS n FROM app_migration WHERE name LIKE '%seed%'")).toEqual([
      { n: 1 },
    ]);
  });
});
