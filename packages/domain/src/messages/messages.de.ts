import type { ErrorCode } from '../errors/error-codes.ts';

/**
 * Texts with a key M-xx, worded as in the table "Meldungstexte" (Technical Specification 8.2).
 * M-23 is withdrawn and never reused: there is no collective text for `validation_failed` (K-07).
 */
export const MESSAGES = {
  'M-01': 'Gerät ist bereits einem Modell-Inserat zugeordnet',
  'M-02': 'Bezeichnung: 1 bis 100 Zeichen',
  'M-03': 'Bezeichnung darf { und } nicht enthalten',
  'M-04': (name: string) => `Bezeichnung ist für einen festen Platzhalter vergeben: ${name}`,
  'M-05': 'Herstellername: höchstens 200 Zeichen',
  'M-06': 'Straße und Hausnummer: höchstens 200 Zeichen',
  'M-07': 'Postleitzahl: höchstens 20 Zeichen',
  'M-08': 'Ort: höchstens 100 Zeichen',
  'M-09': 'Land: höchstens 100 Zeichen',
  'M-10': 'Elektronische Kontaktadresse: höchstens 254 Zeichen',
  'M-11': 'Name der verantwortlichen Person: höchstens 200 Zeichen',
  'M-12': 'Postanschrift der verantwortlichen Person: höchstens 500 Zeichen',
  'M-13': 'Kontaktadresse der verantwortlichen Person: höchstens 254 Zeichen',
  'M-14': 'Kategorie-Kennung: höchstens 100 Zeichen',
  'M-15': 'Dieser Eintrag ist nicht mehr vorhanden.',
  'M-16': 'Beschreibung: 1 bis 20.000 Zeichen',
  'M-17': 'Präfix: höchstens 50 Zeichen',
  'M-18': 'Suffix: höchstens 50 Zeichen',
  'M-19': 'Fester Text: 1 bis 100 Zeichen',
  'M-20': 'Überschrift: höchstens 100 Zeichen',
  'M-21': 'Zeile: höchstens 1.000 Zeichen',
  'M-22': 'Excel-Datei: höchstens 10 MB',
  'M-24': 'Prüfdatum und prüfende Stelle erforderlich',
} as const;

type MessageText = string | ((...args: string[]) => string);

/**
 * Rejection texts by `<code>.<usage>` (Technical Specification 2.0.5, FIND-209): the service
 * sets the usage, `error-mapper` picks the text. `default` is the usage of a code with one
 * text for all screens. New entries in alphabetical order (hotspot rule, 4.5).
 */
export const ERROR_MESSAGES = {
  'not_found.default': MESSAGES['M-15'],
} as const satisfies Partial<Record<`${ErrorCode}.${string}`, MessageText>>;

/**
 * Usages with a text in `ERROR_MESSAGES` for a code, e.g. `'default'` for `not_found`. A service
 * can only set a usage the catalog has, so a typo does not silently end in an empty text.
 */
export type ErrorMessageUsage<C extends ErrorCode> = keyof typeof ERROR_MESSAGES extends infer K
  ? K extends `${C}.${infer U}`
    ? U
    : never
  : never;

/** Fixed texts of the backup notice and of "resellr beenden" (REQ-104, REQ-105). */
export const FIXED_TEXTS = {
  backupNoticeTitle: 'Sicherung einrichten',
  backupNoticeText: (dataDirPath: string) =>
    'resellr sichert Ihre Daten nicht selbst. Bitte sichern Sie sie regelmäßig selbst, ' +
    'zum Beispiel in OneDrive. So geht es: 1. resellr beenden. 2. Den Datenordner ' +
    `vollständig an Ihren Sicherungsort kopieren. Der Datenordner liegt hier: ${dataDirPath}. ` +
    'Wichtig: Eine Kopie, die bei laufendem resellr entsteht, kann unbrauchbar sein.',
  shutdownQuestion:
    'resellr jetzt beenden? Nicht gespeicherte Eingaben gehen verloren. ' +
    'Danach können Sie den Datenordner kopieren.',
  shutdownDone: 'resellr ist beendet. Sie können den Datenordner jetzt kopieren.',
} as const;
