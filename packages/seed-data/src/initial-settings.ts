import type {
  AttributeDataType,
  AttributeLevel,
  AttributeSystemRole,
  DatasheetBlock,
} from '@resellr/domain/schemas/attribute.schema';
import type { PickListKey } from '@resellr/domain/schemas/pick-list.schema';

// Initial settings (CU-070; Technical Specification 2.1.1, Requirements 9.2, 9.3, 9.8, 9.12,
// REQ-006): data only, no customer-specific content (REQ-074). The seed migration CU-071 writes
// them once when the database is created; later updates never change them in an existing
// installation. Not shipped on purpose (AC-REQ-006-03): category and condition mappings, texts
// of text blocks, GPSR details, merchant details, condition codes and suppliers.
//
// Attributes, title patterns and attribute mappings name an attribute by its label; the
// migration resolves the label to the id of the attribute of the device type.

export interface InitialPickListValue {
  label: string;
  /** Flag "Akku vorhanden", only in the list battery (REQ-007). */
  batteryPresent?: boolean;
}

export interface InitialPickList {
  key: PickListKey;
  name: string;
  values: readonly InitialPickListValue[];
}

/** Pick lists in the order of Requirements 9.2; "Optik-Note" is a fixed number, no list. */
export const INITIAL_PICK_LISTS: readonly InitialPickList[] = [
  {
    key: 'condition',
    name: 'Zustand',
    values: [{ label: 'gebraucht' }, { label: 'defekt' }, { label: 'refurbished' }],
  },
  {
    key: 'keyboard_layout',
    name: 'Tastaturlayout',
    values: [
      { label: 'Deutsch (QWERTZ)' },
      { label: 'Ungarisch' },
      { label: 'Englisch (QWERTY, US)' },
      { label: 'Englisch (QWERTY, UK)' },
    ],
  },
  {
    key: 'power_supply',
    name: 'Netzteil',
    values: [
      { label: 'mit Netzteil (original)' },
      { label: 'mit Netzteil (nicht original)' },
      { label: 'ohne Netzteil' },
    ],
  },
  {
    key: 'battery',
    name: 'Akku',
    values: [
      { label: 'mit Akku', batteryPresent: true },
      { label: 'mit Akku (defekt)', batteryPresent: true },
      { label: 'ohne Akku', batteryPresent: false },
    ],
  },
  {
    key: 'storage_type',
    name: 'Speichertyp',
    values: [{ label: 'SSD (SATA)' }, { label: 'SSD (NVMe)' }, { label: 'HDD' }, { label: 'eMMC' }],
  },
  {
    key: 'display_surface',
    name: 'Display-Oberfläche',
    values: [{ label: 'matt' }, { label: 'glänzend' }],
  },
  {
    key: 'operating_system',
    name: 'Betriebssystem',
    values: [
      { label: 'Windows 11 Pro' },
      { label: 'Windows 11 Home' },
      { label: 'Windows 10 Pro' },
      { label: 'macOS' },
      { label: 'iOS' },
      { label: 'iPadOS' },
      { label: 'Android' },
      { label: 'ohne Betriebssystem' },
    ],
  },
  {
    key: 'port_type',
    name: 'Anschlusstyp',
    values: [
      { label: 'USB-A 2.0' },
      { label: 'USB-A 3.x' },
      { label: 'USB-C' },
      { label: 'USB-C Thunderbolt' },
      { label: 'HDMI' },
      { label: 'DisplayPort' },
      { label: 'VGA' },
      { label: 'LAN (RJ45)' },
      { label: 'Kartenleser' },
      { label: 'Audio (Kombi)' },
      { label: 'Seriell' },
    ],
  },
  {
    key: 'port_position',
    name: 'Anschlussposition',
    values: [{ label: 'vorn' }, { label: 'hinten' }],
  },
];

/** Device types in their order (Requirements 9.3). */
export const INITIAL_DEVICE_TYPES = ['Notebook', 'PC/Mini-PC', 'Tablet', 'Smartphone'] as const;
export type InitialDeviceType = (typeof INITIAL_DEVICE_TYPES)[number];

/** Level, flag "variantenbildend" and "Pflicht" of an attribute at one device type. */
export interface InitialAttributeUse {
  level: AttributeLevel;
  required: boolean;
  variantForming: boolean;
}

