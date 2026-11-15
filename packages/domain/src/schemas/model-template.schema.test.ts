import { describe, expect, it } from 'vitest';

import {
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
