# UI-008 – Hersteller anlegen (Dialog)

- Zweck: Neuen Hersteller aus der Modellvorlage heraus anlegen.
- Flows: FLOW-01 · Anforderungen: REQ-100 · Rollen: Nutzer · Gerät(e): PC · Artefakte: nur Text

## Angezeigte Daten
Feld „Name des Herstellers“. Hinweis nach Anlegen: „Hersteller angelegt. GPSR-Herstellerangaben fehlen noch; ohne sie ist keine Freigabe möglich.“ mit Link zu UI-031.

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Name | Text | ja | 1–50 Zeichen, Leerzeichen am Rand entfernt, eindeutig ohne Groß-/Kleinschreibung | „Name: 1 bis 50 Zeichen“; bei vorhandenem Namen Hinweis „<Name> gibt es bereits und wird verwendet“; bei deaktiviertem: „Hersteller <Name> ist deaktiviert“ |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Hersteller anlegen | Primärbutton, Enter | gültig | Hersteller aktiv und in UI-007 gewählt | Feldfehler | zurück zu UI-007 |
| Abbrechen | Button, Esc | – | – | – | UI-007 |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default, validation, error, success | wie Eingaben/Aktionen | nur Text | error: „Hersteller konnte nicht angelegt werden. Referenz: <Nr>“ |
| loading, empty, disabled | n/a | – | – |
| ausgang-unbekannt (K-6) | Schreibende Aktion ohne Antwort (Verbindungsverlust): Aktion bleibt bis zum Neuladen der Seite gesperrt, Banner „Ausgang unbekannt, bitte neu laden“ (Muster P-08, uiux-design.md Kap. 5), Eingaben bleiben sichtbar, **kein „Erneut versuchen“**; es wird nicht von „noch nicht gespeichert“ ausgegangen. Ablehnung „resellr wird beendet“: P-07 (nicht gespeichert) | nur Text | „Ausgang unbekannt, bitte neu laden.“ |

## Fenstergröße und Bedienung
Dialogbreite 480 px (bei schmalerem Fenster Fensterbreite abzüglich 16 px Rand), Dialoghöhe nie größer als die Fensterhöhe (Titel und Aktionsleiste sichtbar, Inhalt scrollt), Fokus im Feld.

## Bekannte Abweichungen im Mockup
keine (kein Mockup).

## Annahmen und offene Fragen
keine.
