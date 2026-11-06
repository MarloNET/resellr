# UI-038 – Kanäle und Preisregeln

- Zweck: Kanäle aktivieren/deaktivieren, Titel-Höchstlänge, „Verhandlungsbasis“ und Preisregel je Kanal pflegen. · Flows: – · Anforderungen: REQ-029, REQ-033, REQ-085 · Rollen: Nutzer · Gerät(e): PC · Artefakte: nur Text (Muster P-01)

## Angezeigte Daten
Je Kanal ein Block: Name, Status aktiv/inaktiv, Titel-Höchstlänge, „VB zulässig“, Preisregel (Bezugskanal, Auf-/Abschlag in €), Links zu den kanalbezogenen Einstellungen (UI-034 bis UI-037).

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Status | Umschalter | ja | inaktiver Kanal erhält keine neuen Kanal-Inhalte, bestehende bleiben lesbar | – |
| Titel-Höchstlänge | Ganzzahl | ja | 20–500 | „Höchstlänge: ganze Zahl von 20 bis 500“ |
| VB zulässig | Kontrollkästchen | ja | | – |
| Bezugskanal | Auswahl | nein | anderer aktiver Kanal; kein Kreis | „Ein Kanal kann nicht sein eigener Bezugskanal sein“; „Die Preisregeln dürfen keinen Kreis bilden“ |
| Auf-/Abschlag | Dezimalzahl in € | ja bei Bezugskanal | höchstens 2 Nachkommastellen, Vorzeichen | „Auf-/Abschlag: Zahl mit höchstens zwei Nachkommastellen“ |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Speichern | Primärbutton | gültig | Banner; bereits erfasste Preise bleiben unverändert | Feldfehler | bleibt |
| Preisregel entfernen | Textbutton | – | Regel entfernt | – | bleibt |

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
- Ein weiterer Kanal ergänzt ohne Entwicklung nur, wenn die Architektur es vorsieht (REQ-075); hier kein „Kanal anlegen“.
