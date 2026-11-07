# UI-035 – Kategoriezuordnung

- Zweck: Je Geräteart und Kanal eine Kategorie als Vorschlag festlegen. · Flows: FLOW-05 · Anforderungen: REQ-024, REQ-038 · Rollen: Nutzer · Gerät(e): PC · Artefakte: nur Text (Muster P-02)

## Angezeigte Daten
Matrix Geräteart (Zeilen) × Kanal (Spalten); Zelle zeigt Kategoriepfad und Kennung oder „fehlt“.

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Kategoriebezeichnung/-pfad | Text | ja je gepflegter Zelle | max. 255 | „Kategorie: 1 bis 255 Zeichen“ |
| Kategorie-Kennung | Text | nein | höchstens 100 Zeichen | „Kategorie-Kennung: höchstens 100 Zeichen“ (v0.6, M-14) |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Zelle bearbeiten, Speichern | Klick, Primärbutton | gültig | gespeichert; Kategorien der Kanäle werden von Hand gepflegt (keine Abfrage beim Kanal) | Feldfehler | bleibt |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | wie oben | nur Text | – |
| loading | Platzhalter | nur Text | „Lade Einstellungen …“ |
| empty | Hinweistext mittig im Listenbereich, darunter Button „Kategorie zuordnen“ (Primärbutton) | nur Text | „Noch keine Kategorien zugeordnet. Ohne Zuordnung zeigt der Kanal-Inhalt „Kategorie fehlt“.“ |
| `UI-035.speichert` (wird gespeichert) | Speicherknopf und alle Eingaben gesperrt bis zur Antwort, Anzeige „Speichern …“, **kein festes Timeout** (Muster P-08); bei Verbindungsverlust „Ausgang unbekannt, bitte neu laden“ | nur Text | „Speichern …“ |
| error | Banner | nur Text | „Einstellungen konnten nicht gespeichert werden. Referenz: <Nr>“ |
| validation | Feldfehler | nur Text | siehe Eingaben |
| success | Banner | nur Text | „Gespeichert“ |
| disabled | Speichern deaktiviert ohne Änderung | nur Text | |

## Fenstergröße und Bedienung
Ab 1366 px; Einstellungs-Liste (240 px) links, Inhalt rechts; Tastaturalternativen zum Ziehen.

## Bekannte Abweichungen im Mockup
keine (kein Mockup; Muster siehe uiux-design.md Kap. 5).

## Annahmen und offene Fragen
- Zellen ohne Eintrag führen zu „Kategorie fehlt“ im Kanal-Inhalt.
