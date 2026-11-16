import { describe, expect, it } from 'vitest';

import {
  modelTemplateCreateSchema,
  modelTemplateListSchema,
  modelTemplateSchema,
  modelTemplateSearchKey,
  modelTemplateSearchTermSchema,
} from './model-template.schema.ts';

const messagesOf = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? [];

const MV_A_ITEM = {
  id: 1,
  deviceType: { id: 1, name: 'Notebook' },
  manufacturer: { id: 3, name: 'Apple' },
  modelName: 'MacBook Pro 13',
  typeDesignation: 'A1708',
  mpn: 'MHGT3D/A',
  mpnUnknown: false,
};

describe('model template schemas (CU-104)', () => {
  it('AC-REQ-009-04 rejects a search term with 1 character with "Mindestens 2 Zeichen"', () => {
    expect(messagesOf(modelTemplateSearchTermSchema.safeParse('m'))).toEqual([
      'Mindestens 2 Zeichen',
    ]);
  });

  it('counts the search term after trimming, so " m " is still 1 character', () => {
    expect(messagesOf(modelTemplateSearchTermSchema.safeParse(' m '))).toEqual([
      'Mindestens 2 Zeichen',
    ]);
  });

  it('accepts a search term from 2 characters and trims it', () => {
    expect(modelTemplateSearchTermSchema.parse(' mb ')).toBe('mb');
  });

  it('builds the search key from model name, type designation and MPN in lower case (2.4)', () => {
    expect(
      modelTemplateSearchKey({
        modelName: ' MacBook Pro 13 ',
        typeDesignation: 'A1708',
        mpn: 'MHGT3D/A',
      }),
    ).toBe('macbook pro 13\na1708\nmhgt3d/a');
  });

  it('leaves out a missing type designation and an unknown MPN from the search key', () => {
    expect(
      modelTemplateSearchKey({ modelName: 'ThinkPad T14', typeDesignation: null, mpn: null }),
    ).toBe('thinkpad t14');
  });

  it('describes a list item with device type, manufacturer, names and MPN (2.4)', () => {
    expect(modelTemplateListSchema.parse({ items: [MV_A_ITEM], total: 1 })).toEqual({
      items: [MV_A_ITEM],
      total: 1,
    });
  });

  it('describes a list item with MPN "unbekannt" as mpn null and mpnUnknown true', () => {
    const item = { ...MV_A_ITEM, mpn: null, mpnUnknown: true, typeDesignation: null };
    expect(modelTemplateListSchema.parse({ items: [item], total: 1 }).items).toEqual([item]);
  });

  it('describes a model template with the fields of 3.3 without the internal keys', () => {
    const template = {
      id: 1,
      deviceTypeId: 1,
      manufacturerId: 3,
      modelName: 'MacBook Pro 13',
      typeDesignation: 'A1708',
      mpn: 'MHGT3D/A',
      mpnUnknown: false,
      originalEan: null,
      modelValues: { '4': 'Intel Core i5' },
      defaultDeviceValues: {},
      version: 1,
      createdAt: '2026-11-07T16:05:12.345Z',
      updatedAt: '2026-11-07T16:05:12.345Z',
    };
    expect(modelTemplateSchema.parse({ ...template, searchKey: 'x' })).toEqual(template);
  });
});

/** A valid new model template of UI-007 as `web-ui` sends it (2.4). */
const MV_A_CREATE = {
  deviceTypeId: 1,
  manufacturerId: 3,
  modelName: 'MacBook Pro 13',
  typeDesignation: 'A1708',
  mpn: 'MHGT3D/A',
  mpnUnknown: false,
  originalEan: '',
};

/** Issues of a create request as `{ path, code, message }`, the shape of `fields[]` (2.0.5). */
const issuesOf = (body: unknown) =>
  (modelTemplateCreateSchema.safeParse(body).error?.issues ?? []).map((issue) => ({
    path: issue.path.join('.'),
    code: (issue as { params?: { code?: string } }).params?.code ?? issue.code,
    message: issue.message,
  }));

const mpnIssues = (mpn: string) => issuesOf({ ...MV_A_CREATE, mpn });

const MPN_REQUIRED = 'Herstellernummer: Wert eingeben oder ‚unbekannt‘ wählen';
const MPN_TOO_LONG = 'Herstellernummer: höchstens 40 Zeichen';
const MPN_INVALID = 'Herstellernummer: nur Buchstaben, Ziffern und die Zeichen - / . erlaubt';