// The cells of the table in Requirements 9.3: M = model, G = device, P = required,
// V = variant forming.
const M: InitialAttributeUse = { level: 'model', required: false, variantForming: false };
const MP: InitialAttributeUse = { level: 'model', required: true, variantForming: false };
const G: InitialAttributeUse = { level: 'device', required: false, variantForming: false };
const GV: InitialAttributeUse = { level: 'device', required: false, variantForming: true };
const GPV: InitialAttributeUse = { level: 'device', required: true, variantForming: true };

export interface InitialAttribute {
  label: string;
  dataType: AttributeDataType;
  systemRole: AttributeSystemRole | null;
  unit: string | null;
  /** Output with a space between number and unit ("13,3 Zoll") or without ("16GB"). */
  unitSpacing: boolean;
  /** Canonical decimal strings, only for integer and decimal. */
  minValue: string | null;
  maxValue: string | null;
  pickList: PickListKey | null;
  datasheetBlock: DatasheetBlock;
  /** Device types that have the attribute; the others do not. */
  uses: Partial<Record<InitialDeviceType, InitialAttributeUse>>;
}

const NONE = {
  systemRole: null,
  unit: null,
  unitSpacing: true,
  minValue: null,
  maxValue: null,
  pickList: null,
} as const;

/**
 * Attributes in the order of Requirements 9.3, which is the order of each device type. RAM and
 * storage are written without a space ("16GB", "512GB", Requirements test data MV-A). Data sheet
 * blocks after 9.12 and REQ-005: power supply and battery under "Lieferumfang", ports under
 * "Anschlüsse", operating system under "Software", all others under "Technik".
 */
