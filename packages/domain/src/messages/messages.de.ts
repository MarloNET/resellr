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

/**
 * Lines of the backup notice text (REQ-104). UI-044 shows "So geht es" and the two steps on
 * their own lines; joined with spaces they are the unchanged wording of `backupNoticeText`.
 */
const BACKUP_NOTICE_LINES = {
  backupNoticeIntro:
    'resellr sichert Ihre Daten nicht selbst. Bitte sichern Sie sie regelmäßig selbst, ' +
    'zum Beispiel in OneDrive.',
  backupNoticeStepsLead: 'So geht es:',
  backupNoticeStep1: '1. resellr beenden.',
  backupNoticeStep2: '2. Den Datenordner vollständig an Ihren Sicherungsort kopieren.',
  backupNoticeLocationLead: 'Der Datenordner liegt hier:',
  backupNoticeWarning:
    'Wichtig: Eine Kopie, die bei laufendem resellr entsteht, kann unbrauchbar sein.',
} as const;

/**
 * Fixed texts of the backup notice and of "resellr beenden" (REQ-104, REQ-105) and the banner
 * texts of the patterns P-05 to P-08 (design chapter 5).
 */
export const FIXED_TEXTS = {
  backupNoticeTitle: 'Sicherung einrichten',
  ...BACKUP_NOTICE_LINES,
  backupNoticeText: (dataDirPath: string) =>
    [
      BACKUP_NOTICE_LINES.backupNoticeIntro,
      BACKUP_NOTICE_LINES.backupNoticeStepsLead,
      BACKUP_NOTICE_LINES.backupNoticeStep1,
      BACKUP_NOTICE_LINES.backupNoticeStep2,
      `${BACKUP_NOTICE_LINES.backupNoticeLocationLead} ${dataDirPath}.`,
      BACKUP_NOTICE_LINES.backupNoticeWarning,
    ].join(' '),
  /** UI-044.loading: at the place of the path while `GET /api/ops/status` loads. */
  backupNoticeLoading: 'wird geladen …',
  /** UI-044.error: at the place of the path on `500` of `GET /api/ops/status` (REQ-073). */
  backupNoticeError: (referenceNumber: string) =>
    'Speicherort konnte nicht ermittelt werden. Informieren Sie den Betreiber und nennen Sie ' +
    `die Referenznummer ${referenceNumber}.`,
  shutdownAction: 'resellr beenden',
  shutdownQuestion:
    'resellr jetzt beenden? Nicht gespeicherte Eingaben gehen verloren. ' +
    'Danach können Sie den Datenordner kopieren.',
  shutdownDone: 'resellr ist beendet. Sie können den Datenordner jetzt kopieren.',
  conflictBanner:
    'Dieser Eintrag wurde inzwischen in einem anderen Fenster geändert. ' +
    'Bitte neu laden und erneut prüfen.',
  unreachableBanner:
    'resellr ist nicht erreichbar. Ihre Eingaben sind noch nicht gespeichert, bleiben aber ' +
    'sichtbar, solange diese Seite offen ist. Warten Sie einen Moment und versuchen Sie es ' +
    'erneut. Läuft resellr nicht, starten Sie es über die Verknüpfung „resellr“ im Startmenü.',
  shuttingDownBanner:
    'resellr wird gerade beendet. Ihre Eingabe wurde nicht gespeichert. Warten Sie, bis ' +
    'resellr beendet ist, und starten Sie es dann über die Verknüpfung „resellr“ im Startmenü.',
  /** Accessible name of "×" in the page banner (design chapter 5 "Feedback", MAR-283). */
  closeBanner: 'Meldung schließen',
  outcomeUnknownBanner: 'Ausgang unbekannt, bitte neu laden.',
  outcomeUnknownHint:
    'Ob Ihre Aktion gespeichert wurde, ist unklar. Laden Sie die Seite neu ' +
    '(Browser-Aktualisierung, z. B. F5) und prüfen Sie danach, ob sie gespeichert wurde. ' +
    'Beim Neuladen gehen Eingaben verloren: schreiben Sie sie vorher bei Bedarf ab oder ' +
    'markieren Sie sie. Läuft resellr nicht, starten Sie es über die Verknüpfung „resellr“ ' +
    'im Startmenü.',
} as const;
