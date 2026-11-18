import { describe, expect, it } from 'vitest';

import { FIELD_MESSAGES } from '../messages/messages.de.ts';
import {
  EMPTY_GPSR,
  GPSR_LABELS,
  GPSR_REQUIRED_FIELDS,
  gpsrMissingOf,
  gpsrSchema,
  manufacturerCreateResultSchema,
  manufacturerCreateSchema,
  manufacturerNameSchema,
  manufacturerSchema,
  manufacturerUpdateResultSchema,
  manufacturerUpdateSchema,
  type Gpsr,
} from './manufacturer.schema.ts';

const NAME_TEXT = 'Name: 1 bis 50 Zeichen';

const messagesOf = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? [];

const LENOVO = {
  id: 1,
  name: 'Lenovo',
  active: true,
  gpsrComplete: false,
  gpsrMissing: ['legalName', 'street', 'postalCode', 'city', 'country', 'contact'],
  gpsr: {
    legalName: '',
    street: '',
    postalCode: '',
    city: '',
    country: '',
    contact: '',
    euRpName: '',
    euRpAddress: '',
    euRpContact: '',
  },
  version: 1,
};

describe('manufacturer schemas (CU-065)', () => {
  it('AC-REQ-100-01 trims the name " Fujitsu " to "Fujitsu"', () => {
    expect(manufacturerCreateSchema.parse({ name: ' Fujitsu ' })).toEqual({ name: 'Fujitsu' });
  });

  it('accepts a name of 50 characters after trimming', () => {
    expect(manufacturerNameSchema.parse(` ${'a'.repeat(50)} `)).toBe('a'.repeat(50));
  });

  it.each([
    ['empty', ''],
    ['only spaces', '   '],
    ['51 characters', 'a'.repeat(51)],
  ])('AC-REQ-100-03 rejects a name that is %s and names the rule', (_case, name) => {
    expect(messagesOf(manufacturerNameSchema.safeParse(name))).toEqual([NAME_TEXT]);
  });

  it('rejects unknown fields on create, so there is no id, status or version', () => {
    expect(manufacturerCreateSchema.safeParse({ name: 'HP', active: false }).success).toBe(false);
  });

  it('needs the version on update; name and status are optional (2.0.3)', () => {
    expect(manufacturerUpdateSchema.parse({ version: 2, name: ' HP ' })).toEqual({
      version: 2,
      name: 'HP',
    });
    expect(manufacturerUpdateSchema.parse({ version: 2, active: false })).toEqual({
      version: 2,
      active: false,
    });
    expect(manufacturerUpdateSchema.safeParse({ name: 'HP' }).success).toBe(false);
    expect(messagesOf(manufacturerUpdateSchema.safeParse({ version: 1, name: '' }))).toEqual([
      NAME_TEXT,
    ]);
  });

  it('describes the manufacturer of the answers with its GPSR chip (2.2)', () => {
    expect(manufacturerSchema.parse(LENOVO)).toEqual(LENOVO);
  });

  it('marks the answer of POST with existing (AC-REQ-100-02)', () => {
    expect(manufacturerCreateResultSchema.parse({ ...LENOVO, existing: true })).toEqual({
      ...LENOVO,
      existing: true,
    });
    expect(manufacturerCreateResultSchema.safeParse(LENOVO).success).toBe(false);
  });

  it('answers PATCH with manufacturer and impact (2.2)', () => {
    const answer = { manufacturer: LENOVO, impact: { updated: 0, rerelease: 0, manualReview: 0 } };
    expect(manufacturerUpdateResultSchema.parse(answer)).toEqual(answer);
  });
});

const COMPLETE_GPSR: Gpsr = {
  legalName: 'Lenovo PC HK Limited',
  street: 'Meitnerstraße 9',
  postalCode: '70563',
  city: 'Stuttgart',
  country: 'Deutschland',
  contact: 'info@lenovo.com',
  euRpName: '',
  euRpAddress: '',
  euRpContact: '',
};