export const INITIAL_ATTRIBUTES: readonly InitialAttribute[] = [
  {
    ...NONE,
    label: 'Prozessor',
    dataType: 'text',
    datasheetBlock: 'technical',
    uses: { Notebook: MP, 'PC/Mini-PC': MP, Tablet: M, Smartphone: M },
  },
  {
    ...NONE,
    label: 'Prozessorkerne',
    dataType: 'integer',
    datasheetBlock: 'technical',
    uses: { Notebook: M, 'PC/Mini-PC': M },
  },
  {
    ...NONE,
    label: 'Prozessortakt',
    dataType: 'decimal',
    unit: 'GHz',
    datasheetBlock: 'technical',
    uses: { Notebook: M, 'PC/Mini-PC': M },
  },
  {
    ...NONE,
    label: 'RAM',
    dataType: 'integer',
    unit: 'GB',
    unitSpacing: false,
    datasheetBlock: 'technical',
    uses: { Notebook: GPV, 'PC/Mini-PC': GPV, Tablet: M, Smartphone: M },
  },
  {
    ...NONE,
    label: 'RAM-Typ',
    dataType: 'text',
    datasheetBlock: 'technical',
    uses: { Notebook: G, 'PC/Mini-PC': G },
  },
  {
    ...NONE,
    label: 'Speicherkapazität',
    dataType: 'integer',
    unit: 'GB',
    unitSpacing: false,
    datasheetBlock: 'technical',
    uses: { Notebook: GPV, 'PC/Mini-PC': GPV, Tablet: MP, Smartphone: MP },
  },
  {
    ...NONE,
    label: 'Speichertyp',
    dataType: 'pick',
    pickList: 'storage_type',
    datasheetBlock: 'technical',
    uses: { Notebook: GV, 'PC/Mini-PC': GV },
  },
  {
    ...NONE,
    label: 'Zweiter Speicherplatz',
    dataType: 'text',
    datasheetBlock: 'technical',
    uses: { Notebook: G, 'PC/Mini-PC': G },
  },
  {
    ...NONE,
    label: 'Optisches Laufwerk',
    dataType: 'text',
    datasheetBlock: 'technical',
    uses: { Notebook: M, 'PC/Mini-PC': M },
  },
  {
    ...NONE,
    label: 'Displaygröße',
    dataType: 'decimal',
    unit: 'Zoll',
    datasheetBlock: 'technical',
    uses: { Notebook: MP, Tablet: MP, Smartphone: MP },
  },
  {
    ...NONE,
    label: 'Auflösung',
    dataType: 'text',
    datasheetBlock: 'technical',
    uses: { Notebook: M, Tablet: M, Smartphone: M },
  },
  {
    ...NONE,
    label: 'Display-Oberfläche',
    dataType: 'pick',
    pickList: 'display_surface',
    datasheetBlock: 'technical',
    uses: { Notebook: M },
  },
  {
    ...NONE,
    label: 'Touchscreen',
    dataType: 'boolean',
    datasheetBlock: 'technical',
    uses: { Notebook: M },
  },
  {
    ...NONE,
    label: 'Grafik 1',
    dataType: 'text',
    datasheetBlock: 'technical',
    uses: { Notebook: M, 'PC/Mini-PC': M },
  },
  {
    ...NONE,
    label: 'Grafik 2',
    dataType: 'text',
    datasheetBlock: 'technical',
    uses: { Notebook: M, 'PC/Mini-PC': M },
  },
  {
    ...NONE,
    label: 'Tastaturlayout',
    dataType: 'pick',
    systemRole: 'keyboard_layout',
    pickList: 'keyboard_layout',
    datasheetBlock: 'technical',
    uses: { Notebook: GPV },
  },
  {
    ...NONE,
    label: 'Tastaturbeleuchtung',
    dataType: 'boolean',
    datasheetBlock: 'technical',
    uses: { Notebook: M },
  },
  {
    ...NONE,
    label: 'Ziffernblock',
    dataType: 'boolean',
    datasheetBlock: 'technical',
    uses: { Notebook: M },
  },
  {
    ...NONE,
    label: 'Fingerprint',
    dataType: 'boolean',
    datasheetBlock: 'technical',
    uses: { Notebook: M, Tablet: M, Smartphone: M },
  },
  {
    ...NONE,
    label: 'WLAN',
    dataType: 'text',
    datasheetBlock: 'technical',
    uses: { Notebook: M, 'PC/Mini-PC': M, Tablet: M, Smartphone: M },
  },
  {
    ...NONE,
    label: 'Bluetooth',
    dataType: 'text',
    datasheetBlock: 'technical',
    uses: { Notebook: M, 'PC/Mini-PC': M, Tablet: M, Smartphone: M },
  },
  {
    ...NONE,
    label: 'Mobilfunk (LTE/5G)',
    dataType: 'boolean',
    datasheetBlock: 'technical',
    uses: { Notebook: M, Tablet: M, Smartphone: M },
  },
  {
    ...NONE,
    label: 'LAN',
    dataType: 'boolean',
    datasheetBlock: 'technical',
    uses: { Notebook: M, 'PC/Mini-PC': M },
  },
  {
    ...NONE,
    label: 'Webcam',
    dataType: 'text',
    datasheetBlock: 'technical',
    uses: { Notebook: M, Tablet: M, Smartphone: M },
  },
  {
    ...NONE,
    label: 'Anschlüsse',
    dataType: 'ports',
    datasheetBlock: 'ports',
    uses: { Notebook: M, 'PC/Mini-PC': M, Tablet: M, Smartphone: M },
  },
  {
    ...NONE,
    label: 'Betriebssystem',
    dataType: 'pick',
    pickList: 'operating_system',
    datasheetBlock: 'software',
    uses: { Notebook: GPV, 'PC/Mini-PC': GPV, Tablet: GPV, Smartphone: GPV },
  },
  {
    ...NONE,
    label: 'Betriebssystem-Version',
    dataType: 'text',
    datasheetBlock: 'software',
    uses: { Notebook: G, 'PC/Mini-PC': G, Tablet: G, Smartphone: G },
  },
  {
    ...NONE,
    label: 'Farbe',
    dataType: 'text',
    datasheetBlock: 'technical',
    uses: { Notebook: M, 'PC/Mini-PC': M, Tablet: M, Smartphone: M },
  },
  {
    ...NONE,
    label: 'Netzteil',
    dataType: 'pick',
    systemRole: 'power_supply',
    pickList: 'power_supply',
    datasheetBlock: 'delivery_scope',
    uses: { Notebook: GPV, Tablet: GPV, Smartphone: GV },
  },
  {
    ...NONE,
    label: 'Akku',
    dataType: 'pick',
    systemRole: 'battery',
    pickList: 'battery',
    datasheetBlock: 'delivery_scope',
    uses: { Notebook: GPV, Tablet: GPV, Smartphone: GPV },
  },
  {
    ...NONE,
    label: 'Akkukapazität',
    dataType: 'integer',
    systemRole: 'battery_capacity',
    unit: '%',
    minValue: '0',
    maxValue: '100',
    datasheetBlock: 'delivery_scope',
    // Never variant forming (A-16).
    uses: { Notebook: G, Tablet: G, Smartphone: G },
  },
];

/** Fields of model data a title pattern or an attribute mapping can name (3.4). */
export type InitialModelField =
  'manufacturer' | 'modelName' | 'typeDesignation' | 'mpn' | 'deviceType';

