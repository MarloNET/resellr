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
  /** UI-007 "Herstellernummer" longer than 40 characters, also with an invalid character. */
  'M-25': 'Herstellernummer: höchstens 40 Zeichen',
  /** UI-007 "Herstellernummer" with a character other than A–Z, a–z, 0–9, `-`, `/`, `.`. */
  'M-26': 'Herstellernummer: nur Buchstaben, Ziffern und die Zeichen - / . erlaubt',
  /** UI-030 "Name" of a text block, empty or longer than 100 characters after trimming. */
  'M-30': 'Name: 1 bis 100 Zeichen',
  /** UI-030 "Prüfende Stelle", longer than 100 characters after trimming; missing is M-24. */
  'M-31': 'Prüfende Stelle: höchstens 100 Zeichen',
} as const;

/**
 * Field texts without a key M-xx, worded as in the `screen.md` of the screen that shows them;
 * the schemas of `packages/domain` set them, so browser and server show the same text (2.0.5).
 */
export const FIELD_MESSAGES = {
  /**
   * UI-004 and UI-014 "Artikelnummer", empty or not 1–30 letters, digits and "-" (2.6, 8.2,
   * Nachtrag MAR-1053).
   */
  articleNumber: 'Artikelnummer: 1 bis 30 Zeichen, nur Buchstaben, Ziffern und „-“',
  /**
   * Values of the attributes in the input masks (Technical Specification 2.5 "Regeln und Texte
   * je Datentyp", 8.2): `label` is the current label of the attribute, bounds are formatted with
   * a decimal comma and without thousands separators.
   */
  attributeValueMissing: (label: string) => `${label} fehlt`,
  attributeValueNumber: (
    label: string,
    kind: 'integer' | 'decimal',
    min: string | null,
    max: string | null,
  ) => {
    const rule = kind === 'integer' ? 'ganze Zahl' : 'Zahl';
    if (min !== null && max !== null) return `${label}: ${rule} von ${min} bis ${max}`;
    if (min !== null) return `${label}: ${rule} ab ${min}`;
    if (max !== null) return `${label}: ${rule} bis ${max}`;
    return `${label}: ${rule}`;
  },
  attributeValueTextLength: (label: string) => `${label}: höchstens 200 Zeichen`,
  attributeValuePortCount: (label: string) => `${label}: Anzahl als ganze Zahl ab 1`,
  attributeValuePortType: (label: string) => `${label}: Typ fehlt`,
  /** Value of the attribute with the role `battery_capacity` (2.5, AC-REQ-014-02). */
  batteryCapacityFormat: 'Akkukapazität: ganze Zahl von 0 bis 100 oder „nicht ermittelbar“',
  /** UI-027 "Auswahlliste", missing at data type "Auswahl aus Liste" (2.1, DER-34-04). */
  attributePickListMissing: 'Auswahlliste fehlt',
  /** UI-027 "Mindestwert"/"Höchstwert", not a number; not a whole number for data type integer (8.2). */
  attributeMinValueNumber: 'Mindestwert: Zahl',
  attributeMinValueInteger: 'Mindestwert: ganze Zahl',
  attributeMaxValueNumber: 'Höchstwert: Zahl',
  attributeMaxValueInteger: 'Höchstwert: ganze Zahl',
  /** UI-027 "Mindest-/Höchstwert", minimum above maximum (2.1, DER-34-03). */
  attributeMinAboveMax: 'Mindestwert darf nicht größer als Höchstwert sein',
  /**
   * UI-027 "Einheit", longer than 20 characters (3.1). Text defined by Technical Specification
   * 8.2, table "Meldungstexte".
   */
  attributeUnit: 'Einheit: höchstens 20 Zeichen',
  /** UI-028 "Akku vorhanden", missing in the list battery (REQ-007, DER-35-10). */
  batteryPresentMissing: 'Kennzeichen ‚Akku vorhanden‘ fehlt',
  /** UI-026 "Name der Händlermarke", empty or longer than 100 characters after trimming. */
  brandName: 'Name: 1 bis 100 Zeichen',
  /**
   * UI-033 "Zustandscode", empty or longer than 20 characters after trimming (REQ-022, 3.1).
   */
  conditionCode: 'Zustandscode: 1 bis 20 Zeichen',
  /**
   * UI-033 "Klartext", empty or longer than 500 characters after trimming; one text for both,
   * there is no "Klartext fehlt" (design v0.6.2 O-2, AC-REQ-022-04).
   */
  conditionCodePlainText: 'Klartext: 1 bis 500 Zeichen',
  /** UI-003 "Zustandsbeschreibung", longer than 1,000 characters after trimming (2.5). */
  conditionDescription: 'Zustandsbeschreibung: höchstens 1.000 Zeichen',
  /** UI-003 "Zustand" without a choice (2.5). */
  conditionMissing: 'Zustand fehlt',
  /**
   * UI-033 "Lieferant", "Speichern" while no supplier is chosen after a rejection for
   * deactivation; only in the browser (2.0.11, design v0.6.8, addendum MAR-929).
   */
  conditionCodeSupplierNotChosen: 'Lieferant: Lieferanten oder „alle“ wählen',
  /** UI-026 "Kontaktangaben", longer than 500 characters. */
  contactText: 'Kontaktangaben: höchstens 500 Zeichen',
  /** UI-007 "Geräteart" without a choice (Design v0.6.7, Nachtrag MAR-925). */
  deviceTypeMissing: 'Geräteart fehlt',
  /** UI-027 "Geräteart: Name", empty or longer than 50 characters after trimming. */
  deviceTypeName: 'Name: 1 bis 50 Zeichen',
  /**
   * UI-031 "Elektronische Kontaktadresse", neither an e-mail address nor an address with
   * `http://` or `https://` (Technical Specification 2.2, DER-41-02).
   */
  gpsrContact: 'E-Mail-Adresse oder Internetadresse ungültig',
  /** UI-031, a part of the GPSR details that `gpsrMissing[]` names (2.2, DER-41-03). */
  gpsrMissing: (part: string) => `${part} fehlt`,
  /** UI-039 "Kopfzeilentext", longer than 50 characters (2.2). */
  headerLabel: 'Kopfzeilentext: höchstens 50 Zeichen',
  /** UI-030 "Prüfdatum" after today (Technical Specification 2.2, DER-40-02). */
  legalCheckedOnFuture: 'Prüfdatum darf nicht in der Zukunft liegen',
  /** UI-007 "Hersteller" without a choice (DER-50-05). */
  manufacturerMissing: 'Hersteller fehlt',
  /** UI-008 and UI-031 "Name", empty or longer than 50 characters after trimming (REQ-100). */
  manufacturerName: 'Name: 1 bis 50 Zeichen',
  /** UI-007 "Modellbezeichnung", empty or longer than 100 characters after trimming. */
  modelName: 'Modellbezeichnung: 1 bis 100 Zeichen',
  /** UI-003 "Modellvorlage" without a choice (2.5, DER-54-11). */
  modelTemplateMissing: 'Bitte eine Modellvorlage wählen',
  /**
   * UI-007 "Herstellernummer" empty and not "unbekannt" (`mpn_required`): the wording of
   * AC-REQ-008-02 (DG-17, Technical Specification 2.4, 8.2).
   */
  mpnRequired: 'Herstellernummer: Wert eingeben oder ‚unbekannt‘ wählen',
  /**
   * UI-007 "Original-EAN", not 8 or 13 digits or a wrong GS1 check digit (design text, Q-1;
   * AC-REQ-008-04).
   */
  originalEan: 'EAN: 8 oder 13 Ziffern mit gültiger Prüfziffer',
  /**
   * UI-028 "Wert", empty or longer than 100 characters after trimming (3.1). Text defined by
   * Technical Specification 8.2 (addendum MAR-487).
   */
  pickListValueLabel: 'Wert: 1 bis 100 Zeichen',
  /** UI-006 "Suchbegriff" with 1 character (AC-REQ-009-04, Technical Specification 2.4). */
  searchTermMinLength: 'Mindestens 2 Zeichen',
  /** UI-032 "Name", empty or longer than 100 characters after trimming. */
  supplierName: 'Name: 1 bis 100 Zeichen',
  /**
   * UI-030 "Text", empty or longer than 5,000 characters. Text defined by Technical
   * Specification 8.2, table "Meldungstexte" (addendum MAR-493).
   */
  textBlockBody: 'Text: 1 bis 5.000 Zeichen',
  /**
   * UI-030 "Geltungsbereich", a choice without a device type or without a channel and not "alle"
   * (`scope_required`; Technical Specification 2.2, 8.2, addendum MAR-773). UI-030 disables
   * "Speichern" instead, so the texts only show when the server reports the rule.
   */
  textBlockDeviceTypesRequired: 'Gerätearten: mindestens eine wählen oder ‚alle‘',
  textBlockChannelsRequired: 'Kanäle: mindestens einen wählen oder ‚alle‘',
  /** UI-007 "Typbezeichnung", longer than 50 characters after trimming (DER-50-13). */
  typeDesignation: 'Typbezeichnung: höchstens 50 Zeichen',
  /** UI-033 "Vorschlag Optik-Note", not a whole number from 1 to 5 (REQ-022). */
  visualGrade: 'Optik-Note: ganze Zahl von 1 bis 5',
  /**
   * UI-003 "WI-Nr", empty or not 1–20 letters and digits (2.5, Requirements 9.6, AC-REQ-012-03).
   */
  wiNr: 'WI-Nr darf nur Buchstaben und Ziffern enthalten (1–20 Zeichen)',
} as const;

