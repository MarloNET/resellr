# UI-039 – Datenblatt-Layout

- Zweck: Kopfzeilentexte, Blockreihenfolge und Merkmalsreihenfolge je Geräteart für das Datenblatt festlegen. · Flows: FLOW-05 · Anforderungen: REQ-051, REQ-050 · Rollen: Nutzer · Gerät(e): PC · Artefakte: nur Text (Muster P-01/P-03)

## Angezeigte Daten
Kopfzeilentexte (Startbelegung „Shop:“, „eBay:“, „Kleinanzeigen:“), Liste der Blöcke (Identifikation, Zustand, Lieferumfang, Technik, Anschlüsse, Software) in Reihenfolge, je Geräteart Merkmalsreihenfolge innerhalb eines Blocks; Vorschau-Link zu UI-023 am Beispielgerät.

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Kopfzeilentext (je Eintrag) | Text | nein | max. 50 Zeichen (Annahme) | „Kopfzeilentext: höchstens 50 Zeichen“ |
| Blockreihenfolge, Merkmalsreihenfolge | Ziehen/Buttons | – | | – |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Speichern | Primärbutton | gültig | Banner „Datenblatt-Layout gespeichert“ | Feldfehler | bleibt |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | wie oben | nur Text | – |
| loading | Platzhalter | nur Text | „Lade Einstellungen …“ |
| empty | Hinweistext mittig im Listenbereich, darunter Button „Zu den Merkmalen (UI-027)“ (Primärbutton) | nur Text | „Für diese Geräteart sind noch keine Merkmale einem Datenblatt-Block zugeordnet“ |
| error | Banner | nur Text | „Einstellungen konnten nicht gespeichert werden. Referenz: <Nr>“ |
| validation | Feldfehler | nur Text | siehe Eingaben |
| success | Banner | nur Text | „Gespeichert“ |
| disabled | Speichern deaktiviert ohne Änderung | nur Text | |

## Fenstergröße und Bedienung
Fenster frei in der Größe, Untergrenze 1366 px (REQ-077); Einstellungs-Liste (240 px) links, Inhalt rechts; Tastaturalternativen zum Ziehen.

## Bekannte Abweichungen im Mockup
keine (kein Mockup; Muster siehe uiux-design.md Kap. 5).

## Annahmen und offene Fragen
- Das Logo stammt aus UI-026. Zuordnung der Merkmale zu Blöcken erfolgt in UI-027 (Datenblatt-Block).