export type InitialTitlePart = (
  { kind: 'field'; field: InitialModelField } | { kind: 'attribute'; attribute: string }
) & { prefix: string; suffix: string; priority: number };

const MANUFACTURER = {
  kind: 'field',
  field: 'manufacturer',
  prefix: '',
  suffix: '',
  priority: 1,
} as const;
const MODEL_NAME = {
  kind: 'field',
  field: 'modelName',
  prefix: ' ',
  suffix: '',
  priority: 1,
} as const;
const TYPE_DESIGNATION = {
  kind: 'field',
  field: 'typeDesignation',
  prefix: ' (',
  suffix: ')',
  priority: 1,
} as const;

/**
 * Title patterns of the device types, no channel's own pattern (Requirements 9.3, 9.12):
 * Notebook, PC/Mini-PC `{Hersteller} {Modellbezeichnung} ({Typbezeichnung}), {Prozessor},
 * {RAM} RAM, {Speicherkapazität} {Farbe}`; Tablet, Smartphone `{Hersteller} {Modellbezeichnung}
 * ({Typbezeichnung}), {Speicherkapazität}, {Betriebssystem-Version}, {Farbe}`.
 */
const COMPUTER_TITLE: readonly InitialTitlePart[] = [
  MANUFACTURER,
  MODEL_NAME,
  TYPE_DESIGNATION,
  { kind: 'attribute', attribute: 'Prozessor', prefix: ', ', suffix: '', priority: 1 },
  { kind: 'attribute', attribute: 'RAM', prefix: ', ', suffix: ' RAM', priority: 2 },
  { kind: 'attribute', attribute: 'Speicherkapazität', prefix: ', ', suffix: '', priority: 3 },
  { kind: 'attribute', attribute: 'Farbe', prefix: ' ', suffix: '', priority: 4 },
];
const MOBILE_TITLE: readonly InitialTitlePart[] = [
  MANUFACTURER,
  MODEL_NAME,
  TYPE_DESIGNATION,
  { kind: 'attribute', attribute: 'Speicherkapazität', prefix: ', ', suffix: '', priority: 2 },
  {
    kind: 'attribute',
    attribute: 'Betriebssystem-Version',
    prefix: ', ',
    suffix: '',
    priority: 3,
  },
  { kind: 'attribute', attribute: 'Farbe', prefix: ', ', suffix: '', priority: 4 },
];

export const INITIAL_TITLE_PATTERNS: Readonly<
  Record<InitialDeviceType, readonly InitialTitlePart[]>
> = {
  Notebook: COMPUTER_TITLE,
  'PC/Mini-PC': COMPUTER_TITLE,
  Tablet: MOBILE_TITLE,
  Smartphone: MOBILE_TITLE,
};

export type InitialChannelCode = 'shop' | 'kleinanzeigen' | 'ebay';

export interface InitialChannel {
  code: InitialChannelCode;
  name: string;
  titleMaxLength: number;
  vbAllowed: boolean;
}

/**
 * Channels in their order, all active, without price rule (Requirements 9.12). 80 and 128
 * characters are under review OP-22 (Technical Specification 2.1.1).
 */
export const INITIAL_CHANNELS: readonly InitialChannel[] = [
  { code: 'shop', name: 'Shop', titleMaxLength: 128, vbAllowed: false },
  { code: 'kleinanzeigen', name: 'Kleinanzeigen', titleMaxLength: 65, vbAllowed: true },
  { code: 'ebay', name: 'eBay', titleMaxLength: 80, vbAllowed: false },
];

/** Source of a channel field (Requirements 9.11; Technical Specification 3.4). */
export type InitialFieldSource =
  | { kind: 'attribute'; attribute: string }
  | {
      kind: 'field';
      field:
        | InitialModelField
        | 'ean'
        | 'articleNumber'
        | 'conditionDescription'
        | 'conditionLabel'
        | 'quantity';
    };

export interface InitialChannelField {
  label: string;
  source: InitialFieldSource;
}

const attribute = (label: string, name = label): InitialChannelField => ({
  label,
  source: { kind: 'attribute', attribute: name },
});
const field = (label: string, name: Extract<InitialFieldSource, { kind: 'field' }>['field']) => ({
  label,
  source: { kind: 'field', field: name } as const,
});

/**
 * Attribute mappings, the same for all four device types; a field whose attribute the device
 * type lacks is left out for it. No field is required by the channel (Requirements 9.8).
 */
