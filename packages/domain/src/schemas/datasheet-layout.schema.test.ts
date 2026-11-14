import { describe, expect, it } from 'vitest';

import {
  datasheetLayoutSchema,
  datasheetLayoutUpdateSchema,
  headerLabelSchema,
} from './datasheet-layout.schema.ts';

const HEADER_LABEL_TEXT = 'Kopfzeilentext: höchstens 50 Zeichen';

const messagesOf = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message) ?? [];

const LAYOUT = {
  version: 1,
  headerLabels: ['Shop:', 'eBay:', 'Kleinanzeigen:'],
  blockOrder: ['identification', 'condition', 'delivery_scope', 'technical', 'ports', 'software'],
  attributeOrder: { '1': [3, 4, 12, 13] },
};

describe('datasheet layout schemas (CU-066)', () => {
  it('accepts empty header labels and 50 characters, kept as entered', () => {
    expect(headerLabelSchema.parse('')).toBe('');
    expect(headerLabelSchema.parse(' Ebay-Nr.: ')).toBe(' Ebay-Nr.: ');
    expect(headerLabelSchema.parse('a'.repeat(50))).toBe('a'.repeat(50));
  });

  it('DER-85-02 rejects a header label over 50 characters with the text of UI-039', () => {
    expect(messagesOf(headerLabelSchema.safeParse('a'.repeat(51)))).toEqual([HEADER_LABEL_TEXT]);
  });

  it('needs version, header labels, block order and attribute order to save, and nothing else', () => {
    expect(datasheetLayoutUpdateSchema.parse(LAYOUT)).toEqual(LAYOUT);
    expect(
      datasheetLayoutUpdateSchema.safeParse({ ...LAYOUT, attributeOrder: undefined }).success,
    ).toBe(false);
    expect(datasheetLayoutUpdateSchema.safeParse({ ...LAYOUT, preview: true }).success).toBe(false);
  });

  it('rejects unknown blocks and keys that are no device type id', () => {
    expect(
      datasheetLayoutUpdateSchema.safeParse({ ...LAYOUT, blockOrder: ['identification', 'x'] })
        .success,
    ).toBe(false);
    expect(
      datasheetLayoutUpdateSchema.safeParse({ ...LAYOUT, attributeOrder: { notebook: [1] } })
        .success,
    ).toBe(false);
    expect(
      datasheetLayoutUpdateSchema.safeParse({ ...LAYOUT, attributeOrder: { '0': [1] } }).success,
    ).toBe(false);
  });

  it('describes the layout of the answer', () => {
    expect(datasheetLayoutSchema.parse(LAYOUT)).toEqual(LAYOUT);
  });
});