type MessageText = string | ((...args: string[]) => string);

/** UI-026 "Logo": one text for a too large file and a wrong type (AC-REQ-028-02). */
const LOGO_FILE_RULE = 'Logo: nur PNG oder JPEG bis 5 MB';

/**
 * Rejection texts by `<code>.<usage>` (Technical Specification 2.0.5, FIND-209): the service
 * sets the usage, `error-mapper` picks the text. `default` is the usage of a code with one
 * text for all screens. New entries in alphabetical order (hotspot rule, 4.5).
 */
export const ERROR_MESSAGES = {
  /** UI-004 (M-01, AC-REQ-017-04). */
  'already_assigned.default': MESSAGES['M-01'],
  /** UI-004 "Neues Modell-Inserat anlegen" at the field "Artikelnummer" (2.6, DER-60-04). */
  'article_number_taken.default': 'Artikelnummer bereits vergeben',
  'attribute_has_values.data_type':
    'Datentyp kann nicht geändert werden, weil bereits Werte gespeichert sind.',
  'attribute_has_values.level':
    'Ebene kann nicht geändert werden, weil bereits Werte gespeichert sind.',
  /** UI-007.dublette: text of M-27, its title is in `CONFIRMATION_TITLES` (8.2). */
  'confirmation_required.possible_duplicate':
    'Es gibt bereits eine Modellvorlage mit gleichem Hersteller und gleicher Modellbezeichnung.',
  /**
   * UI-004 "Neues Modell-Inserat anlegen" from a sold or cancelled device: the wording of the sale
   * (2.0.6, AC-REQ-021-04, Nachtrag MAR-1053).
   */
  'device_not_available.new_listing': 'Gerät ist bereits verkauft oder storniert',
  /**
   * UI-010 "Gerätewerte speichern" of a sold or cancelled device (2.5, `UI-010.disabled`,
   * Auslegung RQ-17).
   */
  'device_not_available.device_values': 'Werte schreibgeschützt',
  /** UI-007 "Geräteart", a new device type of a model template is deactivated (2.0.11). */
  'device_type_deactivated.model_template': (name: string) => `Geräteart ${name} ist deaktiviert`,
  'file_too_large.logo': LOGO_FILE_RULE,
  'manufacturer_deactivated.default': (name: string) => `Hersteller ${name} ist deaktiviert`,
  /** UI-007 "Hersteller", same text as in UI-008 (2.0.11, Nachtrag MAR-904). */
  'manufacturer_deactivated.model_template': (name: string) => `Hersteller ${name} ist deaktiviert`,
  'name_taken.attribute': 'Bezeichnung ist bei dieser Geräteart bereits vergeben',
  'name_taken.condition_code': 'Diesen Code gibt es für diesen Lieferanten bereits',
  'name_taken.device_type': 'Name ist bereits vergeben',
  'name_taken.manufacturer': 'Name ist bereits vergeben',
  'name_taken.pick_list_value': 'Wert gibt es in dieser Liste bereits',
  'name_taken.supplier': 'Name ist bereits vergeben',
  'name_taken.text_block': 'Name ist bereits vergeben',
  'not_found.default': MESSAGES['M-15'],
  /** UI-007, UI-003, UI-010, UI-014 at the field of the attribute (2.0.6, Nachtrag MAR-904). */
  'pick_list_value_deactivated.attribute': (label: string, value: string) =>
    `${label}: ${value} ist deaktiviert`,
  /**
   * UI-003, UI-010 "Zustand", a new or changed condition of a device is deactivated (2.0.11,
   * 8.2, Nachtrag MAR-904).
   */
  'pick_list_value_deactivated.condition': (value: string) => `Zustand ${value} ist deaktiviert`,
  /**
   * UI-033 "Vorschlag Zustand", a new or changed suggestion is deactivated (2.0.11, design
   * v0.6.8, addendum MAR-929).
   */
  'pick_list_value_deactivated.condition_suggestion': (value: string) =>
    `Vorschlag Zustand ${value} ist deaktiviert`,
  'placeholder_not_allowed.text_block': '{Baustein:Name} ist im Textbaustein nicht zulässig',
  'placeholder_not_allowed.unknown': (placeholder: string) =>
    `Unbekannter Platzhalter ${placeholder}`,
  /** UI-033 "Lieferant", a new or changed supplier is deactivated (2.0.11, Nachtrag MAR-904). */
  'supplier_deactivated.condition_code': (name: string) => `Lieferant ${name} ist deaktiviert`,
  /** UI-003 "Lieferant", the supplier of a new device is deactivated (2.0.11, Nachtrag MAR-904). */
  'supplier_deactivated.device': (name: string) => `Lieferant ${name} ist deaktiviert`,
  'unsupported_media_type.logo': LOGO_FILE_RULE,
  /** UI-004 "Neues Modell-Inserat anlegen" (2.0.6, AC-REQ-019-02): the display title of it. */
  'variant_duplicate.new_listing': (listingTitle: string) =>
    `Gleiche Variantenangaben wie Modell-Inserat ${listingTitle}; bitte dort zuordnen`,
  /** UI-027 "Variantenbildend": the model listings by model template (2.0.6, DER-34-11). */
  'variant_flag_would_merge_listings.flag': (listings: string) =>
    `Änderung nicht möglich: Modell-Inserate ${listings} würden gleiche Variantenangaben haben`,
  /**
   * UI-003 "WI-Nr" (and UI-013), the WI-Nr belongs to an available or sold device: its stored
   * WI-Nr and the display title of its model listing, or "nicht zugeordnet" without one (2.0.6,
   * design v0.6.9, MAR-970).
   */
  'wi_nr_taken.listing': (wiNr: string, listingTitle: string) =>
    `WI-Nr bereits vergeben: Gerät ${wiNr} in ${listingTitle}`,
  'wi_nr_taken.unassigned': (wiNr: string) =>
    `WI-Nr bereits vergeben: Gerät ${wiNr} (nicht zugeordnet)`,
} as const satisfies Partial<Record<`${ErrorCode}.${string}`, MessageText>>;