export const INITIAL_ATTRIBUTE_MAPPINGS: Readonly<
  Record<InitialChannelCode, readonly InitialChannelField[]>
> = {
  shop: [
    field('Artikelnummer', 'articleNumber'),
    field('EAN-13', 'ean'),
    field('Herstellernummer (MPN)', 'mpn'),
    field('Hersteller', 'manufacturer'),
    attribute('Prozessor'),
    attribute('RAM'),
    attribute('Speicher', 'Speicherkapazität'),
    attribute('Display', 'Displaygröße'),
    attribute('Anschlüsse'),
    attribute('Betriebssystem'),
    field('Stückzahl', 'quantity'),
  ],
  kleinanzeigen: [
    field('Typ', 'deviceType'),
    field('Marke', 'manufacturer'),
    field('Modell', 'modelName'),
    field('Zustand', 'conditionLabel'),
    attribute('Betriebssystem'),
    attribute('Prozessor'),
    attribute('RAM'),
    attribute('Speicher', 'Speicherkapazität'),
    attribute('Farbe'),
  ],
  ebay: [
    field('Marke', 'manufacturer'),
    field('Modell', 'modelName'),
    attribute('Prozessor'),
    attribute('Bildschirmgröße', 'Displaygröße'),
    attribute('Arbeitsspeicher', 'RAM'),
    attribute('Speicherkapazität'),
    attribute('Betriebssystem'),
    attribute('Farbe'),
    field('Herstellernummer', 'mpn'),
    field('EAN', 'ean'),
    field('Zustandsbeschreibung', 'conditionDescription'),
  ],
};

/** Kinds of text blocks a template line can name ("Bausteine Art X", REQ-031). */
export type InitialTextBlockKind = 'battery_notice' | 'pickup_contact' | 'legal';

export type InitialTemplateLine =
  { kind: 'text'; text: string } | { kind: 'textBlockKind'; textBlockKind: InitialTextBlockKind };

/** A section for all device types; `heading` "" is a section without heading. */
export interface InitialTemplateSection {
  heading: string;
  lines: readonly InitialTemplateLine[];
}

const text = (value: string): InitialTemplateLine => ({ kind: 'text', text: value });
const blocks = (kind: InitialTextBlockKind): InitialTemplateLine => ({
  kind: 'textBlockKind',
  textBlockKind: kind,
});

const CONDITION: InitialTemplateSection = {
  heading: 'Zustand',
  lines: [text('{Zustandsbezeichnung Kanal}'), text('{Zustandsbeschreibung}')],
};
const DELIVERY_SCOPE: InitialTemplateSection = {
  heading: 'Lieferumfang',
  lines: [
    text('{Lieferumfang}'),
    text('Netzteil: {Netzteil}'),
    text('Akku: {Akku}'),
    text('Akkukapazität: {Akkukapazität}'),
    blocks('battery_notice'),
  ],
};
const LEGAL: InitialTemplateSection = { heading: '', lines: [blocks('legal')] };

/** Description templates of the channels (Requirements 9.12). */
export const INITIAL_DESCRIPTION_TEMPLATES: Readonly<
  Record<InitialChannelCode, readonly InitialTemplateSection[]>
> = {
  shop: [
    CONDITION,
    DELIVERY_SCOPE,
    { heading: 'Artikeldetails', lines: [text('{Merkmalsliste}')] },
    LEGAL,
  ],
  kleinanzeigen: [
    { heading: '', lines: [text('WI-Nr: {WI-Nr}'), text('ProduktNr. {Herstellernummer}')] },
    CONDITION,
    DELIVERY_SCOPE,
    { heading: 'Technische Daten', lines: [text('{Merkmalsliste}')] },
    { heading: 'Abholung und Kontakt', lines: [blocks('pickup_contact')] },
    LEGAL,
  ],
  ebay: [
    CONDITION,
    DELIVERY_SCOPE,
    { heading: 'Technische Daten', lines: [text('{Merkmalsliste}')] },
    LEGAL,
  ],
};

/**
 * Data sheet layout (Requirements 9.12); the order of the attributes per device type is the
 * order of `INITIAL_ATTRIBUTES`.
 */
export const INITIAL_DATASHEET_LAYOUT: {
  headerLabels: readonly string[];
  blockOrder: readonly DatasheetBlock[];
} = {
  headerLabels: ['Shop:', 'eBay:', 'Kleinanzeigen:'],
  blockOrder: ['identification', 'condition', 'delivery_scope', 'technical', 'ports', 'software'],
};
