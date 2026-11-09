import { describe, expect, expectTypeOf, it } from 'vitest';

import { ERROR_MESSAGES, type ErrorMessageUsage, FIXED_TEXTS, MESSAGES } from './messages.de.ts';

// Table "Meldungstexte" in Technical Specification 8.2; M-05 to M-13 per field as in the
// message catalog of the design (docs/ux/meldungskatalog.md), which 8.2 refers to.
const MESSAGE_TABLE: [string, string][] = [
  ['M-01', 'Gerät ist bereits einem Modell-Inserat zugeordnet'],
  ['M-02', 'Bezeichnung: 1 bis 100 Zeichen'],
  ['M-03', 'Bezeichnung darf { und } nicht enthalten'],
  ['M-05', 'Herstellername: höchstens 200 Zeichen'],
  ['M-06', 'Straße und Hausnummer: höchstens 200 Zeichen'],
  ['M-07', 'Postleitzahl: höchstens 20 Zeichen'],
  ['M-08', 'Ort: höchstens 100 Zeichen'],
  ['M-09', 'Land: höchstens 100 Zeichen'],
  ['M-10', 'Elektronische Kontaktadresse: höchstens 254 Zeichen'],
  ['M-11', 'Name der verantwortlichen Person: höchstens 200 Zeichen'],
  ['M-12', 'Postanschrift der verantwortlichen Person: höchstens 500 Zeichen'],
  ['M-13', 'Kontaktadresse der verantwortlichen Person: höchstens 254 Zeichen'],
  ['M-14', 'Kategorie-Kennung: höchstens 100 Zeichen'],
  ['M-15', 'Dieser Eintrag ist nicht mehr vorhanden.'],
  ['M-16', 'Beschreibung: 1 bis 20.000 Zeichen'],
  ['M-17', 'Präfix: höchstens 50 Zeichen'],
  ['M-18', 'Suffix: höchstens 50 Zeichen'],
  ['M-19', 'Fester Text: 1 bis 100 Zeichen'],
  ['M-20', 'Überschrift: höchstens 100 Zeichen'],
  ['M-21', 'Zeile: höchstens 1.000 Zeichen'],
  ['M-22', 'Excel-Datei: höchstens 10 MB'],
  ['M-24', 'Prüfdatum und prüfende Stelle erforderlich'],
];

const EXPECTED_KEYS = [
  ...Array.from({ length: 22 }, (_, i) => `M-${String(i + 1).padStart(2, '0')}`),
  'M-24',
];

describe('message catalog (E1)', () => {
  it.each(MESSAGE_TABLE)('%s has the wording of Technical Specification 8.2', (key, text) => {
    expect(MESSAGES).toHaveProperty(key, text);
  });

  it('M-04 names the entered label', () => {
    expect(MESSAGES['M-04']('Hersteller')).toBe(
      'Bezeichnung ist für einen festen Platzhalter vergeben: Hersteller',
    );
  });

  it('has exactly the keys M-01 to M-22 and M-24', () => {
    expect(Object.keys(MESSAGES)).toEqual(EXPECTED_KEYS);
  });

  it('has no entry M-23 (K-07)', () => {
    expect(MESSAGES).not.toHaveProperty('M-23');
  });

  it('has no collective text for validation_failed (K-07)', () => {
    const errorKeys = Object.keys(ERROR_MESSAGES);
    expect(errorKeys.filter((key) => key.startsWith('validation_failed'))).toEqual([]);
    const allTexts = [...Object.values(MESSAGES), ...Object.values(ERROR_MESSAGES)];
    expect(allTexts).not.toContain('Bitte die markierten Felder prüfen.');
  });

  it('orders rejection texts by <code>.<usage> (FIND-209)', () => {
    const keys = Object.keys(ERROR_MESSAGES);
    for (const key of keys) {
      expect(key).toMatch(/^[a-z]+(_[a-z]+)*\.[a-z]+(_[a-z]+)*$/);
    }
    expect(keys).toEqual([...keys].sort());
  });

  it('uses M-15 for not_found', () => {
    expect(ERROR_MESSAGES['not_found.default']).toBe('Dieser Eintrag ist nicht mehr vorhanden.');
  });

  it('derives the usages of a code from the catalog keys', () => {
    expectTypeOf<ErrorMessageUsage<'not_found'>>().toEqualTypeOf<'default'>();
    // No text in S1, so no usage can be set (MAR-239, F-1).
    expectTypeOf<ErrorMessageUsage<'internal_error'>>().toEqualTypeOf<never>();
  });
});

describe('fixed texts of REQ-104 and REQ-105 (E1)', () => {
  it('has the heading of the backup notice', () => {
    expect(FIXED_TEXTS.backupNoticeTitle).toBe('Sicherung einrichten');
  });

  it('has the backup notice text with the data folder location', () => {
    expect(
      FIXED_TEXTS.backupNoticeText('C:\\Users\\Beispiel\\AppData\\Local\\resellr\\Daten'),
    ).toBe(
      'resellr sichert Ihre Daten nicht selbst. Bitte sichern Sie sie regelmäßig selbst, ' +
        'zum Beispiel in OneDrive. So geht es: 1. resellr beenden. 2. Den Datenordner ' +
        'vollständig an Ihren Sicherungsort kopieren. Der Datenordner liegt hier: ' +
        'C:\\Users\\Beispiel\\AppData\\Local\\resellr\\Daten. Wichtig: Eine Kopie, die bei ' +
        'laufendem resellr entsteht, kann unbrauchbar sein.',
    );
  });

  it('has the shutdown question', () => {
    expect(FIXED_TEXTS.shutdownQuestion).toBe(
      'resellr jetzt beenden? Nicht gespeicherte Eingaben gehen verloren. ' +
        'Danach können Sie den Datenordner kopieren.',
    );
  });

  it('has the message after shutdown', () => {
    expect(FIXED_TEXTS.shutdownDone).toBe(
      'resellr ist beendet. Sie können den Datenordner jetzt kopieren.',
    );
  });
});
