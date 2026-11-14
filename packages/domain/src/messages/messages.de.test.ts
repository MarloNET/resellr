import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  ERROR_MESSAGES,
  type ErrorMessageUsage,
  FIELD_MESSAGES,
  FIXED_TEXTS,
  MESSAGES,
} from './messages.de.ts';

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
  ['M-30', 'Name: 1 bis 100 Zeichen'],
];

const EXPECTED_KEYS = [
  ...Array.from({ length: 22 }, (_, i) => `M-${String(i + 1).padStart(2, '0')}`),
  'M-24',
  'M-30',
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

  it('has exactly the keys M-01 to M-22, M-24 and M-30', () => {
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

  it('has the text of name_taken for device types (2.0.6, UI-027)', () => {
    expect(ERROR_MESSAGES['name_taken.device_type']).toBe('Name ist bereits vergeben');
  });

  it('has the field text of the device type name (UI-027)', () => {
    expect(FIELD_MESSAGES.deviceTypeName).toBe('Name: 1 bis 50 Zeichen');
  });

  it('has the text of name_taken for manufacturers (2.0.6, UI-031, DER-37-04)', () => {
    expect(ERROR_MESSAGES['name_taken.manufacturer']).toBe('Name ist bereits vergeben');
  });

  it('names the deactivated manufacturer in manufacturer_deactivated (2.0.6, UI-008)', () => {
    expect(ERROR_MESSAGES['manufacturer_deactivated.default']('Lenovo')).toBe(
      'Hersteller Lenovo ist deaktiviert',
    );
  });

  it('has the field text of the manufacturer name (UI-008, UI-031)', () => {
    expect(FIELD_MESSAGES.manufacturerName).toBe('Name: 1 bis 50 Zeichen');
  });

  it('has the text of name_taken for attributes (2.0.6, UI-027)', () => {
    expect(ERROR_MESSAGES['name_taken.attribute']).toBe(
      'Bezeichnung ist bei dieser Geräteart bereits vergeben',
    );
  });

  it('has the field texts of the attribute panel (UI-027, 8.2)', () => {
    expect(FIELD_MESSAGES.attributeUnit).toBe('Einheit: höchstens 20 Zeichen');
    expect(FIELD_MESSAGES.attributeMinAboveMax).toBe(
      'Mindestwert darf nicht größer als Höchstwert sein',
    );
    expect(FIELD_MESSAGES.attributePickListMissing).toBe('Auswahlliste fehlt');
    expect(FIELD_MESSAGES.attributeMinValueNumber).toBe('Mindestwert: Zahl');
    expect(FIELD_MESSAGES.attributeMinValueInteger).toBe('Mindestwert: ganze Zahl');
    expect(FIELD_MESSAGES.attributeMaxValueNumber).toBe('Höchstwert: Zahl');
    expect(FIELD_MESSAGES.attributeMaxValueInteger).toBe('Höchstwert: ganze Zahl');
  });

  it('has the texts of the attribute values (2.5, 8.2)', () => {
    expect(FIELD_MESSAGES.attributeValueMissing('RAM')).toBe('RAM fehlt');
    expect(FIELD_MESSAGES.attributeValueNumber('RAM', 'integer', '1', '1024')).toBe(
      'RAM: ganze Zahl von 1 bis 1024',
    );
    expect(FIELD_MESSAGES.attributeValueNumber('Takt', 'decimal', '0,5', null)).toBe(
      'Takt: Zahl ab 0,5',
    );
    expect(FIELD_MESSAGES.attributeValueNumber('Takt', 'decimal', null, '6')).toBe(
      'Takt: Zahl bis 6',
    );
    expect(FIELD_MESSAGES.attributeValueNumber('RAM', 'integer', null, null)).toBe(
      'RAM: ganze Zahl',
    );
    expect(FIELD_MESSAGES.attributeValueTextLength('Farbe')).toBe('Farbe: höchstens 200 Zeichen');
    expect(FIELD_MESSAGES.attributeValuePortCount('Anschlüsse')).toBe(
      'Anschlüsse: Anzahl als ganze Zahl ab 1',
    );
    expect(FIELD_MESSAGES.attributeValuePortType('Anschlüsse')).toBe('Anschlüsse: Typ fehlt');
  });

  it('has the texts of attribute_has_values for data type and level (2.0.6, UI-027)', () => {
    expect(ERROR_MESSAGES['attribute_has_values.data_type']).toBe(
      'Datentyp kann nicht geändert werden, weil bereits Werte gespeichert sind.',
    );
    expect(ERROR_MESSAGES['attribute_has_values.level']).toBe(
      'Ebene kann nicht geändert werden, weil bereits Werte gespeichert sind.',
    );
  });

  it('has the text of name_taken for suppliers (2.0.6, UI-032)', () => {
    expect(ERROR_MESSAGES['name_taken.supplier']).toBe('Name ist bereits vergeben');
  });

  it('has the field text of the supplier name (UI-032)', () => {
    expect(FIELD_MESSAGES.supplierName).toBe('Name: 1 bis 100 Zeichen');
  });

  it('has the field text of the datasheet layout (UI-039)', () => {
    expect(FIELD_MESSAGES.headerLabel).toBe('Kopfzeilentext: höchstens 50 Zeichen');
  });

  it('has the field texts of the merchant profile (UI-026)', () => {
    expect(FIELD_MESSAGES.brandName).toBe('Name: 1 bis 100 Zeichen');
    expect(FIELD_MESSAGES.contactText).toBe('Kontaktangaben: höchstens 500 Zeichen');
  });

  it('has the text of name_taken for pick list values (2.0.6, UI-028)', () => {
    expect(ERROR_MESSAGES['name_taken.pick_list_value']).toBe(
      'Wert gibt es in dieser Liste bereits',
    );
  });

  it('has the field texts of the pick list values (UI-028)', () => {
    expect(FIELD_MESSAGES.batteryPresentMissing).toBe('Kennzeichen ‚Akku vorhanden‘ fehlt');
    expect(FIELD_MESSAGES.pickListValueLabel).toBe('Wert: 1 bis 100 Zeichen');
  });

  it('has the text of name_taken for condition codes (2.0.6, UI-033)', () => {
    expect(ERROR_MESSAGES['name_taken.condition_code']).toBe(
      'Diesen Code gibt es für diesen Lieferanten bereits',
    );
  });

  it('has the field texts of the condition codes (UI-033, design v0.6.2 O-2)', () => {
    expect(FIELD_MESSAGES.conditionCode).toBe('Zustandscode: 1 bis 20 Zeichen');
    expect(FIELD_MESSAGES.conditionCodePlainText).toBe('Klartext: 1 bis 500 Zeichen');
    expect(FIELD_MESSAGES.visualGrade).toBe('Optik-Note: ganze Zahl von 1 bis 5');
  });

  it('has the texts of the text block (2.0.6, UI-030, M-30, MAR-493)', () => {
    expect(ERROR_MESSAGES['name_taken.text_block']).toBe('Name ist bereits vergeben');
    expect(ERROR_MESSAGES['placeholder_not_allowed.unknown']('{Garantiezeit}')).toBe(
      'Unbekannter Platzhalter {Garantiezeit}',
    );
    expect(ERROR_MESSAGES['placeholder_not_allowed.text_block']).toBe(
      '{Baustein:Name} ist im Textbaustein nicht zulässig',
    );
    expect(FIELD_MESSAGES.textBlockBody).toBe('Text: 1 bis 5.000 Zeichen');
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

  it('splits the backup notice text into the lines of UI-044 without changing the wording', () => {
    const path = 'C:\\Daten';
    expect(
      [
        FIXED_TEXTS.backupNoticeIntro,
        FIXED_TEXTS.backupNoticeStepsLead,
        FIXED_TEXTS.backupNoticeStep1,
        FIXED_TEXTS.backupNoticeStep2,
        `${FIXED_TEXTS.backupNoticeLocationLead} ${path}.`,
        FIXED_TEXTS.backupNoticeWarning,
      ].join(' '),
    ).toBe(FIXED_TEXTS.backupNoticeText(path));
  });

  it('has the loading text at the place of the path and the action "resellr beenden"', () => {
    expect(FIXED_TEXTS.backupNoticeLoading).toBe('wird geladen …');
    expect(FIXED_TEXTS.shutdownAction).toBe('resellr beenden');
  });

  it('has the shutdown question', () => {
    expect(FIXED_TEXTS.shutdownQuestion).toBe(
      'resellr jetzt beenden? Nicht gespeicherte Eingaben gehen verloren. ' +
        'Danach können Sie den Datenordner kopieren.',
    );
  });

  // Wording of UI-045 screen.md (states loading and error), verbatim.
  it('has the waiting text and the error banner of UI-045', () => {
    expect(FIXED_TEXTS.shutdownPending).toBe('resellr wird beendet …');
    expect(FIXED_TEXTS.shutdownError('R-7K2M-9QX4')).toBe(
      'resellr konnte nicht beendet werden. resellr läuft weiter. Bitte versuchen Sie es ' +
        'erneut. Besteht der Fehler weiter, informieren Sie den Betreiber mit der ' +
        'Referenznummer R-7K2M-9QX4.',
    );
  });

  it('has the message after shutdown', () => {
    expect(FIXED_TEXTS.shutdownDone).toBe(
      'resellr ist beendet. Sie können den Datenordner jetzt kopieren.',
    );
  });
});

// Wording of design chapter 5 (docs/ux/uiux-design.md), verbatim (MAR-262).
describe('banner texts of the patterns P-05 to P-08', () => {
  it('has the conflict text of P-05', () => {
    expect(FIXED_TEXTS.conflictBanner).toBe(
      'Dieser Eintrag wurde inzwischen in einem anderen Fenster geändert. ' +
        'Bitte neu laden und erneut prüfen.',
    );
  });

  it('has the banner text of P-06', () => {
    expect(FIXED_TEXTS.unreachableBanner).toBe(
      'resellr ist nicht erreichbar. Ihre Eingaben sind noch nicht gespeichert, bleiben aber ' +
        'sichtbar, solange diese Seite offen ist. Warten Sie einen Moment und versuchen Sie es ' +
        'erneut. Läuft resellr nicht, starten Sie es über die Verknüpfung „resellr“ im Startmenü.',
    );
  });

  it('has the banner text of P-07', () => {
    expect(FIXED_TEXTS.shuttingDownBanner).toBe(
      'resellr wird gerade beendet. Ihre Eingabe wurde nicht gespeichert. Warten Sie, bis ' +
        'resellr beendet ist, und starten Sie es dann über die Verknüpfung „resellr“ im Startmenü.',
    );
  });

  it('has the fixed core and the addition of P-08', () => {
    expect(FIXED_TEXTS.outcomeUnknownBanner).toBe('Ausgang unbekannt, bitte neu laden.');
    expect(FIXED_TEXTS.outcomeUnknownHint).toBe(
      'Ob Ihre Aktion gespeichert wurde, ist unklar. Laden Sie die Seite neu ' +
        '(Browser-Aktualisierung, z. B. F5) und prüfen Sie danach, ob sie gespeichert wurde. ' +
        'Beim Neuladen gehen Eingaben verloren: schreiben Sie sie vorher bei Bedarf ab oder ' +
        'markieren Sie sie. Läuft resellr nicht, starten Sie es über die Verknüpfung „resellr“ ' +
        'im Startmenü.',
    );
  });
});