describe('GPSR details (CU-065, Technical Specification 2.2, 3.1)', () => {
  it('trims the fields at the edges; the address of the responsible person keeps its lines', () => {
    expect(
      gpsrSchema.parse({
        ...COMPLETE_GPSR,
        legalName: ' Lenovo PC HK Limited ',
        euRpAddress: ' Weg 1\n12345 Ort ',
      }),
    ).toEqual({ ...COMPLETE_GPSR, euRpAddress: 'Weg 1\n12345 Ort' });
  });

  it('needs all nine fields and no others', () => {
    expect(gpsrSchema.safeParse({ ...COMPLETE_GPSR, contact: undefined }).success).toBe(false);
    expect(gpsrSchema.safeParse({ ...COMPLETE_GPSR, productId: 'x' }).success).toBe(false);
  });

  it.each([
    ['legalName', 200, 'Herstellername: höchstens 200 Zeichen'],
    ['street', 200, 'Straße und Hausnummer: höchstens 200 Zeichen'],
    ['postalCode', 20, 'Postleitzahl: höchstens 20 Zeichen'],
    ['city', 100, 'Ort: höchstens 100 Zeichen'],
    ['country', 100, 'Land: höchstens 100 Zeichen'],
    ['euRpName', 200, 'Name der verantwortlichen Person: höchstens 200 Zeichen'],
    ['euRpAddress', 500, 'Postanschrift der verantwortlichen Person: höchstens 500 Zeichen'],
    ['euRpContact', 254, 'Kontaktadresse der verantwortlichen Person: höchstens 254 Zeichen'],
  ] as const)(
    'DER-41-01 %s takes %i characters, one more gives the text M-05 to M-13',
    (field, max, text) => {
      expect(gpsrSchema.safeParse({ ...COMPLETE_GPSR, [field]: 'x'.repeat(max) }).success).toBe(
        true,
      );
      const result = gpsrSchema.safeParse({ ...COMPLETE_GPSR, [field]: 'x'.repeat(max + 1) });
      expect(result.error?.issues.map(({ path, message }) => ({ path, message }))).toEqual([
        { path: [field], message: text },
      ]);
    },
  );

  it('DER-41-01 a contact of 255 characters gives only M-10, not the format text', () => {
    const contact = `${'a'.repeat(244)}@lenovo.com`;
    expect(contact).toHaveLength(255);
    expect(messagesOf(gpsrSchema.safeParse({ ...COMPLETE_GPSR, contact }))).toEqual([
      'Elektronische Kontaktadresse: höchstens 254 Zeichen',
    ]);
  });

  it.each(['info@lenovo.com', 'https://www.lenovo.com/kontakt', 'http://lenovo.de', ''])(
    'DER-41-02 accepts the contact "%s"',
    (contact) => {
      expect(gpsrSchema.safeParse({ ...COMPLETE_GPSR, contact }).success).toBe(true);
    },
  );

  it.each(['lenovo.com', 'info@', 'ftp://lenovo.com', 'https://', 'Lenovo Kundendienst'])(
    'DER-41-02 rejects the contact "%s" with "E-Mail-Adresse oder Internetadresse ungültig"',
    (contact) => {
      expect(messagesOf(gpsrSchema.safeParse({ ...COMPLETE_GPSR, contact }))).toEqual([
        'E-Mail-Adresse oder Internetadresse ungültig',
      ]);
    },
  );

  it('AC-REQ-027-01 legal name, full postal address and e-mail address are complete', () => {
    expect(gpsrMissingOf(COMPLETE_GPSR)).toEqual([]);
  });

  it('AC-REQ-027-02 a postal address without postal code is incomplete and names the postal code', () => {
    expect(gpsrMissingOf({ ...COMPLETE_GPSR, postalCode: '' })).toEqual(['postalCode']);
  });

  it('DER-41-03 names every missing part in the order of the form; the responsible person is optional', () => {
    expect(gpsrMissingOf(EMPTY_GPSR)).toEqual([
      'legalName',
      'street',
      'postalCode',
      'city',
      'country',
      'contact',
    ]);
  });

  it('DER-41-03 names a missing part as "<Teil> fehlt"', () => {
    expect(
      GPSR_REQUIRED_FIELDS.map((field) => FIELD_MESSAGES.gpsrMissing(GPSR_LABELS[field])),
    ).toEqual([
      'Herstellername fehlt',
      'Straße und Hausnummer fehlt',
      'Postleitzahl fehlt',
      'Ort fehlt',
      'Land fehlt',
      'Elektronische Kontaktadresse fehlt',
    ]);
  });

  it('takes gpsr on update (2.2)', () => {
    expect(manufacturerUpdateSchema.parse({ version: 1, gpsr: COMPLETE_GPSR })).toEqual({
      version: 1,
      gpsr: COMPLETE_GPSR,
    });
  });
});
