import { describe, expect, it } from 'vitest';

import { findMissingChoices } from './deactivated-choice.ts';

const text = (name: string) => `Tastaturlayout: ${name} ist deaktiviert`;

const GERMAN = { id: 31, name: 'Deutsch', active: true };
const HUNGARIAN = { id: 32, name: 'Ungarisch', active: true };

describe('findMissingChoices (CU-319, 2.0.11)', () => {
  it('names a choice whose entry is deactivated or gone after the reload, with the name from before', () => {
    expect(
      findMissingChoices(
        [
          { path: 'modelValues.15', id: 32, list: 'keyboard', message: text },
          { path: 'defaultDeviceValues.23', id: 31, list: 'keyboard', message: text },
        ],
        {
          keyboard: { before: [GERMAN, HUNGARIAN], after: [{ ...HUNGARIAN, active: false }] },
        },
      ),
    ).toEqual([
      { path: 'modelValues.15', id: 32, message: 'Tastaturlayout: Ungarisch ist deaktiviert' },
      {
        path: 'defaultDeviceValues.23',
        id: 31,
        message: 'Tastaturlayout: Deutsch ist deaktiviert',
      },
    ]);
  });

  it('keeps a choice whose entry is still or again active', () => {
    expect(
      findMissingChoices([{ path: 'modelValues.15', id: 31, list: 'keyboard', message: text }], {
        keyboard: { before: [{ ...GERMAN, active: false }], after: [GERMAN] },
      }),
    ).toEqual([]);
  });

  it('decides nothing for a list whose read failed', () => {
    expect(
      findMissingChoices([{ path: 'modelValues.15', id: 31, list: 'keyboard', message: text }], {
        keyboard: { before: [GERMAN], after: null },
      }),
    ).toEqual([]);
  });

  it('names the field of details.path with another missing value chosen during the reload, and skips an empty field', () => {
    expect(
      findMissingChoices(
        [
          { path: 'modelValues.15', id: 31, list: 'keyboard', message: text },
          { path: 'defaultDeviceValues.23', id: null, list: 'keyboard', message: text },
        ],
        { keyboard: { before: [GERMAN, HUNGARIAN], after: [HUNGARIAN] } },
      ),
    ).toEqual([
      { path: 'modelValues.15', id: 31, message: 'Tastaturlayout: Deutsch ist deaktiviert' },
    ]);
  });
});
