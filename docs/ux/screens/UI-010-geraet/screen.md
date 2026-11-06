# UI-010 – Gerät

- Zweck: Gerätewerte ansehen/ändern, Verkauf, Umbuchen, WI-Nr korrigieren, Storno, Datenblatt.
- Flows: FLOW-03, FLOW-08 · Anforderungen: REQ-014, REQ-016, REQ-020, REQ-021, REQ-084, REQ-092, REQ-093, REQ-050 · Rollen: Nutzer · Gerät(e): PC · Artefakte: nur Text (Mockup geplant)

## Angezeigte Daten
| Element | Inhalt | Quelle | Hinweise |
|---|---|---|---|
| Kopf | WI-Nr, Modellvorlage, Modell-Inserat (Link) oder „nicht zugeordnet“, Chips Bestandsstatus und Erfassungsstatus | Gerät | bei verkauft: „verkauft über <Kanal> am <Datum>“; bei storniert: Grund und Zeitpunkt |
| Gerätewerte | Formular wie UI-003 (ohne WI-Nr-Eingabe) | Gerät | nur bei Status verfügbar bearbeitbar |
| Prüfmarkierungen | Chip „zu prüfen“ je Feld | REQ-013 | |

## Eingaben und Validierung
Gerätewerte wie UI-003 (Regeln REQ-014). Ändert der Nutzer eine Variantenangabe eines zugeordneten Geräts und weicht sie ab: UI-005 mit Wahl „Zuordnung behalten“, „Neues Modell-Inserat anlegen“, „Umbuchen“.

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Gerätewerte speichern | Primärbutton | gültig | Banner „Gerät gespeichert“ | Feldfehler | bleibt |
| Als verkauft markieren | Button | verfügbar, zugeordnet | UI-011 | „Gerät keinem Modell-Inserat zugeordnet“ (Button deaktiviert, Tooltip) | UI-011 |
| Verkauf zurücknehmen | Button | Status verkauft | Bestätigungsdialog (P-04): „Verkaufsmarkierung zurücknehmen? Stückzahl steigt um 1.“ → Status verfügbar, Protokoll | „Gerät ist nicht als verkauft markiert“ | bleibt |
| Umbuchen (Should) | Button | verfügbar, zugeordnet | UI-004 im Modus „umbuchen“ | – | UI-004 |
| WI-Nr korrigieren (Should) | Button | verfügbar oder verkauft | UI-013 | – | UI-013 |
| Gerät stornieren | destruktiver Textbutton | verfügbar | UI-012 | – | UI-012 |
| Zuordnen | Button | nicht zugeordnet, geprüft | UI-004 | „Erst Werte prüfen“ | UI-004 |
| Datenblatt | Sekundärbutton | geprüft, zugeordnet, nicht storniert | – | Hinweise nach REQ-050 (Tooltip) | UI-023 |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | wie oben | nur Text | – |
| loading | Platzhalter | nur Text | „Lade Gerät …“ |
| empty | n/a | – | – |
| error | Banner | nur Text | „Gerät konnte nicht geladen/gespeichert werden. Referenz: <Nr>“ |
| validation | Feldfehler | nur Text | |
| success | Banner | nur Text | „Gerät gespeichert“ |
| disabled | verkauft/storniert: Werte schreibgeschützt, Aktionen je Status | nur Text | „Gerät storniert“ |
| permission | n/a | – | – |

## Responsive und Barrierefreiheit
Ab 1366 px, Aktionen oben rechts.

## Bekannte Abweichungen im Mockup
keine (kein Mockup).

## Annahmen und offene Fragen
- Annahme: Akkukapazität darf auch bei verkauften Geräten nicht geändert werden (REQ-014 betrifft zugeordnete verfügbare Geräte).