describe('model template create schema (CU-104, 2.4)', () => {
  it('accepts a complete model template and stores empty optional fields as null', () => {
    expect(
      modelTemplateCreateSchema.parse({ ...MV_A_CREATE, typeDesignation: ' ', originalEan: '' }),
    ).toEqual({ ...MV_A_CREATE, typeDesignation: null, originalEan: null });
  });

  it('AC-REQ-008-02 rejects an empty MPN without "unbekannt" with the wording of the AC', () => {
    expect(mpnIssues('')).toEqual([{ path: 'mpn', code: 'mpn_required', message: MPN_REQUIRED }]);
    expect(mpnIssues('   ')).toEqual([
      { path: 'mpn', code: 'mpn_required', message: MPN_REQUIRED },
    ]);
  });

  it('AC-REQ-008-03 accepts "unbekannt" with mpn null', () => {
    expect(
      modelTemplateCreateSchema.parse({ ...MV_A_CREATE, mpn: null, mpnUnknown: true }),
    ).toMatchObject({ mpn: null, mpnUnknown: true });
  });

  it('DER-50-17 rejects 41 characters with mpn_too_long (M-25) and accepts 40', () => {
    expect(mpnIssues('A'.repeat(41))).toEqual([
      { path: 'mpn', code: 'mpn_too_long', message: MPN_TOO_LONG },
    ]);
    expect(mpnIssues('A'.repeat(40))).toEqual([]);
  });

  it.each(['ABC#123', 'ÄB-12', '20TD 002MGE', '6FY52AV#ABD'])(
    'DER-50-17 rejects "%s" with mpn_invalid_chars (M-26)',
    (mpn) => {
      expect(mpnIssues(mpn)).toEqual([
        { path: 'mpn', code: 'mpn_invalid_chars', message: MPN_INVALID },
      ]);
    },
  );

  it('DER-50-17 gives only M-25 for 45 characters with "#", and M-26 once cut to 40', () => {
    const value = `${'A'.repeat(20)}#${'B'.repeat(24)}`;
    expect(mpnIssues(value)).toEqual([
      { path: 'mpn', code: 'mpn_too_long', message: MPN_TOO_LONG },
    ]);
    expect(mpnIssues(value.slice(0, 40))).toEqual([
      { path: 'mpn', code: 'mpn_invalid_chars', message: MPN_INVALID },
    ]);
  });

  it('counts the MPN length in code points, so 40 emoji are not too long but invalid', () => {
    expect(mpnIssues('😀'.repeat(40))).toEqual([
      { path: 'mpn', code: 'mpn_invalid_chars', message: MPN_INVALID },
    ]);
  });

  it('DER-50-17 trims the MPN: " 20TD002MGE " is valid as "20TD002MGE"', () => {
    expect(modelTemplateCreateSchema.parse({ ...MV_A_CREATE, mpn: ' 20TD002MGE ' }).mpn).toBe(
      '20TD002MGE',
    );
  });

  it('accepts "MHGT3D/A" and keeps upper and lower case', () => {
    expect(mpnIssues('MHGT3D/A')).toEqual([]);
    expect(modelTemplateCreateSchema.parse({ ...MV_A_CREATE, mpn: 'mhgt3d/a' }).mpn).toBe(
      'mhgt3d/a',
    );
  });

  it('rejects "unbekannt" together with a value as a structural error without a path', () => {
    expect(issuesOf({ ...MV_A_CREATE, mpn: 'MHGT3D/A', mpnUnknown: true })).toEqual([
      expect.objectContaining({ path: '' }),
    ]);
  });

  it('rejects mpn null without "unbekannt" as a structural error without a path', () => {
    expect(issuesOf({ ...MV_A_CREATE, mpn: null })).toEqual([
      expect.objectContaining({ path: '' }),
    ]);
  });

  it('DER-50-04 rejects an empty or too long model name with "Modellbezeichnung: 1 bis 100 Zeichen"', () => {
    const message = 'Modellbezeichnung: 1 bis 100 Zeichen';
    expect(issuesOf({ ...MV_A_CREATE, modelName: ' ' })).toEqual([
      expect.objectContaining({ path: 'modelName', message }),
    ]);
    expect(issuesOf({ ...MV_A_CREATE, modelName: 'M'.repeat(101) })).toEqual([
      expect.objectContaining({ path: 'modelName', message }),
    ]);
    expect(issuesOf({ ...MV_A_CREATE, modelName: 'M'.repeat(100) })).toEqual([]);
  });

  it('DER-50-05 rejects a missing manufacturer with "Hersteller fehlt"', () => {
    expect(issuesOf({ ...MV_A_CREATE, manufacturerId: null })).toEqual([
      expect.objectContaining({ path: 'manufacturerId', message: 'Hersteller fehlt' }),
    ]);
  });

  it('DER-50-13 rejects a type designation over 50 characters', () => {
    expect(issuesOf({ ...MV_A_CREATE, typeDesignation: 'T'.repeat(51) })).toEqual([
      expect.objectContaining({
        path: 'typeDesignation',
        message: 'Typbezeichnung: höchstens 50 Zeichen',
      }),
    ]);
    expect(issuesOf({ ...MV_A_CREATE, typeDesignation: 'T'.repeat(50) })).toEqual([]);
  });

  it.each(['0194252146836', '1234567', '12345678901', '400638133393X'])(
    'AC-REQ-008-04 DER-50-14 rejects the original EAN "%s" with the design text',
    (originalEan) => {
      expect(issuesOf({ ...MV_A_CREATE, originalEan })).toEqual([
        expect.objectContaining({
          path: 'originalEan',
          message: 'EAN: 8 oder 13 Ziffern mit gültiger Prüfziffer',
        }),
      ]);
    },
  );

  it('accepts a GTIN-13 and a GTIN-8 with a valid check digit', () => {
    expect(issuesOf({ ...MV_A_CREATE, originalEan: '4006381333931' })).toEqual([]);
    expect(issuesOf({ ...MV_A_CREATE, originalEan: '96385074' })).toEqual([]);
  });

  it('reports every faulty field with one message each in one check', () => {
    expect(
      issuesOf({
        ...MV_A_CREATE,
        manufacturerId: null,
        modelName: '',
        mpn: 'A'.repeat(45),
        originalEan: '123',
      }).map((issue) => issue.path),
    ).toEqual(['manufacturerId', 'modelName', 'mpn', 'originalEan']);
  });

  it('rejects an unknown field and an id as a structural error', () => {
    expect(issuesOf({ ...MV_A_CREATE, id: 7 })).toEqual([
      expect.objectContaining({ code: 'unrecognized_keys' }),
    ]);
  });
});