/**
 * Titles of the confirmation dialogs by `confirmation_required.<details.kind>` (8.2); their text
 * is the `message` of the answer from `ERROR_MESSAGES`.
 */
export const CONFIRMATION_TITLES = {
  /** UI-007.dublette (M-27, REQ-011). */
  'confirmation_required.possible_duplicate': 'Mögliche Dublette',
} as const;

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
  /**
   * A stored, deactivated entry in a choice of UI-003, UI-010, UI-014 and UI-033 (2.0.11, design
   * v0.6.8, addendum MAR-929).
   */
  deactivatedChoice: (name: string) => `${name} (deaktiviert)`,
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
  /** UI-045.loading: while `POST /api/ops/shutdown` runs. */
  shutdownPending: 'resellr wird beendet …',
  /** UI-045.error: banner on `500` of `POST /api/ops/shutdown` (REQ-073). */
  shutdownError: (referenceNumber: string) =>
    'resellr konnte nicht beendet werden. resellr läuft weiter. Bitte versuchen Sie es erneut. ' +
    `Besteht der Fehler weiter, informieren Sie den Betreiber mit der Referenznummer ${referenceNumber}.`,
  shutdownDone: 'resellr ist beendet. Sie können den Datenordner jetzt kopieren.',
  /** UI-046.success: lead of the data folder path from the answer `200`. */
  shutdownDoneLocationLead: BACKUP_NOTICE_LINES.backupNoticeLocationLead,
  /** UI-046.unknown: no answer within 30 s or connection lost; without the path. */
  shutdownUnknownTitle: 'Es ließ sich nicht feststellen, ob resellr beendet wurde.',
  shutdownUnknownText:
    'Ausgang unbekannt. resellr antwortet nicht mehr. Kopieren Sie den Datenordner deshalb ' +
    'noch nicht. Starten Sie resellr über die Verknüpfung „resellr“ im Startmenü und beenden ' +
    'Sie es danach erneut. Läuft resellr noch, öffnet die Verknüpfung die normale Oberfläche.',
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
