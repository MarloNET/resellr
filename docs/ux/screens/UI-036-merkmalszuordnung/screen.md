# UI-036 – Merkmalszuordnung

- Zweck: Je Kanal und Geräteart festlegen, welche Quelle unter welcher Feldbezeichnung in welcher Reihenfolge ausgegeben wird (bestimmt auch die Reihenfolge im Kopier-Assistenten). · Flows: FLOW-05 · Anforderungen: REQ-025, REQ-029, REQ-037, Kap. 9.8, 9.11 · Rollen: Nutzer · Gerät(e): PC · Artefakte: default.png (Stitch 26f112bbf02e48ac8e663f46655bc3fd, DESKTOP, 06.11.2026)

## Angezeigte Daten
Auswahl Kanal und Geräteart; Tabelle: Reihenfolge, Feldbezeichnung des Kanals, Quelle (Q-01 bis Q-08 in Klartext: „Merkmal <Name>“, „Hersteller“, „EAN“ …), Pflichtfeld des Kanals, Wertzuordnung (Anzahl Zuordnungen).

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Feldbezeichnung | Text | ja | max. 100 | „Feldbezeichnung: 1 bis 100 Zeichen“ |
| Quelle | Auswahl | ja | genau eine Quelle aus Kap. 9.11 | „Quelle fehlt“ |
| Fester Text (Q-08) | Text | ja bei Q-08 | max. 255 | „Fester Text: höchstens 255 Zeichen“ |
| Pflichtfeld des Kanals | Kontrollkästchen | ja | leeres Pflichtfeld verhindert Freigabe | – |
| Wertzuordnung | Tabelle interner Wert → Kanal-Wert | nein | | – |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Zeile hinzufügen, entfernen, verschieben | Buttons, Ziehen | – | Reihenfolge gilt auch im Kopier-Assistenten | – | bleibt |
| Speichern | Primärbutton | gültig | Banner „Gespeichert“, Hinweis „n Kanal-Inhalte betroffen“ | Zellenfehler | bleibt |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | wie oben | nur Text | – |
| loading | Platzhalter | nur Text | „Lade Einstellungen …“ |
| empty | Hinweistext mittig im Listenbereich, darunter Button „Merkmalsfeld hinzufügen“ (Primärbutton) | nur Text | „Für diese Geräteart und diesen Kanal sind noch keine Merkmalsfelder festgelegt“ |
| error | Banner | nur Text | „Einstellungen konnten nicht gespeichert werden. Referenz: <Nr>“ |
| validation | Feldfehler | nur Text | siehe Eingaben |
| success | Banner | nur Text | „Gespeichert“ |
| disabled | Speichern deaktiviert ohne Änderung | nur Text | |

## Fenstergröße und Bedienung
Ab 1366 px; Einstellungs-Liste (240 px) links, Inhalt rechts; Tastaturalternativen zum Ziehen.

## Bekannte Abweichungen im Mockup
Die „Feldbezeichnung des Kanals“ ist im Mockup als Text dargestellt; maßgeblich ist ein Eingabefeld (1 bis 100 Zeichen). Auf-/Ab-Pfeile je Zeile sind die Bedienung für die Reihenfolge (Design-Entscheidung, keine Anforderung). Beim Entfernen einer Zeile: Aktion „Zeile entfernen“ ist im Mockup nicht dargestellt, steht in `screen.md`.

## Annahmen und offene Fragen
- Startbelegung Kap. 9.8; Pflichtfelder des Kanals offen bis OP-22.
