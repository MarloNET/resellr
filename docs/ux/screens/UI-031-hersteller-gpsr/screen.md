# UI-031 – Hersteller und GPSR

- Zweck: Hersteller verwalten (anlegen, umbenennen, deaktivieren) und GPSR-Herstellerangaben pflegen.
- Flows: FLOW-04 · Anforderungen: REQ-027, REQ-100, REQ-101, REQ-053, REQ-041 · Rollen: Nutzer · Gerät(e): PC · Artefakte: nur Text (Muster P-01)

## Angezeigte Daten
Liste: Name, Status, Chip „GPSR vollständig“ oder „GPSR unvollständig“. Detail: GPSR-Felder.

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Name | Text | ja | 1–50 Zeichen, eindeutig ohne Groß-/Kleinschreibung | wie UI-008 |
| Herstellername (rechtlich) | Text | ja für „GPSR vollständig“ | höchstens 200 Zeichen | „Herstellername fehlt“; „Herstellername: höchstens 200 Zeichen“ |
| Postanschrift | Straße und Hausnummer, PLZ, Ort, Land | ja | Straße und Hausnummer höchstens 200, PLZ 20, Ort 100, Land 100 Zeichen | „<Teil> fehlt“; „Straße und Hausnummer: höchstens 200 Zeichen“; „Postleitzahl: höchstens 20 Zeichen“; „Ort: höchstens 100 Zeichen“; „Land: höchstens 100 Zeichen“ |
| Elektronische Kontaktadresse | E-Mail oder Internetadresse | ja | gültiges Format, höchstens 254 Zeichen | „E-Mail-Adresse oder Internetadresse ungültig“; „Elektronische Kontaktadresse: höchstens 254 Zeichen“ |
| Verantwortliche Person in der EU | Name, Postanschrift, Kontakt | nein | Name höchstens 200, Postanschrift 500, Kontakt 254 Zeichen | „Name der verantwortlichen Person: höchstens 200 Zeichen“; „Postanschrift der verantwortlichen Person: höchstens 500 Zeichen“; „Kontaktadresse der verantwortlichen Person: höchstens 254 Zeichen“ (v0.6, M-05 bis M-13) |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Speichern | Primärbutton | gültig | gespeichert; Umbenennung wirkt auf alle Modellvorlagen des Herstellers (Hinweis vor Speichern); danach UI-043 | Feldfehler | UI-043 |
| Hersteller anlegen | Button | – | UI-008 | – | UI-008 |
| Deaktivieren | Zeilenaktion | – | nicht mehr für neue Modellvorlagen wählbar | – | bleibt |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | wie oben | nur Text | – |
| loading | Platzhalter | nur Text | „Lade Einstellungen …“ |
| empty | Hinweistext mittig im Listenbereich, darunter Button „Hersteller anlegen“ (Primärbutton) | nur Text | „Noch keine Hersteller“ |
| `UI-031.speichert` (wird gespeichert) | Speicherknopf und alle Eingaben gesperrt bis zur Antwort, Anzeige „Speichern …“, **kein festes Timeout** (Muster P-08); bei Verbindungsverlust „Ausgang unbekannt, bitte neu laden“ | nur Text | „Speichern …“ |
| error | Banner | nur Text | „Einstellungen konnten nicht gespeichert werden. Referenz: <Nr>“ |
| validation | Feldfehler | nur Text | siehe Eingaben |
| success | Banner | nur Text | „Gespeichert“ |
| disabled | Speichern deaktiviert ohne Änderung | nur Text | |

## Fenstergröße und Bedienung
Ab 1366 px; Einstellungs-Liste (240 px) links, Inhalt rechts; Tastaturalternativen zum Ziehen.

## Bekannte Abweichungen im Mockup
keine (kein Mockup; Muster siehe uiux-design.md Kap. 5).

## Annahmen und offene Fragen
- Endgültige GPSR-Feldliste wird rechtlich bestätigt (OP-14).
