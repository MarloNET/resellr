# UI-033 – Code-Übersetzung

- Zweck: Zustandscodes der Lieferanten in Klartext übersetzen. · Flows: – · Anforderungen: REQ-022, REQ-015 · Rollen: Nutzer · Gerät(e): PC · Artefakte: nur Text (Muster P-01)

## Angezeigte Daten
Tabelle: Zustandscode, Lieferant (oder „alle“), Klartext, Vorschlag Zustand, Vorschlag Optik-Note. Hinweis: „Änderungen wirken nur auf künftig erfasste Codes.“

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Zustandscode | Text | ja | max. 20 Zeichen, ohne Groß-/Kleinschreibung | „Zustandscode: 1 bis 20 Zeichen“ |
| Lieferant | Auswahl | nein | aktive Lieferanten | – |
| Klartext | Text | ja | max. 500 | „Klartext: 1 bis 500 Zeichen“ |
| Vorschlag Zustand, Vorschlag Optik-Note | Auswahl, 1–5 | nein | | „Optik-Note: ganze Zahl von 1 bis 5“ |
| Kombination | – | – | Code + Lieferant eindeutig | „Diesen Code gibt es für diesen Lieferanten bereits“ |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Eintrag anlegen/ändern/löschen | Button, Zeilenaktion | gültig; Löschen nach Bestätigung (P-04) | gespeichert | Feldfehler | bleibt |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | wie oben | nur Text | – |
| loading | Platzhalter | nur Text | „Lade Einstellungen …“ |
| empty | | nur Text | siehe „Leerzustand“ oben |
| error | Banner | nur Text | „Einstellungen konnten nicht gespeichert werden. Referenz: <Nr>“ |
| validation | Feldfehler | nur Text | siehe Eingaben |
| success | Banner | nur Text | „Gespeichert“ |
| disabled | Speichern deaktiviert ohne Änderung | nur Text | |
| permission | n/a (eine Rolle, E-4) | – | – |

## Responsive und Barrierefreiheit
Ab 1366 px; Einstellungs-Liste (240 px) links, Inhalt rechts; Tastaturalternativen zum Ziehen.

## Bekannte Abweichungen im Mockup
keine (kein Mockup; Muster siehe uiux-design.md Kap. 5).

## Annahmen und offene Fragen
keine.
